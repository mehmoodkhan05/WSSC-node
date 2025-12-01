import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  Animated,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { getProfile } from '../lib/auth';
import { fetchAssignments, fetchLocations, isWithinGeofence, fetchSupervisorLocations, isOfficeLocation } from '../lib/locations';
import { fetchStaff, fetchSupervisors } from '../lib/staff';
import { clockIn, clockOut, fetchTodayAttendance } from '../lib/attendance';
import { uploadPhoto } from '../lib/photoStorage';
import { startLocationTracking, stopLocationTracking } from '../lib/liveTracking';
import CameraCapture from '../components/CameraCapture';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ROLE,
  normalizeRole,
  hasFullControl,
  hasManagementPrivileges,
} from '../lib/roles';

const MarkAttendanceScreen = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [currentLat, setCurrentLat] = useState(null);
  const [currentLng, setCurrentLng] = useState(null);

  // Form state
  const [selectedStaff, setSelectedStaff] = useState('');
  const [currentLocationId, setCurrentLocationId] = useState('');
  const [currentSupervisorId, setCurrentSupervisorId] = useState('');
  const [overtime, setOvertime] = useState(false);
  const [doubleDuty, setDoubleDuty] = useState(false);
  const [clockAsSupervisor, setClockAsSupervisor] = useState(false);
  const [overrideMode, setOverrideMode] = useState(false);

  // Data state
  const [staff, setStaff] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [supervisorLocations, setSupervisorLocations] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  
  // Tab state for clock-in/clock-out pages
  const [activeTab, setActiveTab] = useState('clockin'); // 'clockin' or 'clockout'
  const resolvedRole = normalizeRole(currentUserProfile?.role || profile?.role) || ROLE.STAFF;
  const isStaff = resolvedRole === ROLE.STAFF;
  const isSupervisor = resolvedRole === ROLE.SUPERVISOR;
  const isManager = resolvedRole === ROLE.MANAGER;
  const isGeneralManager = resolvedRole === ROLE.GENERAL_MANAGER;
  const isManagerOrGM = isManager || isGeneralManager;
  const hasManagerAccess = hasManagementPrivileges(resolvedRole);
  const hasExecutiveAccess = hasFullControl(resolvedRole);
  
  // Get current user's department for filtering in override mode
  const currentUserDepartment = (isManager || isGeneralManager)
    ? (currentUserProfile?.department || profile?.department || null)
    : null;

  // Camera modal
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState('clock_in');

  useEffect(() => {
    loadInitialData();
    refreshTodayAttendance();
  }, []);

  // Reset location verification when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setLocationVerified(false);
      return () => {
        // Optional cleanup on blur
      };
    }, [])
  );

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const [asgs, stf, locs, sups, userProfile, supLocs] = await Promise.all([
        fetchAssignments(),
        fetchStaff(),
        fetchLocations(),
        fetchSupervisors(),
        getProfile(),
        fetchSupervisorLocations(),
      ]);

      setAssignments(asgs || []);
      setStaff(stf || []);
      setLocations(locs || []);
      setAllLocations(locs || []);
      setSupervisors(sups || []);
      setSupervisorLocations(supLocs || []);
      setCurrentUserProfile(userProfile);

      // Role-aware behavior
      const role = normalizeRole(userProfile?.role) || ROLE.STAFF;

      if (locs && locs.length > 0) {
        setCurrentLocationId(locs[0].id);
      }

      if (role === ROLE.SUPERVISOR) {
        const meId = userProfile?.user_id;
        if (meId) {
          setCurrentSupervisorId(meId);
          // Limit locations to those mapped to this supervisor
          const allowed = (supLocs || []).filter(m => m.supervisor_id === meId).map(m => m.nc_location_id);
          const filteredLocs = (locs || []).filter(l => allowed.includes(l.id));
          setLocations(filteredLocs);
          if (filteredLocs.length > 0) setCurrentLocationId(filteredLocs[0].id);
        }
      } else if (role === ROLE.STAFF) {
        // For staff members, show only themselves and set their location/supervisor
        const meId = userProfile?.user_id;
        if (meId) {
          setSelectedStaff(meId);
          // Find their assignment to get location and supervisor
          const myAssignment = (asgs || []).find(a => a.staff_id === meId && a.is_active);
          if (myAssignment) {
            setCurrentLocationId(myAssignment.nc_location_id);
            setCurrentSupervisorId(myAssignment.supervisor_id);
            // Filter locations to only show where this staff is assigned
            const assignedLocations = (locs || []).filter(l =>
              (asgs || []).some(a => a.staff_id === meId && a.nc_location_id === l.id && a.is_active)
            );
            setLocations(assignedLocations);
          }
        }
      } else if (hasManagementPrivileges(role) || hasFullControl(role)) {
        // For Manager and General Manager, filter to office locations only when clocking themselves
        // For override mode, show locations with assigned staff from their department
        if ((isManager || isGeneralManager) && !overrideMode) {
          // Filter to office locations only
          const officeLocations = (locs || []).filter(l => isOfficeLocation(l));
          setLocations(officeLocations);
          if (officeLocations.length > 0) setCurrentLocationId(officeLocations[0].id);
          // When Manager/GM is clocking themselves, set staff to themselves and supervisor to themselves
          const meId = userProfile?.user_id;
          if (meId) {
            setSelectedStaff(meId);
            setCurrentSupervisorId(meId);
          }
        } else if (overrideMode && (isManager || isGeneralManager)) {
          // For override mode, filter by department
          const userDept = userProfile?.department || profile?.department || null;
          if (userDept) {
            // Filter assignments to only those in the user's department
            const deptAssignments = (asgs || []).filter(a => {
              const assignmentStaff = (stf || []).find(s => s.user_id === a.staff_id);
              const assignmentSupervisor = (sups || []).find(s => s.user_id === a.supervisor_id);
              const staffDept = assignmentStaff?.department || null;
              const supervisorDept = assignmentSupervisor?.department || null;
              return (staffDept === userDept || supervisorDept === userDept) && a.is_active;
            });
            // Get unique location IDs from filtered assignments
            const deptLocationIds = [...new Set(deptAssignments.map(a => a.nc_location_id))];
            const locationsWithDeptStaff = (locs || []).filter(l => deptLocationIds.includes(l.id));
            setLocations(locationsWithDeptStaff);
            if (locationsWithDeptStaff.length > 0) setCurrentLocationId(locationsWithDeptStaff[0].id);
          } else {
            // No department assigned, show all locations with assigned staff
            const locationsWithStaff = (locs || []).filter(l =>
              (asgs || []).some(a => a.nc_location_id === l.id && a.is_active)
            );
            setLocations(locationsWithStaff);
            if (locationsWithStaff.length > 0) setCurrentLocationId(locationsWithStaff[0].id);
          }
        } else {
          // For other management roles, show locations with assigned staff
          const locationsWithStaff = (locs || []).filter(l =>
            (asgs || []).some(a => a.nc_location_id === l.id && a.is_active)
          );
          setLocations(locationsWithStaff);
          if (locationsWithStaff.length > 0) setCurrentLocationId(locationsWithStaff[0].id);
        }
        if (sups && sups.length > 0 && !((isManager || isGeneralManager) && !overrideMode)) {
          setCurrentSupervisorId(sups[0].user_id);
        }
      } else {
        setLocations(locs || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const refreshTodayAttendance = async () => {
    try {
      const attendance = await fetchTodayAttendance();
      // Filter to only show records with clock-in
      const withClockIn = (attendance || []).filter(a => a.clockIn);
      setTodayAttendance(withClockIn);
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      setTodayAttendance([]);
    }
  };

  // Function to handle location change and update supervisor automatically
  const handleLocationChange = async (newLocationId) => {
    if (locationVerified && !overrideMode) return; // lock after verification (unless override mode)

    setCurrentLocationId(newLocationId);

    // If the current user is a staff member, switch the supervisor to the one
    // the staff is assigned to for the selected location (if any).
    if (isStaff) {
      const meId = currentUserProfile.user_id;
      const myAssignment = (assignments || []).find(a => a.staff_id === meId && a.nc_location_id === newLocationId && a.is_active);
      if (myAssignment) {
        setCurrentSupervisorId(myAssignment.supervisor_id);
      }
      return;
    }

    // For non-staff users, find supervisor mapping for the selected location
    const assigned = supervisorLocations.find(sl => sl.nc_location_id === newLocationId);
    if (assigned && !isSupervisor) {
      setCurrentSupervisorId(assigned.supervisor_id);
    }

    // For management roles, filter locations based on mode
    if (hasManagerAccess || hasExecutiveAccess) {
      if ((isManager || isGeneralManager) && !overrideMode) {
        // Filter to office locations only for Manager/GM when not in override mode
        const officeLocations = allLocations.filter(l => isOfficeLocation(l));
        setLocations(officeLocations);
      } else if (overrideMode && (isManager || isGeneralManager)) {
        // For override mode, filter by department
        const userDept = currentUserProfile?.department || profile?.department || null;
        if (userDept) {
          // Filter assignments to only those in the user's department
          const deptAssignments = assignments.filter(a => {
            const assignmentStaff = staff.find(s => s.user_id === a.staff_id);
            const assignmentSupervisor = supervisors.find(s => s.user_id === a.supervisor_id);
            const staffDept = assignmentStaff?.department || null;
            const supervisorDept = assignmentSupervisor?.department || null;
            return (staffDept === userDept || supervisorDept === userDept) && a.is_active;
          });
          // Get unique location IDs from filtered assignments
          const deptLocationIds = [...new Set(deptAssignments.map(a => a.nc_location_id))];
          const locationsWithDeptStaff = allLocations.filter(l => deptLocationIds.includes(l.id));
          setLocations(locationsWithDeptStaff);
        } else {
          // No department assigned, show locations with assigned staff
          const locationsWithStaff = allLocations.filter(l =>
            assignments.some(a => a.nc_location_id === l.id && a.is_active)
          );
          setLocations(locationsWithStaff);
        }
      } else {
        // For other management roles, show locations with assigned staff
        const locationsWithStaff = allLocations.filter(l =>
          assignments.some(a => a.nc_location_id === l.id && a.is_active)
        );
        setLocations(locationsWithStaff);
      }
    }
  };

  const handleVerifyLocation = async () => {
    try {
      setVerifyingLocation(true);
      setVerificationStatus('Checking permissions...');
      
      const isSelfAction = selectedStaff && selectedStaff === currentUserProfile?.user_id;
      
      // For Manager/GM clocking themselves, verify it's an office location
      if (isManagerOrGM && isSelfAction) {
        setVerificationStatus('Validating office location...');
        const latest = await fetchLocations();
        const loc = (latest || []).find(l => l.id === currentLocationId);
        if (!loc) {
          Alert.alert('Error', 'Location not found');
          setVerifyingLocation(false);
          setVerificationStatus('');
          return;
        }
        if (!isOfficeLocation(loc)) {
          Alert.alert('Error', 'Managers and General Managers must verify location at an office location');
          setVerifyingLocation(false);
          setVerificationStatus('');
          return;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        setVerifyingLocation(false);
        setVerificationStatus('');
        return;
      }

      setVerificationStatus('Getting your GPS location...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = position.coords;

      setVerificationStatus('Verifying you are at the location...');
      // Refresh locations to avoid stale values after edits
      const latest = await fetchLocations();
      const loc = (latest || []).find(l => l.id === currentLocationId);
      if (!loc) {
        Alert.alert('Error', 'Location not found');
        setVerifyingLocation(false);
        setVerificationStatus('');
        return;
      }

      // Ensure numeric values for geofence calculation
      const centerLat = parseFloat(loc.center_lat);
      const centerLng = parseFloat(loc.center_lng);
      const radiusMeters = parseFloat(loc.radius_meters);

      // Calculate distance for debugging
      const R = 6371e3; // Earth's radius in meters
      const φ1 = latitude * Math.PI / 180;
      const φ2 = centerLat * Math.PI / 180;
      const Δφ = (centerLat - latitude) * Math.PI / 180;
      const Δλ = (centerLng - longitude) * Math.PI / 180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // Debug logging for location verification
      console.log('=== Location Verification Debug ===');
      console.log('Location Name:', loc.name);
      console.log('User Position:', { latitude, longitude });
      console.log('Location Center:', { centerLat, centerLng });
      console.log('Radius (meters):', radiusMeters);
      console.log('Distance from center (meters):', Math.round(distance));
      console.log('Difference:', Math.round(distance - radiusMeters), 'meters', distance <= radiusMeters ? '(WITHIN)' : '(OUTSIDE)');
      
      const ok = isWithinGeofence(latitude, longitude, centerLat, centerLng, radiusMeters);
      console.log('Within Geofence:', ok);
      console.log('===================================');
      
      if (ok) {
        // Filter locations based on user role and assignments after verification
        let filteredLocations = [];

        if (isStaff) {
          // For staff members, only show locations where they are assigned
          const meId = currentUserProfile.user_id;
          filteredLocations = (latest || []).filter(l =>
            assignments.some(a => a.staff_id === meId && a.nc_location_id === l.id && a.is_active)
          );
        } else if (isSupervisor) {
          // For supervisors, only show locations mapped to them
          const meId = currentUserProfile.user_id;
          const allowedLocationIds = (supervisorLocations || []).filter(m => m.supervisor_id === meId).map(m => m.nc_location_id);
          filteredLocations = (latest || []).filter(l => allowedLocationIds.includes(l.id));
        } else if (hasManagerAccess || hasExecutiveAccess) {
    // For management roles, filter based on mode
    if ((isManager || isGeneralManager) && !overrideMode) {
      // Filter to office locations only for Manager/GM when not in override mode
      filteredLocations = (latest || []).filter(l => isOfficeLocation(l));
    } else if (overrideMode && (isManager || isGeneralManager)) {
      // For override mode, filter by department
      const userDept = currentUserProfile?.department || profile?.department || null;
      if (userDept) {
        // Filter assignments to only those in the user's department
        const deptAssignments = assignments.filter(a => {
          const assignmentStaff = staff.find(s => s.user_id === a.staff_id);
          const assignmentSupervisor = supervisors.find(s => s.user_id === a.supervisor_id);
          const staffDept = assignmentStaff?.department || null;
          const supervisorDept = assignmentSupervisor?.department || null;
          return (staffDept === userDept || supervisorDept === userDept) && a.is_active;
        });
        // Get unique location IDs from filtered assignments
        const deptLocationIds = [...new Set(deptAssignments.map(a => a.nc_location_id))];
        filteredLocations = (latest || []).filter(l => deptLocationIds.includes(l.id));
      } else {
        // No department assigned, show locations with assigned staff
        filteredLocations = (latest || []).filter(l =>
          assignments.some(a => a.nc_location_id === l.id && a.is_active)
        );
      }
    } else {
      // For other management roles, show locations with assigned staff
      filteredLocations = (latest || []).filter(l =>
        assignments.some(a => a.nc_location_id === l.id && a.is_active)
      );
    }
        } else {
          filteredLocations = latest || [];
        }

        setLocations(filteredLocations);
        setVerificationStatus('');
        setVerifyingLocation(false);
        Alert.alert('Success', `Location verified at ${loc.name}`);
        setLocationVerified(true);
      } else {
        setVerificationStatus('');
        setVerifyingLocation(false);
        Alert.alert('Location Error', 'You are not within the assigned location');
      }
    } catch (error) {
      console.error('Location error:', error);
      setVerificationStatus('');
      setVerifyingLocation(false);
      Alert.alert('Error', 'Failed to get location');
    }
  };

  const handlePhotoTaken = async (fileUri) => {
    try {
      const attendanceDate = new Date().toISOString().split('T')[0];
      const photoResult = await uploadPhoto(fileUri, selectedStaff, cameraType, attendanceDate);

      if (cameraType === 'clock_in') {
        await performClockIn(photoResult.path, currentLat, currentLng);
      } else {
        await performClockOut(photoResult.path, currentLat, currentLng);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      Alert.alert('Error', 'Failed to upload photo');
    }
  };

  const performClockIn = async (photoPath = null, lat = null, lng = null) => {
    const actedStaffId = selectedStaff;
    const staffRow = staff.find(s => s.user_id === actedStaffId);
    const isSelfAction = actedStaffId && actedStaffId === currentUserProfile?.user_id;
    const isOverride = overrideMode && (isManager || isGeneralManager) && !isSelfAction;
    
    // Validate department restriction in override mode
    if (isOverride && currentUserDepartment) {
      const selectedStaffMember = staff.find(s => s.user_id === actedStaffId);
      const selectedSupervisorMember = supervisors.find(s => s.user_id === currentSupervisorId);
      
      if (selectedStaffMember && (selectedStaffMember.department || null) !== currentUserDepartment) {
        Alert.alert('Error', 'You can only clock staff from your department in override mode');
        return;
      }
      
      if (selectedSupervisorMember && (selectedSupervisorMember.department || null) !== currentUserDepartment) {
        Alert.alert('Error', 'You can only clock staff under supervisors from your department in override mode');
        return;
      }
    }
    
    try {
      setLoading(true);
      const result = await clockIn({
        staff_id: actedStaffId,
        supervisor_id: clockAsSupervisor ? currentUserProfile?.user_id : currentSupervisorId,
        nc_location_id: currentLocationId,
        overtime,
        double_duty: doubleDuty,
        lat: lat || currentLat,
        lng: lng || currentLng,
        clock_in_photo_url: photoPath,
        is_override: isOverride,
        clocked_by_id: isOverride ? currentUserProfile?.user_id : null,
      });
      if (result?.alreadyClockedIn) {
        Alert.alert('Info', `${staffRow?.name || 'This staff member'} is already clocked in today.`);
      } else {
        const message = isOverride && result?.clocked_in_by
          ? `Clock-in recorded for ${staffRow?.name || 'staff member'} by ${result.clocked_in_by}`
          : `Clock-in recorded for ${staffRow?.name || 'staff member'}`;
        Alert.alert('Success', message);
        if (isSelfAction) {
          try {
            await startLocationTracking();
          } catch (trackingError) {
            console.error('Failed to start live tracking after clock-in:', trackingError);
          }
        }
      }
      await refreshTodayAttendance();
    } catch (error) {
      console.error('Clock-in error:', error);
      Alert.alert('Error', error.message || 'Failed to clock in');
    } finally {
      setLoading(false);
      // Reset form and location verification (always reset, regardless of success or failure)
      setSelectedStaff('');
      setOvertime(false);
      setDoubleDuty(false);
      setLocationVerified(false); // Reset location verification for next action
    }
  };

  const performClockOut = async (photoPath = null, lat = null, lng = null) => {
    const actedStaffId = selectedStaff;
    const staffRow = staff.find(s => s.user_id === actedStaffId);
    const isSelfAction = actedStaffId && actedStaffId === currentUserProfile?.user_id;
    const isOverride = overrideMode && (isManager || isGeneralManager) && !isSelfAction;
    
    // Validate department restriction in override mode
    if (isOverride && currentUserDepartment) {
      const selectedStaffMember = staff.find(s => s.user_id === actedStaffId);
      const selectedSupervisorMember = supervisors.find(s => s.user_id === currentSupervisorId);
      
      if (selectedStaffMember && (selectedStaffMember.department || null) !== currentUserDepartment) {
        Alert.alert('Error', 'You can only clock staff from your department in override mode');
        return;
      }
      
      if (selectedSupervisorMember && (selectedSupervisorMember.department || null) !== currentUserDepartment) {
        Alert.alert('Error', 'You can only clock staff under supervisors from your department in override mode');
        return;
      }
    }
    
    try {
      setLoading(true);
      const result = await clockOut({
        staff_id: actedStaffId,
        supervisor_id: clockAsSupervisor ? currentUserProfile?.user_id : currentSupervisorId,
        nc_location_id: currentLocationId,
        lat: lat || currentLat,
        lng: lng || currentLng,
        clock_out_photo_url: photoPath,
        is_override: isOverride,
        clocked_by_id: isOverride ? currentUserProfile?.user_id : null,
      });
      if (result?.alreadyClockedOut) {
        Alert.alert('Info', `${staffRow?.name || 'This staff member'} is already clocked out today.`);
      } else {
        const message = isOverride && result?.clocked_out_by
          ? `Clock-out recorded for ${staffRow?.name || 'staff member'} by ${result.clocked_out_by}`
          : `Clock-out recorded for ${staffRow?.name || 'staff member'}`;
        Alert.alert('Success', message);
        if (isSelfAction) {
          try {
            await stopLocationTracking();
          } catch (trackingError) {
            console.error('Failed to stop live tracking after clock-out:', trackingError);
          }
        }
      }
      await refreshTodayAttendance();
    } catch (error) {
      console.error('Clock-out error:', error);
      Alert.alert('Error', error.message || 'Failed to clock out');
    } finally {
      setLoading(false);
      // Reset form and location verification (always reset, regardless of success or failure)
      setSelectedStaff('');
      setLocationVerified(false); // Reset location verification for next action
    }
  };

  const handleClockIn = async () => {
    const isSelfAction = selectedStaff && selectedStaff === currentUserProfile?.user_id;
    const isOverride = overrideMode && (isManager || isGeneralManager) && !isSelfAction;

    // For Manager/GM clocking themselves, require location verification
    // For override mode, skip location verification
    if (!isOverride && !locationVerified) {
      Alert.alert('Error', 'Not within assigned location — please verify location first');
      return;
    }
    if (!selectedStaff) {
      Alert.alert('Error', 'Please select a staff member');
      return;
    }

    try {
      // Check and request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      // Enforce live on-location check at action time (skip for override mode)
      if (!isOverride) {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 10000,
        });
        const { latitude, longitude } = position.coords;
        setCurrentLat(latitude);
        setCurrentLng(longitude);

        const latest = await fetchLocations();
        const loc = (latest || []).find(l => l.id === currentLocationId);

        if (!loc) {
          Alert.alert('Error', 'Location not found');
          return;
        }

        // For Manager/GM clocking themselves, verify they're at office location
        if (isManagerOrGM && isSelfAction) {
          if (!isOfficeLocation(loc)) {
            Alert.alert('Error', 'Managers and General Managers must clock in at office location');
            return;
          }
        }

        const ok = isWithinGeofence(latitude, longitude, loc.center_lat, loc.center_lng, loc.radius_meters);
        if (!ok) {
          Alert.alert('Error', 'Clock-in blocked: not within location');
          return;
        }
      }

      // Bypass camera in override mode, directly perform clock-in
      if (isOverride) {
        await performClockIn(null, currentLat, currentLng);
      } else {
        // Show camera for photo proof
        setCameraType('clock_in');
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      Alert.alert('Error', 'Unable to verify location');
    }
  };

  const handleClockOut = async () => {
    const isSelfAction = selectedStaff && selectedStaff === currentUserProfile?.user_id;
    const isOverride = overrideMode && (isManager || isGeneralManager) && !isSelfAction;

    // For Manager/GM clocking themselves, require location verification
    // For override mode, skip location verification
    if (!isOverride && !locationVerified) {
      Alert.alert('Error', 'Not within assigned location — please verify location first');
      return;
    }
    if (!selectedStaff) {
      Alert.alert('Error', 'Please select a staff member');
      return;
    }

    try {
      // Check and request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      // Enforce live on-location check at action time (skip for override mode)
      if (!isOverride) {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 10000,
        });
        const { latitude, longitude } = position.coords;
        setCurrentLat(latitude);
        setCurrentLng(longitude);

        const latest = await fetchLocations();
        const loc = (latest || []).find(l => l.id === currentLocationId);

        if (!loc) {
          Alert.alert('Error', 'Location not found');
          return;
        }

        // For Manager/GM clocking themselves, verify they're at office location
        if (isManagerOrGM && isSelfAction) {
          if (!isOfficeLocation(loc)) {
            Alert.alert('Error', 'Managers and General Managers must clock out at office location');
            return;
          }
        }

        const ok = isWithinGeofence(latitude, longitude, loc.center_lat, loc.center_lng, loc.radius_meters);
        if (!ok) {
          Alert.alert('Error', 'Clock-out blocked: not within location');
          return;
        }
      }

      // Bypass camera in override mode, directly perform clock-out
      if (isOverride) {
        await performClockOut(null, currentLat, currentLng);
      } else {
        // Show camera for photo proof
        setCameraType('clock_out');
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      Alert.alert('Error', 'Unable to verify location');
    }
  };

  const getFilteredStaff = () => {
    // If current user is a staff member, show only themselves
    if (isStaff) {
      const currentStaff = staff.find(s => s.user_id === currentUserProfile.user_id);
      return currentStaff ? [currentStaff] : [];
    }

    // For Manager/General Manager in override mode, include supervisors in addition to staff
    // Filter by department if user has one
    if ((isManager || isGeneralManager) && overrideMode) {
      const userDept = currentUserDepartment;
      
      // Filter staff by location and department
      let filteredStaff = staff.filter(m => {
        const hasLocationAssignment = assignments.some(a => 
          a.staff_id === m.user_id && 
          a.nc_location_id === currentLocationId && 
          a.is_active
        );
        if (!hasLocationAssignment) return false;
        // If user has a department, filter by it
        if (userDept) {
          return (m.department || null) === userDept;
        }
        return true;
      });
      
      // Include supervisors that are assigned to the selected location
      let filteredSupervisors = supervisors.filter(s => {
        const hasLocationMapping = supervisorLocations.some(sl => 
          sl.supervisor_id === s.user_id && sl.nc_location_id === currentLocationId
        );
        if (!hasLocationMapping) return false;
        // If user has a department, filter by it
        if (userDept) {
          return (s.department || null) === userDept;
        }
        return true;
      });
      
      // Combine and remove duplicates
      const combined = [...filteredStaff, ...filteredSupervisors];
      // Remove duplicates by user_id
      const unique = combined.filter((person, index, self) =>
        index === self.findIndex(p => p.user_id === person.user_id)
      );
      return unique;
    }

    // For supervisors and management, show assigned staff
    const filtered = staff.filter(m =>
      assignments.some(a => a.staff_id === m.user_id && a.supervisor_id === currentSupervisorId && a.nc_location_id === currentLocationId && a.is_active)
    );
    return filtered;
  };

  const filteredStaff = getFilteredStaff();

  // Staff not yet clocked in (for clock-in tab)
  const staffNotClockedIn = React.useMemo(() => {
    return filteredStaff.filter(staffMember => 
      !todayAttendance.some(att => att.staffId === staffMember.user_id && att.clockIn)
    );
  }, [filteredStaff, todayAttendance]);

  // Staff who clocked in but haven't clocked out (for clock-out tab)
  const staffClockedInNotOut = React.useMemo(() => {
    return filteredStaff.filter(staffMember => 
      todayAttendance.some(att => 
        att.staffId === staffMember.user_id && att.clockIn && !att.clockOut
      )
    );
  }, [filteredStaff, todayAttendance]);

  // Get the appropriate staff list based on active tab
  const getTabFilteredStaff = () => {
    if (activeTab === 'clockin') {
      return staffNotClockedIn;
    } else {
      return staffClockedInNotOut;
    }
  };

  const tabFilteredStaff = getTabFilteredStaff();

  const AnimatedButton = ({ colors, onPress, disabled, children, style }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      if (disabled) return;
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        friction: 7,
        tension: 120,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 120,
      }).start();
    };

    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.animatedButtonWrapper,
          disabled && styles.animatedButtonDisabled,
          pressed && !disabled && styles.animatedButtonPressed,
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.animatedButtonContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient colors={colors} style={styles.gradientBackground}>
            {children}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>
          {hasExecutiveAccess ? "View today's attendance records" : "Record staff clock-in and clock-out"}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Verification - Hidden for CEO/Superadmin */}
        {!hasExecutiveAccess && (
          <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Location Verification</CardTitle>
            <CardDescription>Verify you're in the correct service area</CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <SearchableDropdown
                options={[
                  { label: 'Select location', value: '' },
                  ...locations.map(l => ({ label: l.name, value: l.id, code: l.code || '' }))
                ]}
                selectedValue={currentLocationId}
                onValueChange={handleLocationChange}
                placeholder={isManagerOrGM && !overrideMode ? "Select office location" : "Select location"}
                style={styles.dropdown}
                disabled={!!locationVerified && !overrideMode}
                searchPlaceholder="Search by location name..."
                getSearchText={(option) => {
                  if (!option || option.value === '') return '';
                  const name = option.label || '';
                  const code = option.code || '';
                  return `${name} ${code}`.toLowerCase();
                }}
              />
            </View>

            {/* Hide supervisor dropdown when Manager/GM is clocking themselves (not in override mode) */}
            {!((isManager || isGeneralManager) && !overrideMode) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Supervisor</Text>
                {hasManagerAccess || hasExecutiveAccess ? (
                  <SimpleDropdown
                    options={[
                      { label: 'Select supervisor', value: '' },
                      ...supervisors.map(s => ({ label: s.name, value: s.user_id }))
                    ]}
                    selectedValue={currentSupervisorId}
                    onValueChange={(v) => {
                      if (locationVerified && !overrideMode) return;
                      setCurrentSupervisorId(v);
                    }}
                    placeholder="Select supervisor"
                    style={styles.dropdown}
                    disabled={!!locationVerified && !overrideMode}
                  />
                ) : (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      {supervisors.find(s => s.user_id === currentSupervisorId)?.name || 'Unassigned'}
                    </Text>
                    <Text style={styles.infoSubtext}>Your assigned supervisor</Text>
                  </View>
                )}
              </View>
            )}

            {!overrideMode && (
              <>
                <TouchableOpacity
                  style={[
                    styles.verifyButton, 
                    locationVerified && styles.verifiedButton,
                    verifyingLocation && styles.verifyingButton
                  ]}
                  onPress={handleVerifyLocation}
                  disabled={locationVerified || !currentLocationId || verifyingLocation}
                >
                  <Text style={styles.verifyButtonText}>
                    {locationVerified 
                      ? '✓ Location Verified' 
                      : verifyingLocation 
                        ? '⏳ Verifying...' 
                        : 'Verify Location'}
                  </Text>
                </TouchableOpacity>
                {verifyingLocation && verificationStatus && (
                  <View style={styles.verificationStatusContainer}>
                    <Text style={styles.verificationStatusText}>{verificationStatus}</Text>
                  </View>
                )}
              </>
            )}
            {overrideMode && (isManager || isGeneralManager) && (
              <View style={styles.overrideInfoBox}>
                <Text style={styles.overrideInfoText}>
                  Override Mode Active: You can clock in/out for staff and supervisors with internet issues.
                  {currentUserDepartment && ` You can only manage staff from your department (${currentUserDepartment}).`}
                  Location verification is bypassed in this mode.
                </Text>
              </View>
            )}
          </CardContent>
        </Card>
        )}

        {/* Tab Selector for Clock-In/Clock-Out Pages */}
        {!hasExecutiveAccess && !isStaff && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'clockin' && styles.tabActive]}
              onPress={() => {
                setActiveTab('clockin');
                setSelectedStaff(''); // Reset selection when switching tabs
              }}
            >
              <Text style={[styles.tabText, activeTab === 'clockin' && styles.tabTextActive]}>
                Clock In ({staffNotClockedIn.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'clockout' && styles.tabActive]}
              onPress={() => {
                setActiveTab('clockout');
                setSelectedStaff(''); // Reset selection when switching tabs
              }}
            >
              <Text style={[styles.tabText, activeTab === 'clockout' && styles.tabTextActive]}>
                Clock Out ({staffClockedInNotOut.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Attendance Details - Hidden for CEO/Superadmin */}
        {!hasExecutiveAccess && (
          <Card style={styles.card}>
          <CardHeader>
            <CardTitle>{activeTab === 'clockin' ? 'Clock In' : 'Clock Out'}</CardTitle>
            <CardDescription>
              {activeTab === 'clockin' 
                ? 'Select staff to mark clock-in' 
                : 'Select staff to mark clock-out'}
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {/* Hide staff dropdown when Manager/GM is clocking themselves (not in override mode) or supervisor is clocking as supervisor */}
            {!((isManager || isGeneralManager) && !overrideMode) && !(isSupervisor && clockAsSupervisor) ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Staff Member</Text>
                <SearchableDropdown
                  options={[
                    { label: 'Select staff member', value: '' },
                    ...(isStaff ? filteredStaff : tabFilteredStaff).map(s => ({ 
                      label: `${s.name || s.email}${s.empNo ? ` (ID: ${s.empNo})` : ''}`, 
                      value: s.user_id,
                      empNo: s.empNo || null,
                      name: s.name || s.email,
                    }))
                  ]}
                  selectedValue={selectedStaff}
                  onValueChange={setSelectedStaff}
                  placeholder={
                    (isStaff ? filteredStaff : tabFilteredStaff).length === 0 
                      ? (activeTab === 'clockin' 
                          ? 'All staff have clocked in' 
                          : 'No staff to clock out')
                      : 'Select staff member'
                  }
                  style={styles.dropdown}
                  disabled={!(hasManagerAccess || hasExecutiveAccess || isSupervisor) || (!!locationVerified && !overrideMode)}
                  searchPlaceholder="Search by name or employee ID..."
                  getSearchText={(option) => {
                    if (!option || option.value === '') return '';
                    const name = option.name || option.label || '';
                    const empNo = option.empNo ? String(option.empNo) : '';
                    return `${name} ${empNo}`.toLowerCase();
                  }}
                />
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {currentUserProfile?.fullName || currentUserProfile?.name || 'You'}
                </Text>
                <Text style={styles.infoSubtext}>
                  {isSupervisor && clockAsSupervisor ? 'Clock in/out as supervisor' : 'Clock in/out for yourself'}
                </Text>
              </View>
            )}

            {isSupervisor && (
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Clock as Supervisor</Text>
                <Switch
                  value={clockAsSupervisor}
                  onValueChange={(v) => {
                    const val = Boolean(v);
                    setClockAsSupervisor(val);
                    if (val) {
                      // set selectedStaff to supervisor's own id
                      setSelectedStaff(currentUserProfile?.user_id || '');
                    } else {
                      // clear selection when toggled off
                      setSelectedStaff('');
                    }
                  }}
                />
              </View>
            )}

            {(isManager || isGeneralManager) && (
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Attendance Override</Text>
                <Switch
                  value={overrideMode}
                  onValueChange={(v) => {
                    const val = Boolean(v);
                    setOverrideMode(val);
                    if (val) {
                      // When enabling override mode, reload locations to show locations with staff from user's department
                      loadInitialData();
                      // Clear staff selection to allow selecting others
                      setSelectedStaff('');
                    } else {
                      // When disabling, filter back to office locations if Manager/GM
                      if (isManagerOrGM) {
                        const officeLocations = allLocations.filter(l => isOfficeLocation(l));
                        setLocations(officeLocations);
                        if (officeLocations.length > 0) setCurrentLocationId(officeLocations[0].id);
                        // Set staff back to themselves
                        const meId = currentUserProfile?.user_id;
                        if (meId) {
                          setSelectedStaff(meId);
                          setCurrentSupervisorId(meId);
                        }
                      }
                    }
                    setLocationVerified(false); // Reset location verification when toggling
                  }}
                />
              </View>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Overtime</Text>
              <Switch value={overtime} onValueChange={setOvertime} />
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Double Duty</Text>
              <Switch value={doubleDuty} onValueChange={setDoubleDuty} />
            </View>

            <View style={styles.buttonRow}>
              {/* Show Clock In button when in clockin tab or for staff (who see both) */}
              {(activeTab === 'clockin' || isStaff) && (
                <AnimatedButton
                  colors={['#2ecc71', '#27ae60']}
                  onPress={handleClockIn}
                  disabled={loading || (!overrideMode && !locationVerified)}
                  style={!isStaff ? styles.fullWidthButton : undefined}
                >
                  <Text style={styles.clockButtonText}>
                    {loading ? 'Processing...' : 'Clock In'}
                  </Text>
                </AnimatedButton>
              )}

              {/* Show Clock Out button when in clockout tab or for staff (who see both) */}
              {(activeTab === 'clockout' || isStaff) && (
                <AnimatedButton
                  colors={['#ff6b6b', '#c0392b']}
                  onPress={handleClockOut}
                  disabled={loading || (!overrideMode && !locationVerified)}
                  style={!isStaff ? styles.fullWidthButton : undefined}
                >
                  <Text style={styles.clockButtonText}>
                    {loading ? 'Processing...' : 'Clock Out'}
                  </Text>
                </AnimatedButton>
              )}
            </View>
          </CardContent>
        </Card>
        )}

        {/* Today's Attendance - Visible for all roles */}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>All staff with clock-in or clock-out</CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {todayAttendance.length === 0 ? (
              <Text style={styles.emptyText}>No records for today.</Text>
            ) : (
              todayAttendance.map(record => {
                // Look for the person in both staff and supervisors arrays
                const person = staff.find(s => s.user_id === record.staffId) ||
                              supervisors.find(s => s.user_id === record.staffId);
                const sup = supervisors.find(s => s.user_id === record.supervisorId);
                const loc = allLocations.find(l => l.id === record.nc_location_id);
                return (
                  <View key={record.id} style={styles.attendanceItem}>
                    <View style={styles.attendanceInfo}>
                      <Text style={styles.staffName}>{person?.name || record.staffName || record.staffId}</Text>
                      <Text style={styles.locationText}>{loc?.name || record.nc || record.nc_location_id}</Text>
                      <Text style={styles.supervisorText}>Supervisor: {record.supervisorName || sup?.name || record.supervisorId}</Text>
                      {(record.clockedInBy || record.clockedOutBy) && (
                        <Text style={styles.overrideText}>
                          {record.clockedInBy && `Clock-in by: ${record.clockedInBy}`}
                          {record.clockedInBy && record.clockedOutBy && ' | '}
                          {record.clockedOutBy && `Clock-out by: ${record.clockedOutBy}`}
                        </Text>
                      )}
                    </View>
                    <View style={styles.attendanceStatus}>
                      <Text style={[
                        styles.statusText,
                        {
                          color: record.status === 'present' || record.status === 'Present' ? '#28a745' :
                                 record.status === 'late' || record.status === 'Late' ? '#ffc107' : '#dc3545'
                        }
                      ]}>
                        {record.status?.toUpperCase() || 'PENDING'}
                      </Text>
                      {record.clockIn && (
                        <Text style={styles.timeText}>
                          In: {new Date(record.clockIn).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                      {record.clockOut && (
                        <Text style={styles.timeText}>
                          Out: {new Date(record.clockOut).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <CameraCapture
          onPhotoTaken={handlePhotoTaken}
          onClose={() => setShowCamera(false)}
          title={`Take Photo for ${cameraType === 'clock_in' ? 'Clock In' : 'Clock Out'}`}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    zIndex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
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
  card: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  verifyButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  verifiedButton: {
    backgroundColor: '#6c757d',
  },
  verifyingButton: {
    backgroundColor: '#007AFF',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationStatusContainer: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  verificationStatusText: {
    color: '#1565c0',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  animatedButtonWrapper: {
    flex: 1,
  },
  animatedButtonContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  animatedButtonDisabled: {
    opacity: 0.6,
  },
  animatedButtonPressed: {
    opacity: 0.9,
  },
  gradientBackground: {
    padding: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  clockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  attendanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  attendanceInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  supervisorText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  attendanceStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  overrideInfoBox: {
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginTop: 8,
  },
  overrideInfoText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  overrideText: {
    fontSize: 11,
    color: '#ff6b6b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  fullWidthButton: {
    flex: 1,
  },
});

export default MarkAttendanceScreen;
