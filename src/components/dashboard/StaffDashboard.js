import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

const formatTime = (value) => {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (error) {
    return value;
  }
};

const formatStatus = (status) => {
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

const StaffDashboard = ({ stats, records, details, profile }) => {
  const navigation = useNavigation();

  const locationLookup = useMemo(() => {
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

  const myAssignment = useMemo(() => {
    if (!profile?.user_id) return null;
    return (details.assignments || []).find(
      (assignment) => assignment.staff_id === profile.user_id,
    );
  }, [details.assignments, profile?.user_id]);

  const myRecord = useMemo(() => {
    if (!records || records.length === 0) return null;
    if (profile?.user_id) {
      return (
        records.find((record) => record.staffId === profile.user_id) ||
        records.find((record) => record.staffId === profile.user_id.toString())
      );
    }
    return records[0];
  }, [records, profile?.user_id]);

  const leaveRequestToday = useMemo(() => {
    if (!profile?.user_id) return null;
    return (details.onLeave || []).find((leave) => leave.staffId === profile.user_id);
  }, [details.onLeave, profile?.user_id]);

  const statusMeta = formatStatus(myRecord?.status);
  const assignedLocationName =
    myAssignment?.nc_location_name ||
    locationLookup.get(myAssignment?.nc_location_id) ||
    myRecord?.nc ||
    '—';

  const quickActions = useMemo(() => {
    const actions = [
      {
        icon: 'clock',
        label: 'Mark Attendance',
        target: 'Attendance',
        description: 'Clock in/out and attach photos',
      },
      {
        icon: 'user',
        label: 'Profile',
        target: 'Profile',
        description: 'Update personal information',
      },
    ];

    return actions;
  }, []);

  return (
    <View style={styles.container}>
      <Card style={styles.cardSpacing}>
        <CardHeader>
          <CardTitle>Today&apos;s Status</CardTitle>
          <CardDescription>Your personal attendance overview for today.</CardDescription>
        </CardHeader>
        <CardContent style={styles.statusContent}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Clock In</Text>
              <Text style={styles.statusValue}>{formatTime(myRecord?.clockIn)}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Clock Out</Text>
              <Text style={styles.statusValue}>{formatTime(myRecord?.clockOut)}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Location</Text>
              <Text style={styles.statusValue}>{assignedLocationName}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Supervisor</Text>
              <Text style={styles.statusValue}>
                {myAssignment?.supervisor_name || myRecord?.supervisorName || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.statusExtras}>
            <View style={styles.extraItem}>
              <Feather name="file-text" size={18} color="#2563eb" />
              <Text style={styles.extraLabel}>
                Approval:{' '}
                <Text style={styles.extraValue}>
                  {(myRecord?.approvalStatus || 'pending').replace('-', ' ')}
                </Text>
              </Text>
            </View>
            <View style={styles.extraItem}>
              <Feather name="calendar" size={18} color="#f97316" />
              <Text style={styles.extraLabel}>
                Leave Today:{' '}
                <Text style={styles.extraValue}>
                  {leaveRequestToday ? leaveRequestToday.status || 'Approved' : 'None'}
                </Text>
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.cardSpacing}>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump into the tasks you care about most.</CardDescription>
        </CardHeader>
        <CardContent style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.target)}
            >
              <View style={styles.actionIconWrapper}>
                <Feather name={action.icon} size={20} color="#2563eb" />
              </View>
              <View style={styles.actionTextWrapper}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </CardContent>
      </Card>
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
  statusContent: {
    gap: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusItem: {
    width: '48%',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusExtras: {
    gap: 10,
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extraLabel: {
    fontSize: 14,
    color: '#334155',
  },
  extraValue: {
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0ecff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextWrapper: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  snapshotContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snapshotItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  snapshotStat: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  snapshotLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

export default StaffDashboard;

