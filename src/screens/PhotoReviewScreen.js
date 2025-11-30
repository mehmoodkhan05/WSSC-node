import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchStaff, fetchSupervisors } from '../lib/staff';
import { fetchAttendanceWithPhotos } from '../lib/attendance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
  hasManagementPrivileges,
} from '../lib/roles';

const STATUS_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending',
};

const getNameFromRecord = (item = {}) => {
  if (!item) return null;
  const candidates = [item.name, item.full_name, item.fullName, item.username, item.email];
  for (const value of candidates) {
    if (value && typeof value === 'string' && value.trim()) {
      if (value.includes('@')) {
        return value.split('@')[0];
      }
      return value.trim();
    }
  }
  return null;
};

const formatDateLabel = (date) => {
  if (!date) return 'Unknown date';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return date;
  }
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return value;
  }
};

const normalizeStatus = (status) => {
  if (!status) return 'pending';
  return status.toLowerCase();
};

const formatApprovalStatus = (status) => {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending');
};

const getApprovalBadgeColor = (status) => {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'approved':
      return '#28a745';
    case 'rejected':
      return '#dc3545';
    default:
      return '#f0ad4e';
  }
};

const PhotoReviewScreen = () => {
  const { profile } = useAuth();
  const currentUser = profile;

  const [userFolders, setUserFolders] = useState([]);
  const [userRecordMap, setUserRecordMap] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateFolders, setDateFolders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = normalizeRole(currentUser?.role) || ROLE.STAFF;
  const canAccessPhotos = hasFieldLeadershipPrivileges(role);
  const hasOrgWideAccess = hasManagementPrivileges(role);

  const loadInitialData = useCallback(async () => {
    if (!canAccessPhotos || !currentUser?.user_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSelectedUser(null);
    setSelectedDate(null);
    setDateFolders([]);

    try {
      const [staffList, supervisorList] = await Promise.all([
        fetchStaff(),
        fetchSupervisors(),
      ]);

      let attendanceRecords = [];

      if (hasOrgWideAccess) {
        attendanceRecords = await fetchAttendanceWithPhotos();
      } else {
        const [supervisedRecords, selfRecords] = await Promise.all([
          fetchAttendanceWithPhotos({ supervisorId: currentUser.user_id }),
          fetchAttendanceWithPhotos({ staffId: currentUser.user_id }),
        ]);

        const combined = new Map();
        [...supervisedRecords, ...selfRecords].forEach((record) => {
          combined.set(record.id, record);
        });
        attendanceRecords = Array.from(combined.values());
      }

      const normalizedStaff = (staffList || []).map((staff) => ({
        user_id: staff.user_id || '',
        name:
          getNameFromRecord(staff) ||
          (staff.email ? staff.email.split('@')[0] : 'Staff Member'),
        email: staff.email || null,
      }));

      const normalizedSupervisors = (supervisorList || []).map((supervisor) => ({
        user_id: supervisor.user_id || '',
        name:
          getNameFromRecord(supervisor) ||
          (supervisor.email ? supervisor.email.split('@')[0] : 'Supervisor'),
        email: supervisor.email || null,
      }));

      const staffMap = new Map(normalizedStaff.map((item) => [item.user_id, item]));
      const supervisorMap = new Map(
        normalizedSupervisors.map((item) => [item.user_id, item])
      );

      const foldersMap = new Map();

      attendanceRecords.forEach((record) => {
        const staffId = record.staff_id;
        if (!staffId) return;

        if (!hasOrgWideAccess) {
          const isSelf = staffId === currentUser.user_id;
          const isSupervised = record.supervisor_id === currentUser.user_id;
          if (!isSelf && !isSupervised) {
            return;
          }
        }

        const staffInfo = staffMap.get(staffId) || supervisorMap.get(staffId) || {};
        const staffName = staffInfo.name || record.staff_name || 'Unknown Staff';
        const role = supervisorMap.has(staffId) && !staffMap.has(staffId) ? 'supervisor' : 'staff';

        if (!foldersMap.has(staffId)) {
          foldersMap.set(staffId, {
            user_id: staffId,
            name: staffName,
            role,
            recordCount: 0,
            records: [],
          });
        }

        const folder = foldersMap.get(staffId);
        folder.recordCount += 1;

        const supervisorName =
          record.supervisor_name ||
          supervisorMap.get(record.supervisor_id)?.name ||
          null;

        folder.records.push({
          ...record,
          staff_name: staffName,
          supervisor_name: supervisorName,
        });
      });

      const folders = Array.from(foldersMap.values()).map((folder) => ({
        ...folder,
        records: folder.records.sort((a, b) => {
          const dateA = a.attendance_date || '';
          const dateB = b.attendance_date || '';
          return dateB.localeCompare(dateA);
        }),
      }));

      folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const recordsByUser = {};
      folders.forEach((folder) => {
        recordsByUser[folder.user_id] = folder.records;
      });

      setUserFolders(folders);
      setUserRecordMap(recordsByUser);
    } catch (error) {
      console.error('Error loading attendance photo records:', error);
      Alert.alert('Error', 'Failed to load attendance photo records');
    } finally {
      setLoading(false);
    }
  }, [canAccessPhotos, currentUser?.user_id, hasOrgWideAccess]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, [loadInitialData]);

  const handleUserClick = useCallback(
    (user) => {
      setSelectedUser(user);
      setSelectedDate(null);

      const userRecords = userRecordMap[user.user_id] || [];
      const dateGroups = new Map();

      userRecords.forEach((record) => {
        const recordDate = record.attendance_date || record.date || 'Unknown';
        if (!dateGroups.has(recordDate)) {
          dateGroups.set(recordDate, []);
        }
        dateGroups.get(recordDate).push(record);
      });

      const folders = Array.from(dateGroups.entries())
        .map(([date, records]) => ({
          date,
          formattedDate: formatDateLabel(date),
          records: records.sort((a, b) => {
            const timeA = a.clock_in || a.clock_out || '';
            const timeB = b.clock_in || b.clock_out || '';
            return timeA.localeCompare(timeB);
          }),
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      setDateFolders(folders);
    },
    [userRecordMap]
  );

  const handleDateClick = useCallback((dateFolder) => {
    setSelectedDate(dateFolder);
  }, []);

  const handleBackToUsers = useCallback(() => {
    setSelectedUser(null);
    setSelectedDate(null);
    setDateFolders([]);
  }, []);

  const handleBackToDates = useCallback(() => {
    setSelectedDate(null);
  }, []);

  if (!canAccessPhotos) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Denied</Text>
        <Text style={styles.accessDeniedSubtext}>
          Only supervisors and leadership roles can review photos
        </Text>
      </View>
    );
  }

  if (!selectedUser) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Attendance Photo Review</Text>
          <Text style={styles.subtitle}>
            Review clock in/out photos organized by staff and supervisors
          </Text>
        </View>

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>User Folders</CardTitle>
            <CardDescription>
              Select a user to view their attendance photos grouped by date.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {loading ? (
              <Text style={styles.loadingText}>Loading user folders...</Text>
            ) : userFolders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📷</Text>
                <Text style={styles.emptyStateText}>No attendance photos found.</Text>
                <Text style={styles.emptyStateSubtext}>
                  Photos will appear here when staff clock in or out with pictures.
                </Text>
              </View>
            ) : (
              <View style={styles.folderGrid}>
                {userFolders.map((user) => (
                  <TouchableOpacity
                    key={user.user_id}
                    style={styles.folderCard}
                    onPress={() => handleUserClick(user)}
                  >
                    <Text style={styles.folderIcon}>📁</Text>
                    <Text style={styles.folderName}>{user.name}</Text>
                    <Text style={styles.folderRole}>{user.role}</Text>
                    <Text style={styles.recordCount}>{user.recordCount} records</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  if (!selectedDate) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={handleBackToUsers}>
              <Text style={styles.backButton}>← Back to Users</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbText}> / {selectedUser.name}</Text>
          </View>
          <Text style={styles.title}>Attendance Dates</Text>
          <Text style={styles.subtitle}>Select a date to review photos.</Text>
        </View>

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Photo Dates</CardTitle>
            <CardDescription>
              Each folder contains clock in/out photos for the selected date.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {loading ? (
              <Text style={styles.loadingText}>Loading dates...</Text>
            ) : dateFolders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📅</Text>
                <Text style={styles.emptyStateText}>No dates with photos.</Text>
              </View>
            ) : (
              <View style={styles.folderGrid}>
                {dateFolders.map((dateFolder) => (
                  <TouchableOpacity
                    key={dateFolder.date}
                    style={styles.folderCard}
                    onPress={() => handleDateClick(dateFolder)}
                  >
                    <Text style={styles.folderIcon}>📅</Text>
                    <Text style={styles.folderName}>{dateFolder.formattedDate}</Text>
                    <Text style={styles.recordCount}>{dateFolder.records.length} records</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={handleBackToUsers}>
            <Text style={styles.backButton}>← Back to Users</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBackToDates}>
            <Text style={styles.breadcrumbText}> / {selectedUser.name}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Attendance Photos</Text>
        <Text style={styles.subtitle}>
          Photos for {selectedUser.name} on {selectedDate.formattedDate}.
        </Text>
      </View>

      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Clock In/Out Photos</CardTitle>
          <CardDescription>
            Review the captured attendance photos and approval status for this date.
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.cardContent}>
          <View style={styles.recordGrid}>
            {selectedDate.records.map((record) => {
              const approvalStatus = formatApprovalStatus(record.approval_status);
              const approvalBy = record.approved_by_name;
              const clockInTime = formatTimeLabel(record.clock_in);
              const clockOutTime = formatTimeLabel(record.clock_out);

              return (
                <View key={record.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle}>
                      {record.nc_location_name || record.nc || 'Unknown Location'}
                    </Text>
                    <View
                      style={[styles.statusBadge, { backgroundColor: getApprovalBadgeColor(record.approval_status) }]}
                    >
                      <Text style={styles.statusText}>{approvalStatus}</Text>
                    </View>
                  </View>

                  <Text style={styles.recordMeta}>
                    {selectedDate.formattedDate}
                    {clockInTime || clockOutTime ? ' • ' : ''}
                    {clockInTime ? `Clock In ${clockInTime}` : ''}
                    {clockInTime && clockOutTime ? ' • ' : ''}
                    {clockOutTime ? `Clock Out ${clockOutTime}` : ''}
                  </Text>

                  <View style={styles.recordDetails}>
                    {record.supervisor_name && (
                      <Text style={styles.detailText}>
                        Supervisor: {record.supervisor_name}
                      </Text>
                    )}
                    <Text style={styles.detailText}>
                      Approval: {approvalStatus}
                      {approvalBy ? ` by ${approvalBy}` : ''}
                    </Text>
                  </View>

                  {(record.clock_in_photo_url || record.clock_out_photo_url) && (
                    <View style={styles.photoSection}>
                      <Text style={styles.photoLabel}>Photos</Text>
                      <View style={styles.photoGrid}>
                        {record.clock_in_photo_url && (
                          <TouchableOpacity
                            style={styles.photoTile}
                            onPress={() => setSelectedPhotoUrl(record.clock_in_photo_url)}
                          >
                            <Image
                              source={{ uri: record.clock_in_photo_url }}
                              style={styles.photoThumbnail}
                              resizeMode="cover"
                            />
                            <Text style={styles.photoCaption}>Clock In</Text>
                            {clockInTime && <Text style={styles.photoTime}>{clockInTime}</Text>}
                          </TouchableOpacity>
                        )}

                        {record.clock_out_photo_url && (
                          <TouchableOpacity
                            style={styles.photoTile}
                            onPress={() => setSelectedPhotoUrl(record.clock_out_photo_url)}
                          >
                            <Image
                              source={{ uri: record.clock_out_photo_url }}
                              style={styles.photoThumbnail}
                              resizeMode="cover"
                            />
                            <Text style={styles.photoCaption}>Clock Out</Text>
                            {clockOutTime && <Text style={styles.photoTime}>{clockOutTime}</Text>}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </CardContent>
      </Card>

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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  breadcrumbText: {
    color: '#666',
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 16,
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
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  folderCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  folderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  folderRole: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  recordCount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  recordGrid: {
    gap: 16,
  },
  recordCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  recordMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  recordDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  photoSection: {
    marginTop: 12,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    width: 120,
  },
  photoThumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  photoCaption: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  photoTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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

export default PhotoReviewScreen;
