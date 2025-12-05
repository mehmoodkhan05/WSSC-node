import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchAttendanceReport } from '../lib/attendance';
import { fetchProfiles } from '../lib/staff';
import SimpleDropdown from '../components/ui/SimpleDropdown';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DetailedTimeReportScreen = () => {
  const { profile } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const profiles = await fetchProfiles();
      setStaffList(profiles || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff list');
    }
  };

  const calculateHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0;
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours);
  };

  const parseShiftTime = (timeStr) => {
    if (!timeStr) return { hour: 0, minute: 0 };
    const [hour, minute] = timeStr.split(':').map(Number);
    return { hour: hour || 0, minute: minute || 0 };
  };

  const calculateShiftHours = (startTime, endTime) => {
    const start = parseShiftTime(startTime);
    const end = parseShiftTime(endTime);
    
    let hours = end.hour - start.hour;
    let minutes = end.minute - start.minute;
    
    // Handle overnight shifts (e.g., 21:00 to 05:00)
    if (hours < 0) {
      hours += 24;
    }
    
    const totalHours = hours + (minutes / 60);
    return Math.max(0, totalHours);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const handleGenerateReport = async () => {
    if (!selectedStaff) {
      Alert.alert('Error', 'Please select a staff member');
      return;
    }

    setLoading(true);
    try {
      // Calculate date range for selected month
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);
      
      const dateFrom = startDate.toISOString().split('T')[0];
      const dateTo = endDate.toISOString().split('T')[0];

      // Fetch attendance data
      const data = await fetchAttendanceReport({
        dateFrom,
        dateTo,
      });

      // Filter for selected staff
      const staffData = data.filter(record => record.staff_id === selectedStaff);
      
      // Get staff details
      const staffMember = staffList.find(s => s.user_id === selectedStaff);
      
      if (!staffMember) {
        Alert.alert('Error', 'Staff member not found');
        return;
      }

      // Calculate totals
      let totalShiftHours = 0;
      let totalPerformedHours = 0;
      const dailyRecords = [];

      staffData.forEach(record => {
        const performedHours = calculateHours(record.clock_in, record.clock_out);
        const shiftHours = calculateShiftHours(
          staffMember.shift_start_time || '09:00',
          staffMember.shift_end_time || '17:00'
        );

        dailyRecords.push({
          date: record.date,
          clockIn: record.clock_in,
          clockOut: record.clock_out,
          clockInPhoto: record.clock_in_photo_url,
          clockOutPhoto: record.clock_out_photo_url,
          status: record.status,
          overtime: record.overtime,
          performedHours,
          shiftHours,
        });

        totalPerformedHours += performedHours;
        totalShiftHours += shiftHours;
      });

      // Sort by date
      dailyRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

      setReportData({
        staffMember,
        dailyRecords,
        totalShiftHours,
        totalPerformedHours,
        month: MONTHS[selectedMonth],
        year: selectedYear,
      });

    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearOptions.push({ label: i.toString(), value: i });
  }

  const monthOptions = MONTHS.map((month, index) => ({
    label: month,
    value: index,
  }));

  const staffOptions = [
    { label: 'Select Staff', value: '' },
    ...staffList.map(staff => ({
      label: staff.full_name || staff.email,
      value: staff.user_id,
    })),
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detailed Time Report</Text>
        <Text style={styles.subtitle}>Clock-in/out times with shift hours</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Year</Text>
            <SimpleDropdown
              options={yearOptions}
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
            />
          </View>

          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Month</Text>
            <SimpleDropdown
              options={monthOptions}
              selectedValue={selectedMonth}
              onValueChange={setSelectedMonth}
            />
          </View>
        </View>

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Staff Member *</Text>
          <SimpleDropdown
            options={staffOptions}
            selectedValue={selectedStaff}
            onValueChange={setSelectedStaff}
            placeholder="Select Staff"
          />
        </View>

        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={handleGenerateReport}
          disabled={loading || !selectedStaff}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate Report</Text>
          )}
        </TouchableOpacity>
      </View>

      {reportData && (
        <View style={styles.reportContainer}>
          {/* Staff Info Header */}
          <View style={styles.staffInfoCard}>
            <Text style={styles.staffName}>{reportData.staffMember.full_name}</Text>
            <Text style={styles.staffDetail}>Email: {reportData.staffMember.email}</Text>
            <Text style={styles.staffDetail}>
              Shift: {reportData.staffMember.shift_start_time || '09:00'} - {reportData.staffMember.shift_end_time || '17:00'}
            </Text>
            <Text style={styles.staffDetail}>
              Report Period: {reportData.month} {reportData.year}
            </Text>
          </View>

          {/* Daily Records */}
          <View style={styles.dailyRecordsContainer}>
            <Text style={styles.sectionTitle}>Daily Attendance Records</Text>
            
            {reportData.dailyRecords.length === 0 ? (
              <Text style={styles.noDataText}>No attendance records for this period</Text>
            ) : (
              reportData.dailyRecords.map((record, index) => (
                <View key={index} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayDate}>{formatDate(record.date)}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{record.status}</Text>
                    </View>
                    {record.overtime && (
                      <View style={styles.overtimeBadge}>
                        <Text style={styles.overtimeText}>OT</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.timeRow}>
                    {/* Clock In */}
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Clock In</Text>
                      <Text style={styles.timeValue}>{formatTime(record.clockIn)}</Text>
                      {record.clockInPhoto && (
                        <Image
                          source={{ uri: record.clockInPhoto }}
                          style={styles.photoThumbnail}
                          resizeMode="cover"
                        />
                      )}
                      {record.clockIn && (
                        <Text style={styles.timestampText}>{formatDate(record.clockIn)}</Text>
                      )}
                    </View>

                    {/* Clock Out */}
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Clock Out</Text>
                      <Text style={styles.timeValue}>{formatTime(record.clockOut)}</Text>
                      {record.clockOutPhoto && (
                        <Image
                          source={{ uri: record.clockOutPhoto }}
                          style={styles.photoThumbnail}
                          resizeMode="cover"
                        />
                      )}
                      {record.clockOut && (
                        <Text style={styles.timestampText}>{formatDate(record.clockOut)}</Text>
                      )}
                    </View>
                  </View>

                  {/* Hours Summary */}
                  <View style={styles.hoursSummary}>
                    <View style={styles.hoursItem}>
                      <Text style={styles.hoursLabel}>Shift Hours:</Text>
                      <Text style={styles.hoursValue}>{record.shiftHours.toFixed(2)}h</Text>
                    </View>
                    <View style={styles.hoursItem}>
                      <Text style={styles.hoursLabel}>Performed Hours:</Text>
                      <Text style={styles.hoursValue}>
                        {record.performedHours.toFixed(2)}h
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Summary Totals */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Period Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Days Worked:</Text>
              <Text style={styles.summaryValue}>{reportData.dailyRecords.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Shift Hours:</Text>
              <Text style={styles.summaryValue}>{reportData.totalShiftHours.toFixed(2)}h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Performed Hours:</Text>
              <Text style={styles.summaryValueHighlight}>
                {reportData.totalPerformedHours.toFixed(2)}h
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Difference:</Text>
              <Text style={[
                styles.summaryValue,
                (reportData.totalPerformedHours - reportData.totalShiftHours) >= 0 
                  ? styles.positiveValue 
                  : styles.negativeValue
              ]}>
                {(reportData.totalPerformedHours - reportData.totalShiftHours).toFixed(2)}h
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1976d2',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#e3f2fd',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterItem: {
    flex: 1,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  generateButton: {
    backgroundColor: '#1976d2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportContainer: {
    padding: 16,
  },
  staffInfoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  staffName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  staffDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dailyRecordsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  overtimeBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  overtimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  timeColumn: {
    alignItems: 'center',
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 10,
    color: '#999',
  },
  hoursSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  hoursItem: {
    alignItems: 'center',
  },
  hoursLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  hoursValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryValueHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  positiveValue: {
    color: '#4caf50',
  },
  negativeValue: {
    color: '#f44336',
  },
});

export default DetailedTimeReportScreen;

