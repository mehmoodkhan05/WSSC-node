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
import { 
  fetchPendingApprovals, 
  approveAttendance, 
  rejectAttendance,
  fetchPendingOvertimeDoubleDuty,
  approveOvertime,
  rejectOvertime,
  approveDoubleDuty,
  rejectDoubleDuty
} from '../lib/approvals';
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
  const [pendingOvertimeDD, setPendingOvertimeDD] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'overtime'
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserDepartments, setCurrentUserDepartments] = useState([]); // For GMs with multiple departments

  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const isManagerRole = role === ROLE.MANAGER;
  const isGeneralManagerRole = role === ROLE.GENERAL_MANAGER;
  const isCEORole = role === ROLE.CEO;
  const isSuperAdminRole = role === ROLE.SUPER_ADMIN;

  useEffect(() => {
    loadAllApprovals();
  }, []);

  const loadAllApprovals = async () => {
    try {
      setLoading(true);
      
      // Get current user ID and departments
      const currentUser = await apiClient.getUser();
      const userId = currentUser ? (currentUser.user_id || currentUser.id) : null;
      const userDepts = currentUser?.departments || [];
      setCurrentUserId(userId);
      setCurrentUserDepartments(userDepts);
      
      const [approvals, overtimeDD] = await Promise.all([
        fetchPendingApprovals(),
        fetchPendingOvertimeDoubleDuty()
      ]);
      setPendingApprovals(approvals || []);
      setPendingOvertimeDD(overtimeDD || []);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
      Alert.alert('Error', 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    await loadAllApprovals();
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

  // Helper to check if a department is in GM's assigned departments
  const isInMyDepartments = (dept) => {
    if (!dept) return true; // If no department, show it (can't filter)
    
    // For GMs with multiple departments, check against the departments array
    if (isGeneralManagerRole && currentUserDepartments && currentUserDepartments.length > 0) {
      const normalizedDept = dept.toLowerCase().trim();
      return currentUserDepartments.some(d => 
        d && d.toLowerCase().trim() === normalizedDept
      );
    }
    
    // For single department users (use profile.department)
    const currentUserDept = profile?.department;
    if (!currentUserDept) return true; // If current user has no department, show all
    return dept.toLowerCase().trim() === currentUserDept.toLowerCase().trim();
  };

  // Check if current user can approve this overtime/double duty request based on reporting chain
  const canApproveOvertimeDD = (record) => {
    if (!currentUserId) return false;
    
    if (isCEORole || isSuperAdminRole) {
      // CEO/Super Admin can approve all
      return true;
    }
    
    if (isManagerRole) {
      // Manager can only approve requests from their direct reports
      // Check if staff's manager or supervisor's manager is current user
      return record.staff_manager_id === currentUserId || 
             record.supervisor_manager_id === currentUserId ||
             record.marked_by_manager_id === currentUserId;
    }
    
    if (isGeneralManagerRole) {
      // GM can approve ALL requests from their assigned department(s)
      return isInMyDepartments(record.staff_department);
    }
    
    return false;
  };

  // Filter overtime/DD records based on reporting chain
  const getFilteredOvertimeDD = () => {
    if (!currentUserId) return [];
    
    if (isCEORole || isSuperAdminRole) {
      // See all
      return pendingOvertimeDD;
    }
    
    return pendingOvertimeDD.filter(record => {
      if (isManagerRole) {
        // Only see requests from their team
        return record.staff_manager_id === currentUserId || 
               record.supervisor_manager_id === currentUserId ||
               record.marked_by_manager_id === currentUserId;
      }
      
      if (isGeneralManagerRole) {
        // GM sees ALL requests from their assigned department(s)
        return isInMyDepartments(record.staff_department);
      }
      
      return false;
    });
  };

  const filteredOvertimeDD = getFilteredOvertimeDD();

  // Overtime/Double Duty approval handlers
  const handleApproveOvertime = async (attendanceId) => {
    try {
      await approveOvertime(attendanceId);
      Alert.alert('Success', 'Overtime approved');
      await loadAllApprovals();
    } catch (error) {
      console.error('Approve overtime error:', error);
      Alert.alert('Error', error.message || 'Failed to approve overtime');
    }
  };

  const handleRejectOvertime = async (attendanceId) => {
    Alert.alert(
      'Reject Overtime',
      'Are you sure you want to reject this overtime request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectOvertime(attendanceId);
              Alert.alert('Success', 'Overtime rejected');
              await loadAllApprovals();
            } catch (error) {
              console.error('Reject overtime error:', error);
              Alert.alert('Error', error.message || 'Failed to reject overtime');
            }
          }
        }
      ]
    );
  };

  const handleApproveDoubleDuty = async (attendanceId) => {
    try {
      await approveDoubleDuty(attendanceId);
      Alert.alert('Success', 'Double duty approved');
      await loadAllApprovals();
    } catch (error) {
      console.error('Approve double duty error:', error);
      Alert.alert('Error', error.message || 'Failed to approve double duty');
    }
  };

  const handleRejectDoubleDuty = async (attendanceId) => {
    Alert.alert(
      'Reject Double Duty',
      'Are you sure you want to reject this double duty request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectDoubleDuty(attendanceId);
              Alert.alert('Success', 'Double duty rejected');
              await loadAllApprovals();
            } catch (error) {
              console.error('Reject double duty error:', error);
              Alert.alert('Error', error.message || 'Failed to reject double duty');
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
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.subtitle}>Review and approve pending requests</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
            Attendance ({pendingApprovals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overtime' && styles.tabActive]}
          onPress={() => setActiveTab('overtime')}
        >
          <Text style={[styles.tabText, activeTab === 'overtime' && styles.tabTextActive]}>
            Overtime/DD ({filteredOvertimeDD.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Attendance Approvals Tab */}
      {activeTab === 'attendance' && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Attendance Approvals</Text>

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
      )}

      {/* Overtime/Double Duty Approvals Tab */}
      {activeTab === 'overtime' && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Overtime & Double Duty</Text>
        <Text style={styles.sectionSubtitle}>Requests marked by supervisors for approval</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : filteredOvertimeDD.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✅</Text>
            <Text style={styles.emptyStateText}>No pending requests</Text>
            <Text style={styles.emptyStateSubtext}>All overtime/double duty requests have been reviewed</Text>
          </View>
        ) : (
          filteredOvertimeDD.map(record => (
            <View key={record.id} style={styles.approvalItem}>
              <View style={styles.recordHeader}>
                <Text style={styles.staffName}>{record.staff_name}</Text>
                <View style={styles.requestTypeBadges}>
                  {record.overtime_approval_status === 'pending' && (
                    <View style={[styles.typeBadge, styles.overtimeBadge]}>
                      <Text style={styles.typeBadgeText}>OVERTIME</Text>
                    </View>
                  )}
                  {record.double_duty_approval_status === 'pending' && (
                    <View style={[styles.typeBadge, styles.doubleDutyBadge]}>
                      <Text style={styles.typeBadgeText}>DOUBLE DUTY</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.location}>{record.location_name}</Text>

              <View style={styles.timeInfo}>
                <Text style={styles.date}>
                  {new Date(record.date).toLocaleDateString('en-US', {
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

              {record.marked_by_supervisor && (
                <Text style={styles.markedBy}>
                  Marked by: {record.marked_by_supervisor}
                </Text>
              )}

              {/* Overtime Actions */}
              {record.overtime_approval_status === 'pending' && (
                <View style={styles.requestSection}>
                  <Text style={styles.requestLabel}>Overtime Request</Text>
                  {canApproveOvertimeDD(record) ? (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApproveOvertime(record.id)}
                      >
                        <Text style={styles.approveButtonText}>Approve OT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectOvertime(record.id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject OT</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.pendingNote}>⏳ Awaiting approval from their manager</Text>
                  )}
                </View>
              )}

              {/* Double Duty Actions */}
              {record.double_duty_approval_status === 'pending' && (
                <View style={styles.requestSection}>
                  <Text style={styles.requestLabel}>Double Duty Request</Text>
                  {canApproveOvertimeDD(record) ? (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApproveDoubleDuty(record.id)}
                      >
                        <Text style={styles.approveButtonText}>Approve DD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectDoubleDuty(record.id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject DD</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.pendingNote}>⏳ Awaiting approval from their manager</Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </View>
      )}

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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'white',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  requestTypeBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overtimeBadge: {
    backgroundColor: '#ff9800',
  },
  doubleDutyBadge: {
    backgroundColor: '#9c27b0',
  },
  typeBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markedBy: {
    fontSize: 13,
    color: '#007AFF',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  requestSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  requestLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  pendingNote: {
    fontSize: 13,
    color: '#856404',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    textAlign: 'center',
    fontStyle: 'italic',
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
