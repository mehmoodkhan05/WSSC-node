import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole, hasFullControl, ROLE, ROLE_OPTIONS, getRoleLabel } from '../../lib/roles';
import { fetchLeadershipAttendance } from '../../lib/attendance';

import StatsCard from '../StatsCard';
import AttendanceTable from '../AttendanceTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { DEPARTMENTS, getDepartmentLabel } from '../../lib/departments';

const AdminDashboard = ({ stats, records, roleDepartmentStats = {} }) => {
  const { profile } = useAuth();
  const [leadershipAttendance, setLeadershipAttendance] = useState([]);
  const [loadingLeadership, setLoadingLeadership] = useState(false);

  const normalizedRole = normalizeRole(profile?.role) || ROLE.STAFF;
  const isCEOOrSuperAdmin = hasFullControl(normalizedRole) || normalizedRole === ROLE.CEO;

  useEffect(() => {
    if (isCEOOrSuperAdmin) {
      loadLeadershipAttendance();
    }
  }, [isCEOOrSuperAdmin]);

  const loadLeadershipAttendance = async () => {
    try {
      setLoadingLeadership(true);
      const data = await fetchLeadershipAttendance();
      setLeadershipAttendance(data || []);
    } catch (error) {
      console.error('Error loading leadership attendance:', error);
    } finally {
      setLoadingLeadership(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    try {
      return new Date(timeString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return '#22c55e';
      case 'late':
        return '#facc15';
      case 'absent':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const leadershipPresent = leadershipAttendance.filter(l => l.status === 'present').length;
  const leadershipAbsent = leadershipAttendance.filter(l => l.status === 'absent').length;
  const totalLeadership = leadershipAttendance.length;
  return (
    <View style={styles.gridContainer}>
      <View style={styles.leftColumn}>
        <Card style={styles.cardSpacing}>
          <CardHeader>
            <CardTitle>Today's Attendance Summary</CardTitle>
            <CardDescription>
              A real-time overview of staff attendance for{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              .
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.attendanceSummaryContent}>
            <View style={styles.overallProgressContainer}>
              <View style={styles.overallProgressHeader}>
                <Text style={styles.overallProgressLabel}>Attendance Breakdown</Text>
                <Text style={styles.overallProgressPercentage}>
                  {stats.totalStaff > 0
                    ? Math.round(
                        ((stats.presentCount + stats.onLeaveCount) / stats.totalStaff) * 100,
                      )
                    : 0}
                  %
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  {stats.totalStaff > 0 && stats.presentCount > 0 ? (
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          width: `${(stats.presentCount / stats.totalStaff) * 100}%`,
                          backgroundColor: '#22c55e',
                          borderTopLeftRadius: 12,
                          borderBottomLeftRadius: 12,
                          borderTopRightRadius:
                            stats.onLeaveCount === 0 && stats.absentCount === 0 ? 12 : 0,
                          borderBottomRightRadius:
                            stats.onLeaveCount === 0 && stats.absentCount === 0 ? 12 : 0,
                        },
                      ]}
                    />
                  ) : null}

                  {stats.totalStaff > 0 && stats.onLeaveCount > 0 ? (
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          width: `${(stats.onLeaveCount / stats.totalStaff) * 100}%`,
                          backgroundColor: '#64748b',
                          borderTopLeftRadius: stats.presentCount === 0 ? 12 : 0,
                          borderBottomLeftRadius: stats.presentCount === 0 ? 12 : 0,
                          borderTopRightRadius: stats.absentCount === 0 ? 12 : 0,
                          borderBottomRightRadius: stats.absentCount === 0 ? 12 : 0,
                        },
                      ]}
                    />
                  ) : null}

                  {stats.totalStaff > 0 && stats.absentCount > 0 ? (
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          width: `${(stats.absentCount / stats.totalStaff) * 100}%`,
                          backgroundColor: '#ef4444',
                          borderTopLeftRadius:
                            stats.presentCount === 0 && stats.onLeaveCount === 0 ? 12 : 0,
                          borderBottomLeftRadius:
                            stats.presentCount === 0 && stats.onLeaveCount === 0 ? 12 : 0,
                          borderTopRightRadius: 12,
                          borderBottomRightRadius: 12,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.progressBarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.legendText}>
                    Present (
                    {stats.totalStaff > 0
                      ? Math.round((stats.presentCount / stats.totalStaff) * 100)
                      : 0}
                    %)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#64748b' }]} />
                  <Text style={styles.legendText}>
                    On Leave (
                    {stats.totalStaff > 0
                      ? Math.round((stats.onLeaveCount / stats.totalStaff) * 100)
                      : 0}
                    %)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.legendText}>
                    Absent (
                    {stats.totalStaff > 0
                      ? Math.round((stats.absentCount / stats.totalStaff) * 100)
                      : 0}
                    %)
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.attendanceStats}>
              <View style={[styles.attendanceStatItem, { backgroundColor: '#22c55e1A' }]}>
                <View style={styles.attendanceStatLeft}>
                  <View
                    style={[
                      styles.attendanceStatIconContainer,
                      { backgroundColor: '#22c55e33' },
                    ]}
                  >
                    <Feather name="user-check" size={20} color="#22c55e" />
                  </View>
                  <View style={styles.attendanceStatInfo}>
                    <Text style={styles.attendanceStatText}>Present</Text>
                    <Text style={styles.attendanceStatPercentage}>
                      {stats.totalStaff > 0
                        ? Math.round((stats.presentCount / stats.totalStaff) * 100)
                        : 0}
                      %
                    </Text>
                  </View>
                </View>
                <Text style={styles.attendanceStatValue}>{stats.presentCount}</Text>
              </View>

              <View style={[styles.attendanceStatItem, { backgroundColor: '#ef44441A' }]}>
                <View style={styles.attendanceStatLeft}>
                  <View
                    style={[
                      styles.attendanceStatIconContainer,
                      { backgroundColor: '#ef444433' },
                    ]}
                  >
                    <Feather name="user-x" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.attendanceStatInfo}>
                    <Text style={styles.attendanceStatText}>Absent</Text>
                    <Text style={styles.attendanceStatPercentage}>
                      {stats.totalStaff > 0
                        ? Math.round((stats.absentCount / stats.totalStaff) * 100)
                        : 0}
                      %
                    </Text>
                  </View>
                </View>
                <Text style={styles.attendanceStatValue}>{stats.absentCount}</Text>
              </View>

              <View style={[styles.attendanceStatItem, { backgroundColor: '#64748b1A' }]}>
                <View style={styles.attendanceStatLeft}>
                  <View
                    style={[
                      styles.attendanceStatIconContainer,
                      { backgroundColor: '#64748b33' },
                    ]}
                  >
                    <Feather name="shield" size={20} color="#64748b" />
                  </View>
                  <View style={styles.attendanceStatInfo}>
                    <Text style={styles.attendanceStatText}>On Leave</Text>
                    <Text style={styles.attendanceStatPercentage}>
                      {stats.totalStaff > 0
                        ? Math.round((stats.onLeaveCount / stats.totalStaff) * 100)
                        : 0}
                      %
                    </Text>
                  </View>
                </View>
                <Text style={styles.attendanceStatValue}>{stats.onLeaveCount}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card style={[styles.cardSpacing, styles.actionItemsCard]}>
          <CardHeader>
            <CardTitle style={styles.actionItemsTitle}>Action Items</CardTitle>
          </CardHeader>
          <CardContent style={styles.actionItemsContent}>
            <View style={styles.actionItem}>
              <Text style={styles.actionItemText}>Pending Leave Requests</Text>
              <Text style={styles.actionItemValue}>{stats.pendingApprovalsCount}</Text>
            </View>
            <View style={styles.actionItem}>
              <Text style={styles.actionItemText}>Missing Clock-outs</Text>
              <Text style={styles.actionItemValue}>{stats.missingClockOutCount}</Text>
            </View>
          </CardContent>
        </Card>

        <View style={styles.statsGrid}>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              title="Total Staff"
              value={stats.totalStaff}
              icon={Feather}
              iconName="users"
              color="#007AFF"
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              title="Supervisors"
              value={stats.supervisorCount}
              icon={Feather}
              iconName="users"
              color="#28a745"
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              title="Sub Engineers"
              value={stats.subEngineerCount || 0}
              icon={Feather}
              iconName="users"
              color="#17a2b8"
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              title="Locations"
              value={stats.locationsCount}
              icon={Feather}
              iconName="map-pin"
              color="#6c757d"
            />
          </View>
        </View>

        {/* Role and Department Statistics Card - Only visible to CEO and Super Admin */}
        {isCEOOrSuperAdmin && (
          <Card style={styles.cardSpacing}>
            <CardHeader>
              <CardTitle>Organization Overview</CardTitle>
              <CardDescription>
                User distribution by role and department
              </CardDescription>
            </CardHeader>
            <CardContent style={styles.overviewContent}>
              {/* By Role Section */}
              <View style={styles.overviewSection}>
                <Text style={styles.overviewSectionTitle}>By Role</Text>
                <View style={styles.statsList}>
                  {roleDepartmentStats.byRole && roleDepartmentStats.byRole.length > 0 ? (
                    (() => {
                      // Sort roles by hierarchy: Super Admin, CEO, General Manager, Manager, Sub Engineer, Supervisor, Staff
                      const roleOrder = {
                        'super_admin': 1,
                        'ceo': 2,
                        'general_manager': 3,
                        'manager': 4,
                        'sub_engineer': 5,
                        'supervisor': 5, // Same level as sub_engineer
                        'staff': 6,
                        'unknown': 99
                      };
                      
                      const sortedRoles = [...roleDepartmentStats.byRole].sort((a, b) => {
                        const orderA = roleOrder[a.role] || 99;
                        const orderB = roleOrder[b.role] || 99;
                        if (orderA !== orderB) return orderA - orderB;
                        return a.role.localeCompare(b.role);
                      });

                      return sortedRoles.map((item, index) => {
                        const roleOption = ROLE_OPTIONS.find(r => r.value === item.role);
                        const roleLabel = roleOption ? roleOption.label : item.role.charAt(0).toUpperCase() + item.role.slice(1);
                        return (
                          <View key={index} style={styles.statsRow}>
                            <Text style={styles.statsLabel}>{roleLabel}</Text>
                            <Text style={styles.statsValue}>{item.count}</Text>
                          </View>
                        );
                      });
                    })()
                  ) : (
                    <Text style={styles.emptyText}>No role data available</Text>
                  )}
                </View>
              </View>

              {/* By Department Section */}
              <View style={styles.overviewSection}>
                <Text style={styles.overviewSectionTitle}>By Department</Text>
                <View style={styles.statsList}>
                  {roleDepartmentStats.byDepartment && roleDepartmentStats.byDepartment.length > 0 ? (
                    roleDepartmentStats.byDepartment.map((item, index) => {
                      const deptLabel = item.department && item.department !== 'unassigned' 
                        ? getDepartmentLabel(item.department) 
                        : 'Unassigned';
                      return (
                        <View key={index} style={styles.statsRow}>
                          <Text style={styles.statsLabel}>{deptLabel}</Text>
                          <Text style={styles.statsValue}>{item.count}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No department data available</Text>
                  )}
                </View>
              </View>

              {/* Combined View */}
              {roleDepartmentStats.byRoleAndDepartment && roleDepartmentStats.byRoleAndDepartment.length > 0 && (
                <View style={styles.overviewSection}>
                  <Text style={styles.overviewSectionTitle}>Role × Department Matrix</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.matrixScroll}
                    pagingEnabled={false}
                    snapToInterval={27}
                    decelerationRate="fast"
                  >
                    <View style={styles.matrixContainer}>
                      {roleDepartmentStats.byRoleAndDepartment.map((item, index) => {
                        const roleOption = ROLE_OPTIONS.find(r => r.value === item.role);
                        const roleLabel = roleOption ? roleOption.label : item.role.charAt(0).toUpperCase() + item.role.slice(1);
                        const deptLabel = item.department && item.department !== 'unassigned' 
                          ? getDepartmentLabel(item.department) 
                          : 'Unassigned';
                        return (
                          <View key={index} style={styles.matrixItem}>
                            <Text style={styles.matrixRole}>{roleLabel}</Text>
                            <Text style={styles.matrixDept}>{deptLabel}</Text>
                            <Text style={styles.matrixCount}>{item.count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Total Users */}
              <View style={styles.totalUsersContainer}>
                <Text style={styles.totalUsersLabel}>Total Users</Text>
                <Text style={styles.totalUsersValue}>{roleDepartmentStats.totalUsers || 0}</Text>
              </View>
            </CardContent>
          </Card>
        )}
      </View>

      <View style={styles.rightColumn}>
        <AttendanceTable 
          records={records} 
          title="Today's Activity" 
        />
        
        {/* Leadership Attendance - Only visible to CEO/Super Admin */}
        {isCEOOrSuperAdmin && (
          <Card style={[styles.cardSpacing, styles.leadershipCard]}>
            <CardHeader>
              <CardTitle>Leadership Attendance</CardTitle>
              <CardDescription>
                Managers, General Managers, and Supervisors clock in/out status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLeadership ? (
                <Text style={styles.emptyText}>Loading...</Text>
              ) : leadershipAttendance.length === 0 ? (
                <Text style={styles.emptyText}>No leadership members found</Text>
              ) : (
                <>
                  {/* Summary Stats */}
                  <View style={styles.leadershipStats}>
                    <View style={[styles.leadershipStatItem, { backgroundColor: '#22c55e1A' }]}>
                      <Text style={[styles.leadershipStatValue, { color: '#22c55e' }]}>
                        {leadershipPresent}
                      </Text>
                      <Text style={styles.leadershipStatLabel}>Present</Text>
                    </View>
                    <View style={[styles.leadershipStatItem, { backgroundColor: '#ef44441A' }]}>
                      <Text style={[styles.leadershipStatValue, { color: '#ef4444' }]}>
                        {leadershipAbsent}
                      </Text>
                      <Text style={styles.leadershipStatLabel}>Absent</Text>
                    </View>
                    <View style={[styles.leadershipStatItem, { backgroundColor: '#64748b1A' }]}>
                      <Text style={[styles.leadershipStatValue, { color: '#64748b' }]}>
                        {totalLeadership}
                      </Text>
                      <Text style={styles.leadershipStatLabel}>Total</Text>
                    </View>
                  </View>

                  {/* Leadership List */}
                  <ScrollView style={styles.leadershipList}>
                    {leadershipAttendance.map((leader) => (
                      <View key={leader.id} style={styles.leadershipItem}>
                        <View style={styles.leadershipInfo}>
                          <View style={styles.leadershipHeader}>
                            <Text style={styles.leadershipName}>{leader.name}</Text>
                            <View
                              style={[
                                styles.leadershipStatusBadge,
                                { backgroundColor: getStatusColor(leader.status) + '1A' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.leadershipStatusText,
                                  { color: getStatusColor(leader.status) },
                                ]}
                              >
                                {leader.status?.toUpperCase() || 'ABSENT'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.leadershipRole}>
                            {getRoleLabel(leader.role)}
                            {leader.department ? ` • ${getDepartmentLabel(leader.department)}` : ''}
                          </Text>
                          <Text style={styles.leadershipLocation}>
                            {leader.nc_location_name || 'N/A'}
                          </Text>
                          <View style={styles.leadershipTimes}>
                            <Text style={styles.leadershipTime}>
                              In: {formatTime(leader.clockIn)}
                            </Text>
                            <Text style={styles.leadershipTime}>
                              Out: {formatTime(leader.clockOut)}
                            </Text>
                          </View>
                          {(leader.clockedInBy || leader.clockedOutBy) && (
                            <Text style={styles.leadershipOverride}>
                              {leader.clockedInBy && `Clock-in by: ${leader.clockedInBy}`}
                              {leader.clockedInBy && leader.clockedOutBy && ' • '}
                              {leader.clockedOutBy && `Clock-out by: ${leader.clockedOutBy}`}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
    marginBottom: 16,
    marginTop: 0,
    position: 'relative',
    zIndex: 0,
  },
  cardSpacing: {
    marginBottom: 16,
  },
  attendanceSummaryContent: {
    flexDirection: 'column',
    paddingVertical: 16,
  },
  overallProgressContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  overallProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overallProgressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  overallProgressPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 4,
  },
  progressBarBackground: {
    width: '100%',
    height: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressBarSegment: {
    height: '100%',
    minWidth: 2,
  },
  progressBarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  attendanceStats: {
    width: '100%',
    paddingHorizontal: 16,
  },
  attendanceStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  attendanceStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendanceStatIconContainer: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  attendanceStatInfo: {
    flex: 1,
  },
  attendanceStatText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  attendanceStatPercentage: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  attendanceStatValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  actionItemsCard: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  actionItemsTitle: {
    color: '#ef4444',
  },
  actionItemsContent: {
    paddingVertical: 12,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  actionItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  statsCardWrapper: {
    width: '48%',
  },
  overviewContent: {
    paddingVertical: 16,
  },
  overviewSection: {
    marginBottom: 24,
  },
  overviewSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsList: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statsLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  matrixScroll: {
    marginHorizontal: 0,
  },
  matrixContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  matrixItem: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    width: (screenWidth - 100) / 2, // 2 cards visible, accounting for margins and padding
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  matrixRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  matrixDept: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  matrixCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  totalUsersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 8,
  },
  totalUsersLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  totalUsersValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  leadershipStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  leadershipStatItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  leadershipStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  leadershipStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  leadershipList: {
    maxHeight: 400,
  },
  leadershipItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  leadershipInfo: {
    flex: 1,
  },
  leadershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadershipName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  leadershipStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leadershipStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  leadershipRole: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  leadershipLocation: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  leadershipTimes: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  leadershipTime: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  leadershipOverride: {
    fontSize: 11,
    color: '#f59e0b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  leadershipCard: {
    marginTop: 0,
  },
});

export default AdminDashboard;

