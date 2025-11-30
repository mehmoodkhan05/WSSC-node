import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { fetchLocations } from '../lib/locations';
import { fetchLiveLocations } from '../lib/liveTracking';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
} from '../lib/roles';
import {
  fetchAssignments,
  fetchSupervisorLocations,
} from '../lib/assignments';
import { fetchSupervisors } from '../lib/staff';

const buildLocationStats = (
  locations = [],
  assignments = [],
  supervisorMappings = [],
  supervisors = [],
) => {
  const stats = {};
  const supervisorLookup = supervisors.reduce((acc, sup) => {
    if (sup?.user_id) {
      const name =
        sup.full_name || sup.name || sup.email || sup.user_id || 'Supervisor';
      acc[sup.user_id] = name;
    }
    return acc;
  }, {});

  locations.forEach((location) => {
    if (location?.id) {
      stats[location.id] = {
        staffCount: 0,
        supervisorCount: 0,
        supervisorNames: [],
      };
    }
  });

  assignments.forEach((assignment) => {
    const locationId = assignment?.nc_location_id;
    if (!locationId) return;
    if (!stats[locationId]) {
      stats[locationId] = {
        staffCount: 0,
        supervisorCount: 0,
        supervisorNames: [],
      };
    }
    stats[locationId].staffCount += 1;
  });

  supervisorMappings.forEach((mapping) => {
    const locationId = mapping?.nc_location_id;
    const supervisorId = mapping?.supervisor_id;
    const supervisorName = supervisorLookup[supervisorId];
    if (!locationId) return;
    if (!stats[locationId]) {
      stats[locationId] = {
        staffCount: 0,
        supervisorCount: 0,
        supervisorNames: [],
      };
    }
    stats[locationId].supervisorCount += 1;
    if (supervisorName) {
      const names = stats[locationId].supervisorNames;
      if (!names.includes(supervisorName)) {
        names.push(supervisorName);
      }
    }
  });

  return stats;
};

const MapScreen = () => {
  const { profile } = useAuth();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationStats, setLocationStats] = useState({});
  const [mapRegion, setMapRegion] = useState({
    latitude: 34.7595, // Mingora, Swat coordinates
    longitude: 72.3588,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation(location.coords);
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }

      const assignmentsPromise = fetchAssignments().catch((err) => {
        console.error('Error fetching assignments for map view:', err);
        return [];
      });
      const supervisorMappingsPromise = fetchSupervisorLocations().catch(
        (err) => {
          console.error(
            'Error fetching supervisor-location mappings for map view:',
            err,
          );
          return [];
        },
      );
      const supervisorsPromise = fetchSupervisors().catch((err) => {
        console.error('Error fetching supervisors for map view:', err);
        return [];
      });

      // Load locations
      const locs = await fetchLocations();
      setLocations(locs || []);

      const [assignmentData, supervisorLocationData, supervisorData] =
        await Promise.all([
          assignmentsPromise,
          supervisorMappingsPromise,
          supervisorsPromise,
        ]);
      setLocationStats(
        buildLocationStats(
          locs || [],
          assignmentData,
          supervisorLocationData,
          supervisorData,
        ),
      );
    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Error', 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const loadLiveLocations = async () => {
    try {
      const liveLocs = await fetchLiveLocations();
      setLiveLocations(liveLocs || []);
    } catch (error) {
      console.error('Error loading live locations:', error);
    }
  };

  const toggleLiveTracking = async () => {
    if (!showLiveTracking) {
      await loadLiveLocations();
    }
    setShowLiveTracking(!showLiveTracking);
  };

  const centerOnLocation = (location) => {
    setMapRegion({
      latitude: location.center_lat,
      longitude: location.center_lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setSelectedLocation(location);
  };

  const centerOnCurrentLocation = () => {
    if (currentLocation) {
      setMapRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const canAccessMap = hasFieldLeadershipPrivileges(role);

  if (!canAccessMap) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Denied</Text>
        <Text style={styles.accessDeniedSubtext}>
          Only supervisors and leadership roles can access the map
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>Track locations and staff</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {/* Work Location Markers */}
          {locations.map((location) => (
            <React.Fragment key={location.id}>
              <Marker
                coordinate={{
                  latitude: location.center_lat,
                  longitude: location.center_lng,
                }}
                title={location.name}
                description={location.code}
                pinColor="blue"
                onPress={() => setSelectedLocation(location)}
              />
              <Circle
                center={{
                  latitude: location.center_lat,
                  longitude: location.center_lng,
                }}
                radius={location.radius_meters}
                strokeColor="rgba(0, 122, 255, 0.3)"
                fillColor="rgba(0, 122, 255, 0.1)"
              />
            </React.Fragment>
          ))}

          {/* Live Staff Locations */}
          {showLiveTracking &&
            liveLocations.map((staff) => (
              <Marker
                key={staff.user_id}
                coordinate={{
                  latitude: staff.latitude,
                  longitude: staff.longitude,
                }}
                title={staff.name}
                description={`Last updated: ${new Date(
                  staff.timestamp,
                ).toLocaleTimeString()}`}
                pinColor="green"
              />
            ))}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnCurrentLocation}
          >
            <Text style={styles.controlButtonText}>📍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              showLiveTracking && styles.activeControlButton,
            ]}
            onPress={toggleLiveTracking}
          >
            <Text style={styles.controlButtonText}>👥</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location List */}
      <View style={styles.locationList}>
        <Text style={styles.sectionTitle}>Work Locations</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading locations...</Text>
        ) : locations.length === 0 ? (
          <Text style={styles.emptyText}>No locations configured</Text>
        ) : (
          <ScrollView
            style={styles.locationScroll}
            contentContainerStyle={styles.locationScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.locationGrid}>
              {locations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationCard,
                    selectedLocation?.id === location.id &&
                      styles.selectedLocationCard,
                  ]}
                  onPress={() => centerOnLocation(location)}
                >
                  <Text style={styles.locationName}>{location.name}</Text>
                  <Text style={styles.locationCode}>{location.code}</Text>
                  <Text style={styles.locationRadius}>
                    Radius: {location.radius_meters}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Selected Location Details */}
      {selectedLocation && (
        <View style={styles.detailsPanel}>
          <Text style={styles.detailsTitle}>{selectedLocation.name}</Text>
          <Text style={styles.detailsCode}>{selectedLocation.code}</Text>
          <Text style={styles.detailsCoords}>
            {selectedLocation.center_lat.toFixed(6)},{' '}
            {selectedLocation.center_lng.toFixed(6)}
          </Text>
          <Text style={styles.detailsRadius}>
            Geofence Radius: {selectedLocation.radius_meters} meters
          </Text>
          <Text style={styles.detailsStat}>
            Supervisors Assigned:{' '}
            {locationStats[selectedLocation.id]?.supervisorCount ?? 0}
          </Text>
          <Text style={styles.detailsStat}>
            Supervisor Names:{' '}
            {locationStats[selectedLocation.id]?.supervisorNames?.length
              ? locationStats[selectedLocation.id].supervisorNames.join(', ')
              : '—'}
          </Text>
          <Text style={styles.detailsStat}>
            Staff Assigned:{' '}
            {locationStats[selectedLocation.id]?.staffCount ?? 0}
          </Text>
        </View>
      )}
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
    top: 10,
    right: 10,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  activeControlButton: {
    backgroundColor: '#007AFF',
  },
  controlButtonText: {
    fontSize: 20,
  },
  locationList: {
    backgroundColor: 'white',
    padding: 16,
  },
  locationScroll: {
    maxHeight: 200,
  },
  locationScrollContent: {
    paddingBottom: 8,
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
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedLocationCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  locationCode: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  locationRadius: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  detailsPanel: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailsCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detailsCoords: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  detailsRadius: {
    fontSize: 12,
    color: '#999',
  },
  detailsStat: {
    fontSize: 13,
    color: '#333',
    marginTop: 6,
  },
});

export default MapScreen;

