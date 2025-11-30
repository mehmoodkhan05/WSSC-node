import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchLocations } from '../lib/locations';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
} from '../lib/roles';

const MapScreen = () => {
  const { profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setError(null);
        const locs = await fetchLocations();
        setLocations(locs || []);
      } catch (err) {
        console.error('Error loading locations on web:', err);
        setError('Failed to load locations');
      } finally {
        setLoading(false);
      }
    };

    loadLocations();
  }, []);

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

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Map unavailable on web</Text>
        <Text style={styles.noticeText}>
          The interactive map relies on native modules that are not supported in
          the browser. Please open the mobile or desktop app build (Android/iOS)
          to use live tracking and geofencing tools.
        </Text>
      </View>

      <View style={styles.locationList}>
        <Text style={styles.sectionTitle}>Work Locations</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading locations...</Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
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
                <View key={location.id} style={styles.locationCard}>
                  <Text style={styles.locationName}>{location.name}</Text>
                  <Text style={styles.locationCode}>{location.code}</Text>
                  <Text style={styles.locationRadius}>
                    Radius: {location.radius_meters}m
                  </Text>
                  <Text style={styles.locationCoords}>
                    {location.center_lat.toFixed(5)},{' '}
                    {location.center_lng.toFixed(5)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
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
  noticeCard: {
    backgroundColor: '#fff7e6',
    borderColor: '#ffe4b5',
    borderWidth: 1,
    padding: 16,
    margin: 16,
    borderRadius: 10,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#a15c00',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#a15c00',
    lineHeight: 20,
  },
  locationList: {
    backgroundColor: 'white',
    padding: 16,
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
  errorText: {
    textAlign: 'center',
    color: '#c53030',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  locationScroll: {
    maxHeight: 240,
  },
  locationScrollContent: {
    paddingBottom: 8,
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
  locationCoords: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MapScreen;

