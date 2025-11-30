import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { fetchLiveLocations } from '../lib/liveTracking';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
  hasExecutivePrivileges,
  hasFullControl,
} from '../lib/roles';

const LiveTrackingScreen = () => {
  const { profile } = useAuth();
  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const hasLeadershipAccess = hasFieldLeadershipPrivileges(role);
  const hasOrgWideVisibility = hasExecutivePrivileges(role) || hasFullControl(role);

  const [staffLocations, setStaffLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasLeadershipAccess) {
      loadStaffLocations();
    } else {
      setLoading(false);
    }
  }, [hasLeadershipAccess]);

  const loadStaffLocations = async () => {
    try {
      setError(null);
      const locations = await fetchLiveLocations();
      setStaffLocations(Array.isArray(locations) ? locations : []);
    } catch (err) {
      console.error('Error loading live tracking data on web:', err);
      setError('Failed to load live tracking data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStaffLocations();
  };

  if (!hasLeadershipAccess) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Restricted</Text>
        <Text style={styles.accessDeniedSubtext}>
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
          Browser view is informational only. To see the interactive map with
          live routes and controls, please use the mobile or desktop native app build.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Feather name="map-pin" size={22} color="#92400e" />
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>Map unavailable on web</Text>
          <Text style={styles.noticeText}>
            The live-tracking map relies on native device capabilities (Google
            Maps / Apple Maps + background location). Expo Web cannot load these
            modules, so we display the staff list and latest coordinates here.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.staffList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>
          {hasOrgWideVisibility ? 'Organization Locations' : 'Team Locations'}
        </Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading staff locations...</Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : staffLocations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📍</Text>
            <Text style={styles.emptyStateText}>No staff locations available</Text>
            <Text style={styles.emptyStateSubtext}>
              Staff need to enable location sharing to appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.staffGrid}>
            {staffLocations.map((staff) => (
              <View key={staff.user_id} style={styles.staffCard}>
                <View style={styles.staffHeader}>
                  <Text style={styles.staffName}>{staff.name || 'Unknown staff'}</Text>
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor:
                          (staff.status || '').toLowerCase() === 'active'
                            ? '#22c55e'
                            : '#dc2626',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.lastUpdate}>
                  Last update:{' '}
                  {staff.timestamp ? new Date(staff.timestamp).toLocaleTimeString() : 'N/A'}
                </Text>
                <Text style={styles.coordinates}>
                  {Number.isFinite(staff.latitude) ? staff.latitude.toFixed(5) : '—'},{' '}
                  {Number.isFinite(staff.longitude) ? staff.longitude.toFixed(5) : '—'}
                </Text>
                {Number.isFinite(staff.speed) ? (
                  <Text style={styles.speed}>Speed: {staff.speed.toFixed(1)} km/h</Text>
                ) : null}
              </View>
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
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    margin: 16,
    padding: 16,
    borderRadius: 10,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  staffList: {
    backgroundColor: 'white',
    padding: 16,
    paddingBottom: 120,
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
    color: '#dc2626',
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
    gap: 12,
  },
  staffCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#00000011',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#111',
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
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  speed: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 4,
  },
});

export default LiveTrackingScreen;

