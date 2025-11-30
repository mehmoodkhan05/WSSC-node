import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchLiveLocations,
  startLocationTracking,
  stopLocationTracking,
} from '../lib/liveTracking';
import { hasActiveClockIn } from '../lib/attendance';
import { Feather } from '@expo/vector-icons';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
  hasExecutivePrivileges,
  hasFullControl,
} from '../lib/roles';

const DEFAULT_REGION = {
  latitude: 34.7595,
  longitude: 72.3588,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const LiveTrackingScreen = () => {
  const { profile } = useAuth();
  const [staffLocations, setStaffLocations] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const isSupervisor = role === ROLE.SUPERVISOR;
  const hasLeadershipAccess = hasFieldLeadershipPrivileges(role);
  const hasOrgWideVisibility = hasExecutivePrivileges(role) || hasFullControl(role);
  const mapRef = useRef(null);
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!isSupervisor) {
      return;
    }

    let cancelled = false;

    const ensureTrackingActive = async () => {
      try {
        const activeShift = await hasActiveClockIn();
        if (cancelled) {
          return;
        }

        if (!activeShift) {
          try {
            await stopLocationTracking();
          } catch (stopError) {
            console.error(
              'Failed to stop live tracking for inactive supervisor:',
              stopError,
            );
          }
          return;
        }

        const foregroundPermission = await Location.getForegroundPermissionsAsync();
        let status = foregroundPermission.status;

        if (status !== 'granted') {
          const request = await Location.requestForegroundPermissionsAsync();
          status = request.status;
        }

        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Live tracking needs location access to stay active.',
          );
          return;
        }

        if (Platform.OS === 'android') {
          try {
            const backgroundPermission =
              await Location.getBackgroundPermissionsAsync();
            if (backgroundPermission.status !== 'granted') {
              await Location.requestBackgroundPermissionsAsync();
            }
          } catch (error) {
            console.warn('Background permission request failed:', error);
          }
        }

        if (!cancelled) {
          const started = await startLocationTracking();
          if (!started) {
            try {
              await stopLocationTracking();
            } catch (stopError) {
              console.error(
                'Failed to stop live tracking after unsuccessful start:',
                stopError,
              );
            }
          }
        }
      } catch (error) {
        console.error('Failed to ensure live tracking:', error);
      }
    };

    ensureTrackingActive();

    return () => {
      cancelled = true;
    };
  }, [isSupervisor]);

  const loadInitialData = async () => {
    if (!hasLeadershipAccess) {
      setStaffLocations([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await loadStaffLocations();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffLocations = async () => {
    if (!hasLeadershipAccess) {
      setStaffLocations([]);
      return;
    }
    try {
      setStaffLocations([]);
      setSelectedStaff(null);
      const locations = await fetchLiveLocations();
      const processedLocations = Array.isArray(locations)
        ? locations.filter((location) => {
            if (!location) {
              return false;
            }
            if (hasOrgWideVisibility) {
              const status = (
                location.status ||
                location.isActive ||
                ''
              ).toString().toLowerCase();
              if (status && status !== 'true' && status !== 'active') {
                return false;
              }
            }
            if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
              return isSupervisor || hasOrgWideVisibility;
            }
            return true;
          })
        : [];

      setStaffLocations(processedLocations);
    } catch (error) {
      console.error('Error loading staff locations:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStaffLocations();
    setRefreshing(false);
  };

  const recenterOnUser = async () => {
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
          'Location access is required to center on your position.',
        );
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = currentPosition.coords;

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400,
      );
    } catch (error) {
      console.error('Error recentering map:', error);
      Alert.alert('Error', 'Unable to locate your current position.');
    }
  };

  const centerOnStaff = (staff) => {
    const targetRegion = {
      latitude: staff.latitude,
      longitude: staff.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    mapRef.current?.animateToRegion(targetRegion, 400);
    setSelectedStaff(staff);
  };

  if (!hasLeadershipAccess) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Restricted</Text>
        <Text style={[styles.accessDeniedSubtext, { marginTop: 8 }]}>
          Live tracking is available to supervisors and leadership roles.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Tracking</Text>
        <Text style={styles.subtitle}>
          {hasOrgWideVisibility
            ? 'Monitor live activity across the organization'
            : 'View your assigned team members in real-time'}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={true}
          showsMyLocationButton={!isAndroid}
          showsCompass={true}
          zoomControlEnabled
          zoomTapEnabled
          toolbarEnabled
        >
          {staffLocations
            .filter(
              (staff) =>
                Number.isFinite(staff?.latitude) &&
                Number.isFinite(staff?.longitude),
            )
            .map((staff) => (
              <Marker
                key={staff.user_id}
                coordinate={{
                  latitude: staff.latitude,
                  longitude: staff.longitude,
                }}
                title={staff.name}
                description={`Last updated: ${
                  staff.timestamp
                    ? new Date(staff.timestamp).toLocaleTimeString()
                    : 'N/A'
                }`}
                pinColor={
                  hasFieldLeadershipPrivileges(
                    normalizeRole(
                      staff.role ||
                        staff.userRole ||
                        staff.roleName ||
                        staff.statusRole ||
                        staff.position ||
                        '',
                    ),
                  )
                    ? '#22c55e'
                    : '#ef4444'
                }
              />
            ))}
          {hasOrgWideVisibility &&
            staffLocations
              .filter(
                (staff) =>
                  Array.isArray(staff?.route) &&
                  staff.route.length >= 2 &&
                  staff.route.every(
                    (point) =>
                      Number.isFinite(point?.latitude) &&
                      Number.isFinite(point?.longitude),
                  ),
              )
              .map((staff) => (
                <Polyline
                  key={`${staff.user_id}-route`}
                  coordinates={staff.route.map((point) => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }))}
                  strokeColor={
                    selectedStaff?.user_id === staff.user_id
                      ? '#2563eb'
                      : '#38bdf8'
                  }
                  strokeWidth={selectedStaff?.user_id === staff.user_id ? 4 : 3}
                  lineDashPattern={
                    selectedStaff?.user_id === staff.user_id ? undefined : [6, 4]
                  }
                />
              ))}
        </MapView>

        <View
          style={[
            styles.mapControls,
            isAndroid ? styles.mapControlsAndroid : styles.mapControlsDefault,
          ]}
          pointerEvents="box-none"
        >
          {isAndroid && (
            <TouchableOpacity
              style={styles.roundButton}
              onPress={recenterOnUser}
              accessibilityRole="button"
              accessibilityLabel="Center map on my location"
              activeOpacity={0.85}
            >
              <Feather name="navigation" size={18} color="#0f172a" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.roundButton, styles.refreshButton]}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh live locations"
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Staff List */}
      <ScrollView
        style={styles.staffList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionTitle}>
          {hasOrgWideVisibility ? 'Organization Locations' : 'Team Locations'}
        </Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading staff locations...</Text>
        ) : staffLocations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📍</Text>
            <Text style={styles.emptyStateText}>No staff locations available</Text>
            <Text style={styles.emptyStateSubtext}>
              Staff need to enable location sharing to appear here
            </Text>
          </View>
        ) : (
          <View style={styles.staffGrid}>
            {staffLocations.map((staff) => (
              <TouchableOpacity
                key={staff.user_id}
                style={[
                  styles.staffCard,
                  selectedStaff?.user_id === staff.user_id &&
                    styles.selectedStaffCard,
                ]}
                onPress={() => centerOnStaff(staff)}
              >
                <View style={styles.staffHeader}>
                  <Text style={styles.staffName}>{staff.name}</Text>
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor:
                          staff.status === 'active' ? '#28a745' : '#dc3545',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.lastUpdate}>
                  Last update: {new Date(staff.timestamp).toLocaleTimeString()}
                </Text>

                <Text style={styles.coordinates}>
                  {Number.isFinite(staff.latitude)
                    ? staff.latitude.toFixed(6)
                    : '—'}
                  ,{' '}
                  {Number.isFinite(staff.longitude)
                    ? staff.longitude.toFixed(6)
                    : '—'}
                </Text>

                {Number.isFinite(staff.speed) ? (
                  <Text style={styles.speed}>
                    Speed: {staff.speed.toFixed(1)} km/h
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 15,
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    gap: 12,
  },
  mapControlsDefault: {
    top: 12,
  },
  mapControlsAndroid: {
    top: 12,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  refreshButton: {
    backgroundColor: '#f8fafc',
  },
  staffList: {
    backgroundColor: 'white',
    padding: 15,
    paddingBottom: 100,
    maxHeight: 250,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  staffGrid: {
    gap: 8,
  },
  staffCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedStaffCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  coordinates: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  speed: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default LiveTrackingScreen;

