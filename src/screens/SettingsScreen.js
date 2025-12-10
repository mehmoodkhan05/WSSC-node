import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  enablePushNotifications,
  disablePushNotifications,
  fetchPushPreference,
  PUSH_BACKEND_DISABLED_REASON,
} from '../lib/notifications';
import {
  startLocationTracking,
  stopLocationTracking,
  isLiveTrackingActive,
} from '../lib/liveTracking';
// Parse import removed - using REST API via apiClient
import { hasActiveClockIn } from '../lib/attendance';
import { getSystemConfig, updateSystemConfig } from '../lib/systemConfig';
import { fetchHolidays, createHoliday, deleteHoliday } from '../lib/holidays';
import {
  ROLE,
  normalizeRole,
  hasFullControl,
  hasManagementPrivileges,
  hasFieldLeadershipPrivileges,
  hasExecutivePrivileges,
  isAtLeastRole,
} from '../lib/roles';
const SettingsScreen = () => {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation();
  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const isStaff = role === ROLE.STAFF;
  const isTrackingForced = role === ROLE.STAFF || role === ROLE.SUPERVISOR;
  const canAccessManagementFeatures = hasFieldLeadershipPrivileges(role);
  const canApproveAttendance = hasManagementPrivileges(role);
  const hasExecutiveAccess = hasFullControl(role);
  
  // Hierarchical access checks
  const canAccessAdminFeatures = hasExecutiveAccess && !isStaff; // CEO/Super Admin only, not Staff
  const canAccessGManagerFeatures = isAtLeastRole(role, ROLE.GENERAL_MANAGER) && !isStaff; // G.Manager and above, not Staff
  const canAccessManagerFeatures = isAtLeastRole(role, ROLE.MANAGER) && !isStaff; // Manager and above, not Staff
  const canAccessSupervisorFeatures = isAtLeastRole(role, ROLE.SUPERVISOR) && !isStaff; // Supervisor and above, not Staff
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const [locationTrackingLoading, setLocationTrackingLoading] = useState(false);
  const [autoClockOut, setAutoClockOut] = useState(false);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const isActiveRef = useRef(true);
  
  // Attendance settings state (CEO/SuperAdmin only)
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState('');
  const [minClockIntervalHours, setMinClockIntervalHours] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Holiday management state (CEO/SuperAdmin only)
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const ensurePermissionsAndStart = useCallback(async () => {
    try {
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      let status = foregroundPermission.status;

      if (status !== 'granted') {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status;
      }

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location access is required for live tracking.'
        );
        return false;
      }

      if (Platform.OS === 'android') {
        try {
          const backgroundPermission = await Location.getBackgroundPermissionsAsync();
          if (backgroundPermission.status !== 'granted') {
            await Location.requestBackgroundPermissionsAsync();
          }
        } catch (error) {
          console.warn('Background permission request failed:', error);
        }
      }

      const started = await startLocationTracking();
      return started;
    } catch (error) {
      console.error('Failed to start live location tracking:', error);
      return false;
    }
  }, []);

  const initializeTrackingState = useCallback(async () => {
    setLocationTrackingLoading(true);

    try {
      const [activeShift, activeTracking] = await Promise.all([
        hasActiveClockIn(),
        isLiveTrackingActive(),
      ]);

      if (!isActiveRef.current) {
        return;
      }

      setHasActiveShift(activeShift);

      if (!activeShift) {
        if (activeTracking) {
          try {
            await stopLocationTracking();
          } catch (stopError) {
            console.error('Failed to stop live tracking while inactive:', stopError);
          }
        }

        if (!isActiveRef.current) {
          return;
        }

        setLocationTracking(false);
        return;
      }

      const shouldStart = isTrackingForced || activeTracking;

      if (!shouldStart) {
        setLocationTracking(false);
        return;
      }

      const started = await ensurePermissionsAndStart();
      if (!isActiveRef.current) {
        return;
      }

      if (!started && activeTracking) {
        try {
          await stopLocationTracking();
        } catch (stopError) {
          console.error('Failed to stop live tracking after unsuccessful restart:', stopError);
        }
      }

      setLocationTracking(started);
    } catch (error) {
      console.error('Error initializing live tracking state:', error);
    } finally {
      if (isActiveRef.current) {
        setLocationTrackingLoading(false);
      }
    }
  }, [ensurePermissionsAndStart, isTrackingForced]);

  useEffect(() => {
    initializeTrackingState();
  }, [initializeTrackingState]);

  useFocusEffect(
    useCallback(() => {
      initializeTrackingState();
    }, [initializeTrackingState])
  );


  useEffect(() => {
    let isMounted = true;

    const loadPushPreferences = async () => {
      try {
        setPushLoading(true);
        const preference = await fetchPushPreference();
        if (!isMounted) return;
        setPushEnabled(!!preference?.enabled);
      } catch (error) {
        console.error('Failed to load push notification preference', error);
      } finally {
        if (isMounted) {
          setPushLoading(false);
        }
      }
    };

    loadPushPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load system configuration for CEO/SuperAdmin
  useEffect(() => {
    if (!canAccessAdminFeatures) {
      return;
    }

    const loadSystemConfig = async () => {
      setConfigLoading(true);
      try {
        const config = await getSystemConfig();
        setGracePeriodMinutes(config.gracePeriodMinutes?.toString() || '15');
        setMinClockIntervalHours(config.minClockIntervalHours?.toString() || '6');
      } catch (error) {
        console.error('Error loading system config:', error);
        Alert.alert('Error', 'Failed to load attendance settings');
      } finally {
        setConfigLoading(false);
      }
    };

    loadSystemConfig();
    loadHolidays(); // Load holidays along with system config
  }, [canAccessAdminFeatures]);

  const handleSaveAttendanceSettings = async () => {
    if (configSaving) return;

    // Validate inputs
    const graceMinutes = parseInt(gracePeriodMinutes, 10);
    const intervalHours = parseFloat(minClockIntervalHours);

    if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 1440) {
      Alert.alert('Invalid Input', 'Grace period must be between 0 and 1440 minutes (24 hours)');
      return;
    }

    if (isNaN(intervalHours) || intervalHours < 0 || intervalHours > 24) {
      Alert.alert('Invalid Input', 'Minimum clock interval must be between 0 and 24 hours');
      return;
    }

    setConfigSaving(true);
    try {
      await updateSystemConfig({
        gracePeriodMinutes: graceMinutes,
        minClockIntervalHours: intervalHours
      });
      Alert.alert('Success', 'Attendance settings updated successfully');
    } catch (error) {
      console.error('Error saving system config:', error);
      Alert.alert('Error', error.message || 'Failed to update attendance settings');
    } finally {
      setConfigSaving(false);
    }
  };

  const loadHolidays = async () => {
    if (!canAccessAdminFeatures) return;
    
    setHolidaysLoading(true);
    try {
      const data = await fetchHolidays();
      setHolidays(data);
    } catch (error) {
      console.error('Error loading holidays:', error);
      Alert.alert('Error', 'Failed to load holidays');
    } finally {
      setHolidaysLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName) {
      Alert.alert('Error', 'Please enter both date and holiday name');
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newHolidayDate)) {
      Alert.alert('Error', 'Invalid date format. Use YYYY-MM-DD (e.g., 2024-12-25)');
      return;
    }

    setAddingHoliday(true);
    try {
      await createHoliday({
        date: newHolidayDate,
        name: newHolidayName,
        description: newHolidayDesc
      });
      setNewHolidayDate('');
      setNewHolidayName('');
      setNewHolidayDesc('');
      await loadHolidays();
      Alert.alert('Success', 'Holiday added successfully');
    } catch (error) {
      console.error('Error adding holiday:', error);
      Alert.alert('Error', error.message || 'Failed to add holiday');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holidayId, holidayName) => {
    Alert.alert(
      'Delete Holiday',
      `Are you sure you want to delete "${holidayName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHoliday(holidayId);
              await loadHolidays();
              Alert.alert('Success', 'Holiday deleted successfully');
            } catch (error) {
              console.error('Error deleting holiday:', error);
              Alert.alert('Error', 'Failed to delete holiday');
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = async (value) => {
    if (pushLoading) {
      return false;
    }

    setPushLoading(true);

    try {
      if (value) {
        const result = await enablePushNotifications({ requestPermission: true });
        if (!result.enabled) {
          if (result.reason === PUSH_BACKEND_DISABLED_REASON) {
            Alert.alert(
              'Notifications',
              'Push notifications are temporarily unavailable while backend work is in progress.'
            );
          } else if (result.reason === 'not-physical-device' || result.status === 'unsupported') {
            Alert.alert(
              'Not Supported',
              'Push notifications require running the app on a physical device.'
            );
          } else if (result.status === 'denied' || result.status === 'blocked') {
            Alert.alert(
              'Permission Required',
              'Push notifications are disabled. Please enable them in your device settings.'
            );
          } else {
            Alert.alert(
              'Notifications',
              'Unable to enable push notifications at this time. Please try again later.'
            );
          }
          setPushEnabled(false);
          return false;
        }

        setPushEnabled(true);
        return true;
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
        return true;
      }
    } catch (error) {
      console.error('Error updating push notification preference:', error);
      Alert.alert('Notifications', 'Failed to update notification settings. Please try again.');
      return false;
    } finally {
      setPushLoading(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all locally stored data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          // Implement cache clearing logic
          Alert.alert('Success', 'Cache cleared successfully');
        }},
      ]
    );
  };

  const handleLocationTrackingToggle = async (value) => {
    if (isTrackingForced) {
      setLocationTracking(hasActiveShift);
      return;
    }

    if (locationTrackingLoading) return;

    setLocationTrackingLoading(true);

    try {
      if (value) {
        const activeShift = await hasActiveClockIn();
        setHasActiveShift(activeShift);

        if (!activeShift) {
          Alert.alert(
            'Clock In Required',
            'Live tracking can only be enabled after you clock in.'
          );
          setLocationTracking(false);
          return;
        }

        const started = await ensurePermissionsAndStart();
        setLocationTracking(started);

        if (!started) {
          Alert.alert(
            'Live Tracking',
            'Unable to start live tracking. Please ensure you have granted location permissions and try again.'
          );
        }
      } else {
        await stopLocationTracking();
        setLocationTracking(false);
      }
    } catch (error) {
      console.error('Error toggling live location tracking:', error);
      Alert.alert('Error', 'Failed to update live location tracking. Please try again.');
    } finally {
      setLocationTrackingLoading(false);
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to default. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          const pushReset = await handleNotificationToggle(true);
          setLocationTracking(isTrackingForced ? hasActiveShift : false);
          setAutoClockOut(false);
          if (!pushReset) {
            Alert.alert(
              'Notifications',
              'Push notifications could not be enabled automatically. You can update this later from the settings screen.'
            );
          }
          Alert.alert('Success', 'Settings reset to default');
        }},
      ]
    );
  };

  const handleSignOut = () => {
    const confirmMessage = 'Are you sure you want to sign out?';
    
    if (Platform.OS === 'web') {
      // Use window.confirm for web
      if (window.confirm(confirmMessage)) {
        signOut().catch((error) => {
          console.error('Sign out error:', error);
          window.alert('Failed to sign out. Please try again.');
        });
      }
    } else {
      // Use Alert.alert for native
      Alert.alert(
        'Sign Out',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                // Navigation will automatically go to sign in screen
              } catch (error) {
                console.error('Sign out error:', error);
                Alert.alert('Error', 'Failed to sign out');
              }
            }
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure your app preferences</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive notifications for attendance reminders and updates
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handleNotificationToggle}
            disabled={pushLoading}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location & Tracking</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Live Location Tracking</Text>
            <Text style={styles.settingDescription}>
              Allow supervisors to track your location during work hours
            </Text>
          </View>
          <Switch
          value={hasActiveShift && locationTracking}
            onValueChange={handleLocationTrackingToggle}
            disabled={locationTrackingLoading || isTrackingForced}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Auto Clock-out</Text>
            <Text style={styles.settingDescription}>
              Automatically clock out when leaving the work area
            </Text>
          </View>
          <Switch
            value={autoClockOut}
            onValueChange={setAutoClockOut}
          />
        </View>
      </View>

      {/* Admin Features - CEO/Super Admin only */}
      {canAccessAdminFeatures && (
        <View style={[styles.section, styles.adminSection]}>
          <Text style={styles.sectionTitle}>Admin Features</Text>

          <TouchableOpacity
            style={[styles.button, styles.adminButton]}
            onPress={() => navigation.navigate('Assignments')}
          >
            <Text style={styles.adminButtonText}>Assignments</Text>
            <Text style={styles.buttonDescription}>
              Assign staff to supervisors and locations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.adminButton]}
            onPress={() => navigation.navigate('Users')}
          >
            <Text style={styles.adminButtonText}>Users</Text>
            <Text style={styles.buttonDescription}>
              Manage all registered users
            </Text>
          </TouchableOpacity>

          {/* Attendance Settings */}
          <View style={styles.attendanceSettingsContainer}>
            <Text style={styles.attendanceSettingsTitle}>Attendance Settings</Text>
            <Text style={styles.attendanceSettingsDescription}>
              Configure grace period and clock interval requirements
            </Text>

            {configLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1976d2" />
                <Text style={styles.loadingText}>Loading settings...</Text>
              </View>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Grace Period (minutes)</Text>
                  <Text style={styles.inputHelper}>
                    Time after Shift Start time until which clock-in won't be marked as late
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={gracePeriodMinutes}
                    onChangeText={setGracePeriodMinutes}
                    placeholder="15"
                    keyboardType="numeric"
                    editable={!configSaving}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Minimum Clock Interval (hours)</Text>
                  <Text style={styles.inputHelper}>
                    Minimum time required between clock-in and clock-out
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={minClockIntervalHours}
                    onChangeText={setMinClockIntervalHours}
                    placeholder="6"
                    keyboardType="numeric"
                    editable={!configSaving}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, configSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveAttendanceSettings}
                  disabled={configSaving}
                >
                  {configSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Settings</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Holiday Management */}
          <View style={styles.attendanceSettingsContainer}>
            <Text style={styles.attendanceSettingsTitle}>Company Holidays</Text>
            <Text style={styles.attendanceSettingsDescription}>
              Manage company holidays. Staff working on holidays will automatically get overtime.
            </Text>

            {holidaysLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1976d2" />
                <Text style={styles.loadingText}>Loading holidays...</Text>
              </View>
            ) : (
              <>
                {/* Add New Holiday Form */}
                <View style={styles.holidayFormContainer}>
                  <Text style={styles.inputLabel}>Add New Holiday</Text>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputHelper}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.input}
                      value={newHolidayDate}
                      onChangeText={setNewHolidayDate}
                      placeholder="2024-12-25"
                      editable={!addingHoliday}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputHelper}>Holiday Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={newHolidayName}
                      onChangeText={setNewHolidayName}
                      placeholder="Eid-ul-Fitr"
                      editable={!addingHoliday}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputHelper}>Description (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={newHolidayDesc}
                      onChangeText={setNewHolidayDesc}
                      placeholder="Religious holiday"
                      editable={!addingHoliday}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveButton, addingHoliday && styles.saveButtonDisabled]}
                    onPress={handleAddHoliday}
                    disabled={addingHoliday}
                  >
                    {addingHoliday ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Add Holiday</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Holidays List */}
                <View style={styles.holidaysListContainer}>
                  <Text style={styles.inputLabel}>Existing Holidays ({holidays.length})</Text>
                  {holidays.length === 0 ? (
                    <Text style={styles.noHolidaysText}>No holidays added yet</Text>
                  ) : (
                    holidays.map((holiday) => (
                      <View key={holiday.id} style={styles.holidayItem}>
                        <View style={styles.holidayInfo}>
                          <Text style={styles.holidayName}>{holiday.name}</Text>
                          <Text style={styles.holidayDate}>{holiday.date}</Text>
                          {holiday.description && (
                            <Text style={styles.holidayDesc}>{holiday.description}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteHolidayButton}
                          onPress={() => handleDeleteHoliday(holiday.id, holiday.name)}
                        >
                          <Text style={styles.deleteHolidayButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </View>

        </View>
      )}

      {/* G.Manager Features - General Manager and above */}
      {canAccessGManagerFeatures && (
        <View style={[styles.section, styles.generalManagerSection]}>
          <Text style={styles.sectionTitle}>G.Manager Features</Text>

          <TouchableOpacity
            style={[styles.button, styles.generalManagerButton]}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={styles.generalManagerButtonText}>Locations Map</Text>
            <Text style={styles.buttonDescription}>
              View locations and geofences
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.generalManagerButton]}
            onPress={() => navigation.navigate('Locations')}
          >
            <Text style={styles.generalManagerButtonText}>NC Locations</Text>
            <Text style={styles.buttonDescription}>
              Manage neighborhood council locations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.generalManagerButton]}
            onPress={() => navigation.navigate('Reports')}
          >
            <Text style={styles.generalManagerButtonText}>Reports</Text>
            <Text style={styles.buttonDescription}>
              View and export attendance reports
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.generalManagerButton]}
            onPress={() => navigation.navigate('DetailedTimeReport')}
          >
            <Text style={styles.generalManagerButtonText}>Detailed Time Report</Text>
            <Text style={styles.buttonDescription}>
              Clock-in/out times with photos and shift hours
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manager Features - Manager and above */}
      {canAccessManagerFeatures && (
        <View style={[styles.section, styles.managerSection]}>
          <Text style={styles.sectionTitle}>Manager Features</Text>

          <TouchableOpacity
            style={[styles.button, styles.managerButton]}
            onPress={() => navigation.navigate('Approvals')}
          >
            <Text style={styles.managerButtonText}>Attendance Approvals</Text>
            <Text style={styles.buttonDescription}>
              Review and approve attendance records
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.managerButton]}
            onPress={() => navigation.navigate('PhotoReview')}
          >
            <Text style={styles.managerButtonText}>Photo Review</Text>
            <Text style={styles.buttonDescription}>
              Review attendance photos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.managerButton]}
            onPress={() => navigation.navigate('LiveTracking')}
          >
            <Text style={styles.managerButtonText}>Live Tracking</Text>
            <Text style={styles.buttonDescription}>
              View real-time locations for your team
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.managerButton]}
            onPress={() => navigation.navigate('Assignments')}
          >
            <Text style={styles.managerButtonText}>Create Assignment</Text>
            <Text style={styles.buttonDescription}>
              Create and manage assignments
            </Text>
          </TouchableOpacity>

        </View>
      )}

      {/* Supervisor Features - Supervisor and above */}
      {canAccessSupervisorFeatures && (
        <View style={[styles.section, styles.supervisorSection]}>
          <Text style={styles.sectionTitle}>Supervisor Features</Text>

          <TouchableOpacity
            style={[styles.button, styles.supervisorButton]}
            onPress={() => navigation.navigate('LeaveManagement')}
          >
            <Text style={styles.supervisorButtonText}>Leave Management</Text>
            <Text style={styles.buttonDescription}>
              Submit and manage leave requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.supervisorButton]}
            onPress={() => navigation.navigate('PerformanceReview')}
          >
            <Text style={styles.supervisorButtonText}>Performance Review</Text>
            <Text style={styles.buttonDescription}>
              Upload photos and view performance reports
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile - Visible to all users */}
      <View style={[styles.section, styles.profileSection]}>
        <Text style={styles.sectionTitle}>Profile</Text>

        <TouchableOpacity
          style={[styles.button, styles.profileButton]}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileButtonText}>Edit Profile</Text>
          <Text style={styles.buttonDescription}>
            Edit your profile, name, and password
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>

        <TouchableOpacity style={styles.button} onPress={handleClearCache}>
          <Text style={styles.buttonText}>Clear Cache</Text>
          <Text style={styles.buttonDescription}>
            Clear locally stored data to free up space
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleResetSettings}>
          <Text style={styles.buttonText}>Reset Settings</Text>
          <Text style={styles.buttonDescription}>
            Reset all settings to their default values
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity
          style={[styles.button, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
          <Text style={styles.buttonDescription}>
            Sign out of your account
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Organization</Text>
          <Text style={styles.infoValue}>Water & Sanitation Services</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>Mingora, Swat</Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 15,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  adminSection: {
    backgroundColor: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#c5d5ff',
  },
  generalManagerSection: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffd59f',
  },
  managerSection: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#b7e1bd',
  },
  supervisorSection: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1,
    borderColor: '#d8bfe0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  buttonDescription: {
    fontSize: 14,
    color: '#666',
  },
  adminButton: {
    backgroundColor: '#e8f0fe',
    borderColor: '#c5d5ff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  adminButtonText: {
    color: '#1976d2',
  },
  generalManagerButton: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffd59f',
  },
  generalManagerButtonText: {
    color: '#ef6c00',
  },
  managerButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#b7e1bd',
  },
  managerButtonText: {
    color: '#2e7d32',
  },
  supervisorButton: {
    backgroundColor: '#f3e5f5',
    borderColor: '#d8bfe0',
  },
  supervisorButtonText: {
    color: '#6a1b9a',
  },
  profileSection: {
    backgroundColor: '#e0f7fa',
    borderWidth: 1,
    borderColor: '#80deea',
  },
  profileButton: {
    backgroundColor: '#e0f7fa',
    borderColor: '#80deea',
  },
  profileButtonText: {
    color: '#006064',
  },
  signOutButton: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  signOutButtonText: {
    color: '#d32f2f',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  attendanceSettingsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#c5d5ff',
  },
  attendanceSettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  attendanceSettingsDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#1976d2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  holidayFormContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  holidaysListContainer: {
    marginTop: 16,
  },
  holidayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  holidayDate: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 2,
  },
  holidayDesc: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  deleteHolidayButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  deleteHolidayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noHolidaysText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
});

export default SettingsScreen;
