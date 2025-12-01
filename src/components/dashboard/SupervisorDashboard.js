import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { markOvertime, markDoubleDuty } from '../../lib/approvals';

const formatStatusLabel = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'present':
      return { label: 'Present', color: '#22c55e' };
    case 'late':
      return { label: 'Late', color: '#f97316' };
    case 'on-leave':
      return { label: 'On Leave', color: '#64748b' };
    case 'absent':
    default:
      return { label: 'Absent', color: '#ef4444' };
  }
};

const SupervisorDashboard = ({ stats, records, details, profile, onRefresh }) => {
  const navigation = useNavigation();
  const supervisorId = profile?.user_id || null;
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get attendance record ID for a staff member
  const getAttendanceIdForStaff = (staffId) => {
    const record = (records || []).find(r => r.staffId === staffId);
    return record?.id || null;
  };

  // Handle staff click to show action modal
  const handleStaffClick = (staff) => {
    setSelectedStaff(staff);
    setShowActionModal(true);
  };

  // Mark overtime handler
  const handleMarkOvertime = async () => {
    if (!selectedStaff) return;
    const attendanceId = getAttendanceIdForStaff(selectedStaff.staffId);
    if (!attendanceId) {
      Alert.alert('Error', 'Staff member has no attendance record for today. They must clock in first.');
      setShowActionModal(false);
      return;
    }

    try {
      setLoading(true);
      await markOvertime(attendanceId);
      Alert.alert('Success', `Overtime marked for ${selectedStaff.name}. Pending manager approval.`);
      setShowActionModal(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to mark overtime');
    } finally {
      setLoading(false);
    }
  };

  // Mark double duty handler
  const handleMarkDoubleDuty = async () => {
    if (!selectedStaff) return;
    const attendanceId = getAttendanceIdForStaff(selectedStaff.staffId);
    if (!attendanceId) {
      Alert.alert('Error', 'Staff member has no attendance record for today. They must clock in first.');
      setShowActionModal(false);
      return;
    }

    try {
      setLoading(true);
      await markDoubleDuty(attendanceId);
      Alert.alert('Success', `Double duty marked for ${selectedStaff.name}. Pending manager approval.`);
      setShowActionModal(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to mark double duty');
    } finally {
      setLoading(false);
    }
  };

  const locationMap = useMemo(() => {
    const map = new Map();
    (details.locations || []).forEach((location) => {
      const id = location?.id;
      let name = 'N/A';
      if (location?.get) {
        name = location.get('name') || location.get('code') || 'N/A';
      } else if (location?.name) {
        name = location.name;
      }
      if (id) {
        map.set(id, name);
      }
    });
    return map;
  }, [details.locations]);

  const staffNameMap = useMemo(() => {
    const map = new Map();
    (details.staffProfiles || []).forEach((staff) => {
      if (!staff) return;
      if (typeof staff.get === 'function') {
        const fullName = staff.get('fullName');
        const displayName = fullName || staff.get('name') || staff.get('username') || staff.get('email');
        map.set(staff.id, displayName || 'Unknown Staff');
      } else {
        map.set(staff.id || staff.user_id, staff.fullName || staff.full_name || staff.name || 'Unknown Staff');
      }
    });
    return map;
  }, [details.staffProfiles]);

  const assignmentsForSupervisor = useMemo(() => {
    if (!supervisorId) return [];
    return (details.assignments || []).filter(
      (assignment) => assignment.supervisor_id === supervisorId,
    );
  }, [details.assignments, supervisorId]);

  const attendanceMap = useMemo(
    () =>
      new Map(
        (records || []).map((record) => [
          record.staffId,
          {
            clockIn: record.clockIn,
            clockOut: record.clockOut,
            status: record.status,
            staffName: record.staffName,
            nc: record.nc,
          },
        ]),
      ),
    [records],
  );

  const onLeaveSet = useMemo(() => {
    const set = new Set();
    (details.onLeave || []).forEach((leave) => {
      if (leave?.staffId) {
        set.add(leave.staffId);
      }
    });
    return set;
  }, [details.onLeave]);

  const teamMembers = useMemo(() => {
    const uniqueStaff = new Map();

    assignmentsForSupervisor.forEach((assignment) => {
      if (!assignment?.staff_id) return;

      const attendance = attendanceMap.get(assignment.staff_id);
      const onLeave = onLeaveSet.has(assignment.staff_id);

      const staffName =
        attendance?.staffName ||
        staffNameMap.get(assignment.staff_id) ||
        assignment.staff_name ||
        'Staff Member';

      const locationName =
        locationMap.get(assignment.nc_location_id) ||
        attendance?.nc ||
        assignment.nc_location_name ||
        'N/A';

      uniqueStaff.set(assignment.staff_id, {
        staffId: assignment.staff_id,
        name: staffName,
        locationName,
        clockIn: attendance?.clockIn || null,
        clockOut: attendance?.clockOut || null,
        status: attendance?.status || (onLeave ? 'on-leave' : 'absent'),
      });
    });

    return Array.from(uniqueStaff.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || ''),
    );
  }, [assignmentsForSupervisor, attendanceMap, onLeaveSet, staffNameMap, locationMap]);

  const missingClockOut = useMemo(
    () => teamMembers.filter((record) => record.clockIn && !record.clockOut),
    [teamMembers],
  );

  const pendingLeaveRequests = useMemo(() => {
    const teamStaffIds = new Set(assignmentsForSupervisor.map((assignment) => assignment.staff_id));
    return (details.onLeave || []).filter((leave) => {
      if (leave?.staffId && !teamStaffIds.has(leave.staffId)) return false;
      if (leave.status && leave.status.toLowerCase() !== 'pending') return false;
      if (leave.approvalStatus && leave.approvalStatus.toLowerCase() !== 'pending') return false;
      if (!supervisorId) return true;
      const leaveSupervisorId = leave.supervisorId || leave.supervisor_id;
      return !leaveSupervisorId || leaveSupervisorId === supervisorId;
    });
  }, [details.onLeave, assignmentsForSupervisor, supervisorId]);

  const quickLinks = useMemo(
    () => [
      {
        label: 'Performance Review',
        description: 'Review and manage staff performance',
        icon: 'star',
        target: 'PerformanceReview',
      },
      {
        label: 'Leave Management',
        description: 'Manage leave requests and approvals',
        icon: 'calendar',
        target: 'LeaveManagement',
      },
    ],
    [],
  );

  return (
    <View style={styles.container}>
      <Card style={styles.cardSpacing}>
        <CardHeader>
          <CardTitle>Team Overview</CardTitle>
          <CardDescription>Snapshot of your team for today.</CardDescription>
        </CardHeader>
        <CardContent style={styles.overviewContent}>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: '#2563eb' }]}>{teamMembers.length}</Text>
            <Text style={styles.overviewLabel}>Total</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: '#22c55e' }]}>{stats.presentCount}</Text>
            <Text style={styles.overviewLabel}>Present</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: '#64748b' }]}>{stats.onLeaveCount}</Text>
            <Text style={styles.overviewLabel}>On Leave</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: '#ef4444' }]}>{stats.absentCount}</Text>
            <Text style={styles.overviewLabel}>Absent</Text>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.cardSpacing}>
        <CardHeader>
          <CardTitle>Team Attendance</CardTitle>
          <CardDescription>Real-time status across your assigned staff.</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <Text style={styles.emptyStateText}>No team members found for today.</Text>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={teamMembers}
              keyExtractor={(item) => item.staffId}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              renderItem={({ item }) => {
                const meta = formatStatusLabel(item.status);
                return (
                  <TouchableOpacity 
                    style={styles.memberRow}
                    onPress={() => handleStaffClick(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>{item.name}</Text>
                        <Feather name="chevron-right" size={16} color="#94a3b8" />
                      </View>
                      <Text style={styles.memberMeta}>
                        {item.locationName} • {item.clockIn ? 'Clocked In' : 'Not Clocked In'}
                      </Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: meta.color + '1A' }]}>
                      <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate quickly to common tools.</CardDescription>
        </CardHeader>
        <CardContent style={styles.linksGrid}>
          {quickLinks.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.linkCard}
              onPress={() => navigation.navigate(link.target)}
            >
              <View style={styles.linkIconWrapper}>
                <Feather name={link.icon} size={18} color="#2563eb" />
              </View>
              <View style={styles.linkTextWrapper}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkDescription}>{link.description}</Text>
              </View>
              <Feather name="arrow-right" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </CardContent>
      </Card>

      {/* Staff Action Modal */}
      <Modal
        visible={showActionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedStaff?.name || 'Staff Member'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Select an action for this staff member
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, styles.overtimeButton]}
              onPress={handleMarkOvertime}
              disabled={loading}
            >
              <Feather name="clock" size={20} color="white" />
              <Text style={styles.modalButtonText}>
                {loading ? 'Processing...' : 'Mark Overtime'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.doubleDutyButton]}
              onPress={handleMarkDoubleDuty}
              disabled={loading}
            >
              <Feather name="users" size={20} color="white" />
              <Text style={styles.modalButtonText}>
                {loading ? 'Processing...' : 'Mark Double Duty'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  cardSpacing: {
    marginBottom: 4,
  },
  overviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  overviewValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  overviewLabel: {
    fontSize: 13,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actionsContent: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextWrapper: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionSummary: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyStateText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: '#64748b',
  },
  listSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  memberMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 80,
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  linksGrid: {
    gap: 12,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  linkIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0ecff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkTextWrapper: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  linkDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  overtimeButton: {
    backgroundColor: '#f97316',
  },
  doubleDutyButton: {
    backgroundColor: '#8b5cf6',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    marginTop: 4,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});

export default SupervisorDashboard;

