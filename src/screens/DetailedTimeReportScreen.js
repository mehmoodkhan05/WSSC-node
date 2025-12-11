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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { fetchAttendanceReport } from '../lib/attendance';
import { fetchProfiles } from '../lib/staff';
import { ROLE, hasFullControl, normalizeRole } from '../lib/roles';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import SearchableDropdown from '../components/ui/SearchableDropdown';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEPT_CODE_NAME_MAP = {
  '11': 'Administration',
  '12': 'Water Supply',
  '13': 'Sanitation',
  '14': 'Commercials',
};

const normalizeDeptCode = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  const digits = str.replace(/\D+/g, '');
  return digits.length ? digits : str;
};

const formatDepartmentLabel = (dept) => {
  if (!dept) return 'Unknown Department';
  if (typeof dept === 'object') {
    const named =
      dept.name || dept.title || dept.label || dept.department_name || dept.departmentName;
    if (named) return named;
    dept = dept.value || dept.code || dept.id || dept._id;
  }
  const str = normalizeDeptCode(dept);
  if (!str) return 'Unknown Department';
  if (DEPT_CODE_NAME_MAP[str]) return DEPT_CODE_NAME_MAP[str];
  if (/^\d+$/.test(str)) return `Department ${str}`;
  return str
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const makeDepartmentOption = (code, name) => {
  const codeStr = code ? String(code).trim() : '';
  const nameStr = name ? String(name).trim() : '';
  const normalizedCode = normalizeDeptCode(codeStr);
  const normalizedValue = normalizeDeptCode(codeStr || nameStr);
  const value = normalizedValue || codeStr || nameStr;
  if (!value) return null;
  const mappedName = normalizedCode ? DEPT_CODE_NAME_MAP[normalizedCode] : null;
  const sameCodeAndName = nameStr && codeStr && nameStr.trim().toLowerCase() === codeStr.trim().toLowerCase();
  let label = nameStr || mappedName || codeStr;
  if (nameStr && codeStr && nameStr.toLowerCase() !== codeStr.toLowerCase()) {
    label = `${nameStr} (${mappedName || codeStr})`;
  } else if ((sameCodeAndName || !nameStr) && mappedName) {
    label = mappedName;
  }
  return { label: label || formatDepartmentLabel(value), value };
};

const DetailedTimeReportScreen = () => {
  const { profile } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([{ label: 'All Departments', value: 'all' }]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  useEffect(() => {
    loadStaff();
  }, []);

  const userRole = normalizeRole(profile?.role);
  const isGeneralManager = userRole === ROLE.GENERAL_MANAGER;
  const isFullControlUser = hasFullControl(userRole);

  const userDepartments = React.useMemo(() => {
    const deptFields = [
      ...(Array.isArray(profile?.departments) ? profile.departments : []),
      profile?.department,
      profile?.empDeptt,
      profile?.emp_deptt,
    ].filter(Boolean);
    return Array.from(new Set(deptFields.map((d) => String(d).trim()))).filter(Boolean);
  }, [profile]);

  const matchesDepartment = (deptValue, targets) => {
    if (!targets || targets.length === 0) return true;
    const normalizedTargets = targets.map((d) => String(d).trim().toLowerCase());
    const value = String(deptValue || '').trim().toLowerCase();
    return value && normalizedTargets.includes(value);
  };

  const filterStaffByDepartment = (staff) => {
    // GM forced to own departments
    if (isGeneralManager && userDepartments.length > 0) {
      return staff.filter((s) =>
        matchesDepartment(s.empDeptt || s.emp_deptt || s.department, userDepartments)
      );
    }
    // CEO/Super Admin by selection
    if (isFullControlUser && selectedDepartment && selectedDepartment !== 'all') {
      return staff.filter((s) =>
        matchesDepartment(s.empDeptt || s.emp_deptt || s.department, [selectedDepartment])
      );
    }
    return staff;
  };

  const loadStaff = async () => {
    try {
      const profiles = await fetchProfiles();
      const deptMap = new Map();
      (profiles || []).forEach((p) => {
        const option = makeDepartmentOption(p.empDeptt || p.emp_deptt, p.department);
        if (option) {
          deptMap.set(option.value, option);
        }
      });

      setAllStaff(profiles || []);
      if (isGeneralManager && userDepartments.length > 0) {
        setSelectedDepartment(userDepartments[0]);
      }
      setStaffList(filterStaffByDepartment(profiles || []));
      setDepartmentOptions([
        { label: 'All Departments', value: 'all' },
        ...Array.from(deptMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      ]);
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff list');
    }
  };

  useEffect(() => {
    setStaffList(filterStaffByDepartment(allStaff));
    // Reset selected staff if it no longer matches filter
    if (
      selectedStaff &&
      !filterStaffByDepartment(allStaff).some((s) => s.user_id === selectedStaff)
    ) {
      setSelectedStaff('');
      setReportData(null);
    }
  }, [selectedDepartment, allStaff, isGeneralManager, isFullControlUser, userDepartments]);

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

  const buildAllStaffHtml = (recordsByStaff, staffMap) => {
    const monthName = MONTHS[selectedMonth];
    const staffIds = Array.from(recordsByStaff.keys()).sort((a, b) => {
      const staffA = staffMap.get(a);
      const staffB = staffMap.get(b);
      const nameA = (staffA?.full_name || staffA?.email || '').toLowerCase();
      const nameB = (staffB?.full_name || staffB?.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const staffSections = staffIds.map((staffId) => {
      const staff = staffMap.get(staffId);
      const rows = (recordsByStaff.get(staffId) || [])
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((record) => {
          const performedHours = calculateHours(record.clock_in, record.clock_out);
          const shiftHours = calculateShiftHours(
            staff.shift_start_time || '09:00',
            staff.shift_end_time || '17:00'
          );
          const cellStyle = 'style="border:1px solid #bbb; padding:6px;"';
          return `<tr>
            <td ${cellStyle}>${formatDate(record.date)}</td>
            <td ${cellStyle}>${formatTime(record.clock_in)}</td>
            <td ${cellStyle}>${formatTime(record.clock_out)}</td>
            <td ${cellStyle}>${shiftHours.toFixed(2)}h</td>
            <td ${cellStyle}>${performedHours.toFixed(2)}h</td>
            <td ${cellStyle}>${record.status || '-'}</td>
            <td ${cellStyle}>${record.overtime ? 'Yes' : 'No'}</td>
          </tr>`;
        })
        .join('');

      let totalShift = 0;
      let totalPerformed = 0;
      (recordsByStaff.get(staffId) || []).forEach((r) => {
        totalShift += calculateShiftHours(
          staff.shift_start_time || '09:00',
          staff.shift_end_time || '17:00'
        );
        totalPerformed += calculateHours(r.clock_in, r.clock_out);
      });

      return `
        <div style="page-break-after: always; margin-bottom: 24px;">
          <h3 style="margin: 0 0 4px 0;">${staff.full_name || staff.email || 'Unknown'}${
            staff.empNo || staff.emp_no ? ` (ID: ${staff.empNo || staff.emp_no})` : ''
          }</h3>
          <div style="margin-bottom: 8px; color: #555;">
            Shift: ${staff.shift_start_time || '09:00'} - ${staff.shift_end_time || '17:00'}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8px; border:1px solid #bbb;">
            <thead>
              <tr>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Date</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Clock In</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Clock Out</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Shift Hrs</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Worked Hrs</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">Status</th>
                <th style="border:1px solid #bbb; padding:6px; background:#f2f2f2;">OT</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                '<tr><td colspan="7" style="padding:8px; text-align:center; border:1px solid #bbb; background:#fafafa;">No records</td></tr>'
              }
            </tbody>
          </table>
          <div style="margin-top: 8px; font-size: 9px;">
            <strong>Total Shift:</strong> ${totalShift.toFixed(2)}h |
            <strong>Total Worked:</strong> ${totalPerformed.toFixed(2)}h |
            <strong>Diff:</strong> ${(totalPerformed - totalShift).toFixed(2)}h
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Detailed Time Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 16px;">
          <h2 style="text-align:center; margin:0;">Detailed Time Report - All Staff</h2>
          <div style="text-align:center; margin-bottom:16px; color:#444;">
            Period: ${monthName} ${selectedYear}
          </div>
          ${staffSections.join('')}
        </body>
      </html>
    `;
  };

  const exportAllStaffToPdf = async () => {
    setExportingAll(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);
      const dateFrom = startDate.toISOString().split('T')[0];
      const dateTo = endDate.toISOString().split('T')[0];

      const attendance = await fetchAttendanceReport({ dateFrom, dateTo });
      const attendanceFiltered = attendance.filter((record) => {
        const dept = record.empDeptt || record.emp_deptt || record.department;
        // GM: restrict to own depts
        if (isGeneralManager && userDepartments.length > 0) {
          return matchesDepartment(dept, userDepartments);
        }
        // CEO/Super Admin: use selected dept if provided
        if (isFullControlUser && selectedDepartment && selectedDepartment !== 'all') {
          return matchesDepartment(dept, [selectedDepartment]);
        }
        return true;
      });
      if (!attendance || attendance.length === 0) {
        if (Platform.OS === 'web') {
          window.alert('No attendance records for this period');
        } else {
          Alert.alert('No data', 'No attendance records for this period');
        }
        return;
      }

      const staffMap = new Map(staffList.map((staff) => [staff.user_id, staff]));
      const recordsByStaff = attendanceFiltered.reduce((acc, record) => {
        const sid = record.staff_id;
        if (!acc.has(sid)) acc.set(sid, []);
        acc.get(sid).push(record);
        return acc;
      }, new Map());

      if (Platform.OS === 'web') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(14);
        doc.text('Detailed Time Report - All Staff', pageWidth / 2, 32, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Period: ${MONTHS[selectedMonth]} ${selectedYear}`, pageWidth / 2, 50, {
          align: 'center',
        });

        let cursorY = 72;

        const staffIds = Array.from(recordsByStaff.keys()).sort((a, b) => {
          const staffA = staffMap.get(a);
          const staffB = staffMap.get(b);
          const nameA = (staffA?.full_name || staffA?.email || '').toLowerCase();
          const nameB = (staffB?.full_name || staffB?.email || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        staffIds.forEach((staffId, index) => {
          const staff = staffMap.get(staffId);
          const staffRecords = recordsByStaff.get(staffId) || [];
          if (!staff || staffRecords.length === 0) {
            return;
          }

          staffRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

          let totalShift = 0;
          let totalPerformed = 0;
          const rows = staffRecords.map((record) => {
            const performedHours = calculateHours(record.clock_in, record.clock_out);
            const shiftHours = calculateShiftHours(
              staff.shift_start_time || '09:00',
              staff.shift_end_time || '17:00'
            );
            totalShift += shiftHours;
            totalPerformed += performedHours;
            return [
              formatDate(record.date),
              formatTime(record.clock_in),
              formatTime(record.clock_out),
              shiftHours.toFixed(2),
              performedHours.toFixed(2),
              record.status || '-',
              record.overtime ? 'Yes' : 'No',
            ];
          });

          const staffTitle = `${staff.full_name || staff.email || 'Unknown'}${
            staff.empNo || staff.emp_no ? ` (ID: ${staff.empNo || staff.emp_no})` : ''
          }`;

          doc.setFontSize(11);
          doc.text(staffTitle, 40, cursorY);
          doc.setFontSize(8);
          doc.text(
            `Shift: ${staff.shift_start_time || '09:00'} - ${staff.shift_end_time || '17:00'}`,
            40,
            cursorY + 14
          );

          autoTable(doc, {
            startY: cursorY + 24,
            head: [['Date', 'Clock In', 'Clock Out', 'Shift Hrs', 'Worked Hrs', 'Status', 'OT']],
            body: rows,
            styles: {
              fontSize: 6,
              cellPadding: 5,
              lineColor: [120, 120, 120],
              lineWidth: 1,
            },
            headStyles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
            },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            tableLineWidth: 1,
            tableLineColor: [120, 120, 120],
            columnStyles: {
              0: { cellWidth: 76 },
              1: { cellWidth: 70 },
              2: { cellWidth: 70 },
              3: { cellWidth: 60, halign: 'right' },
              4: { cellWidth: 70, halign: 'right' },
              5: { cellWidth: 70 },
              6: { cellWidth: 40, halign: 'center' },
            },
            didDrawPage: () => {
              doc.setFontSize(8);
              doc.text(
                `Page ${doc.internal.getNumberOfPages()}`,
                pageWidth - 50,
                pageHeight - 16
              );
            },
          });

          const summaryY = doc.lastAutoTable.finalY + 8;
          doc.setFontSize(10);
          doc.text(`Total Shift Hours: ${totalShift.toFixed(2)}h`, 40, summaryY);
          doc.text(`Total Worked Hours: ${totalPerformed.toFixed(2)}h`, 200, summaryY);
          doc.text(
            `Difference: ${(totalPerformed - totalShift).toFixed(2)}h`,
            380,
            summaryY
          );

          cursorY = summaryY + 24;
          const nextIndex = index + 1;
          if (nextIndex < staffIds.length && cursorY > pageHeight - 80) {
            doc.addPage();
            cursorY = 60;
          } else if (nextIndex < staffIds.length) {
            doc.line(40, cursorY - 10, pageWidth - 40, cursorY - 10);
          }
        });

        const fileName = `detailed_time_all_${MONTHS[selectedMonth]}_${selectedYear}.pdf`;
        doc.save(fileName);
        return;
      }

      const html = buildAllStaffHtml(recordsByStaff, staffMap);
      const fileName = `detailed_time_all_${MONTHS[selectedMonth]}_${selectedYear}.pdf`;
      const { uri } = await Print.printToFileAsync({ html });
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: fileUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: fileName });
      } else {
        Alert.alert('Saved', `PDF report saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to export PDF');
      } else {
        Alert.alert('Error', 'Failed to export PDF');
      }
    } finally {
      setExportingAll(false);
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

  // Sort staff list alphabetically by name
  const sortedStaffList = [...staffList].sort((a, b) => {
    const nameA = (a.full_name || a.email || '').toLowerCase();
    const nameB = (b.full_name || b.email || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const staffOptions = [
    { label: 'Select Staff', value: '' },
    ...sortedStaffList.map(staff => {
      // Handle both emp_no (from /api/users) and empNo (from /api/users/staff)
      const empNo = staff.empNo || staff.emp_no || null;
      return {
        label: `${staff.full_name || staff.email}${empNo ? ` (ID: ${empNo})` : ''}`,
        value: staff.user_id,
        empNo: empNo,
        name: staff.full_name || staff.email,
      };
    }),
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

        {isFullControlUser && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Department</Text>
            <SimpleDropdown
              options={departmentOptions}
              selectedValue={selectedDepartment}
              onValueChange={setSelectedDepartment}
              placeholder="Select Department"
            />
          </View>
        )}

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Staff Member *</Text>
          <SearchableDropdown
            options={staffOptions}
            selectedValue={selectedStaff}
            onValueChange={setSelectedStaff}
            placeholder="Select Staff"
            searchPlaceholder="Search by name, email, or employee ID..."
            getSearchText={(option) => {
              if (!option || option.value === '') return '';
              const name = option.name || option.label || '';
              const empNo = option.empNo ? String(option.empNo) : '';
              return `${name} ${empNo}`.toLowerCase();
            }}
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

        <TouchableOpacity
          style={[
            styles.exportAllButton,
            (exportingAll || loading || staffList.length === 0) && styles.generateButtonDisabled,
          ]}
          onPress={exportAllStaffToPdf}
          disabled={exportingAll || loading || staffList.length === 0}
        >
          {exportingAll ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Export All Staff PDF</Text>
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
  exportAllButton: {
    backgroundColor: '#388e3c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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

