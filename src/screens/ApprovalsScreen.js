import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchPendingApprovals, approveAttendance, rejectAttendance } from '../lib/approvals';
import apiClient from '../lib/apiClient';
import {
  ROLE,
  normalizeRole,
  hasManagementPrivileges,
  hasFullControl,
} from '../lib/roles';

const ApprovalsScreen = () => {
  const { profile } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      const approvals = await fetchPendingApprovals();
      setPendingApprovals(approvals || []);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
      Alert.alert('Error', 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingApprovals();
    setRefreshing(false);
  };

  const handleApprove = async (attendanceId) => {
    try {
      const currentUser = await apiClient.getUser();
      const approvedById = currentUser ? (currentUser.user_id || currentUser.id) : null;
      await approveAttendance(attendanceId, approvedById);
      Alert.alert('Success', 'Attendance approved');
      await loadPendingApprovals();
    } catch (error) {
      console.error('Approve error:', error);
      Alert.alert('Error', error.message || 'Failed to approve attendance');
    }
  };

  const handleReject = async (attendanceId) => {
    Alert.alert(
      'Reject Attendance',
      'Are you sure you want to reject this attendance record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = await apiClient.getUser();
              const approvedById = currentUser ? (currentUser.user_id || currentUser.id) : null;
              await rejectAttendance(attendanceId, approvedById);
              Alert.alert('Success', 'Attendance rejected');
              await loadPendingApprovals();
            } catch (error) {
              console.error('Reject error:', error);
              Alert.alert('Error', error.message || 'Failed to reject attendance');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#28a745';
      case 'late': return '#ffc107';
      case 'absent': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const canApprove = hasManagementPrivileges(role) || hasFullControl(role);

  if (!canApprove) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Denied</Text>
        <Text style={styles.accessDeniedSubtext}>
          Only management roles can access attendance approvals
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Approvals</Text>
        <Text style={styles.subtitle}>Review and approve pending attendance records</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Approvals</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : pendingApprovals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✅</Text>
            <Text style={styles.emptyStateText}>No pending approvals</Text>
            <Text style={styles.emptyStateSubtext}>All records have been reviewed</Text>
          </View>
        ) : (
          pendingApprovals.map(record => (
            <View key={record.id} style={styles.approvalItem}>
              <View style={styles.recordHeader}>
                <Text style={styles.staffName}>{record.staff_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>
                  <Text style={styles.statusText}>{record.status?.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.location}>{record.nc_location_name || record.nc}</Text>

              <View style={styles.timeInfo}>
                <Text style={styles.date}>
                  {new Date(record.attendance_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>

                {record.clock_in && (
                  <Text style={styles.time}>
                    Clock In: {new Date(record.clock_in).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                )}

                {record.clock_out && (
                  <Text style={styles.time}>
                    Clock Out: {new Date(record.clock_out).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                )}
              </View>

              {record.notes && (
                <Text style={styles.notes}>Notes: {record.notes}</Text>
              )}

              <View style={styles.flags}>
                {record.overtime && <Text style={styles.flag}>Overtime</Text>}
                {record.double_duty && <Text style={styles.flag}>Double Duty</Text>}
              </View>

              {/* Photo Verification Section */}
              {(record.clock_in_photo_url || record.clock_out_photo_url) && (
                <View style={styles.photoSection}>
                  <Text style={styles.photoSectionTitle}>Verification Photos</Text>
                  <View style={styles.photoGrid}>
                    {record.clock_in_photo_url && (
                      <TouchableOpacity
                        style={styles.photoContainer}
                        onPress={() => setSelectedPhotoUrl(record.clock_in_photo_url)}
                      >
                        <Image
                          source={{ uri: record.clock_in_photo_url }}
                          style={styles.photoThumbnail}
                          resizeMode="cover"
                        />
                        <Text style={styles.photoLabel}>Clock In</Text>
                        {record.clock_in && (
                          <Text style={styles.photoTime}>
                            {new Date(record.clock_in).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {record.clock_out_photo_url && (
                      <TouchableOpacity
                        style={styles.photoContainer}
                        onPress={() => setSelectedPhotoUrl(record.clock_out_photo_url)}
                      >
                        <Image
                          source={{ uri: record.clock_out_photo_url }}
                          style={styles.photoThumbnail}
                          resizeMode="cover"
                        />
                        <Text style={styles.photoLabel}>Clock Out</Text>
                        {record.clock_out && (
                          <Text style={styles.photoTime}>
                            {new Date(record.clock_out).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleApprove(record.id)}
                >
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReject(record.id)}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Full Screen Photo Modal */}
      <Modal visible={!!selectedPhotoUrl} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedPhotoUrl(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            {selectedPhotoUrl && (
              <Image
                source={{ uri: selectedPhotoUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  section: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  approvalItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timeInfo: {
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  flags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  flag: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  photoSection: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  photoContainer: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  photoThumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  photoTime: {
    fontSize: 11,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
    borderRadius: 8,
  },
});

export default ApprovalsScreen;
