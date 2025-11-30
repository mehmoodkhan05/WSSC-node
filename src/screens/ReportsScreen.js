import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchAttendanceReport } from '../lib/attendance';
import {
  ROLE,
  normalizeRole,
  hasExecutivePrivileges,
} from '../lib/roles';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getEncoding = (encodingName) => {
  const encodingType = FileSystem?.EncodingType?.[encodingName];
  if (encodingType) {
    return encodingType;
  }
  if (encodingName === 'UTF8') {
    return 'utf8';
  }
  if (encodingName === 'Base64') {
    return 'base64';
  }
  return undefined;
};

// Map status to attendance codes
const getAttendanceCode = (status) => {
  const normalized = status?.toLowerCase() || '';
  if (normalized === 'present') return 'P';
  if (normalized === 'late') return 'HD'; // Half-day for late
  if (normalized === 'on-leave' || normalized === 'onleave') return 'L';
  if (normalized === 'absent') return 'A';
  return '';
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ReportsScreen = () => {
  const { profile } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preparedBy, setPreparedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [acceptedBy, setAcceptedBy] = useState('');

  // Generate years list (current year ± 5 years)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  }, []);

  // Calculate date range for selected month
  const getMonthDateRange = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    return {
      from: firstDay,
      to: lastDay,
    };
  }, [selectedMonth, selectedYear]);

  // Get all dates in the month
  const getMonthDates = useMemo(() => {
    const dates = [];
    const { from, to } = getMonthDateRange;
    const current = new Date(from);
    while (current <= to) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [getMonthDateRange]);

  // Group attendance by employee
  const groupedByEmployee = useMemo(() => {
    const grouped = new Map();
    
    attendanceData.forEach(record => {
      const staffId = record.staff_id || 'unknown';
      const empNo = record.emp_no || null;
      const role = record.role || null;
      const department = record.department || null;
      const location = record.area_name || 'N/A';
      
      if (!grouped.has(staffId)) {
        grouped.set(staffId, {
          staffId,
          empNo,
          role,
          department,
          location,
          staffName: record.staff_name || 'Unknown',
          attendance: new Map(),
        });
      }
      
      const employee = grouped.get(staffId);
      // Update fields if they weren't set initially
      if (!employee.empNo && empNo) {
        employee.empNo = empNo;
      }
      if (!employee.role && role) {
        employee.role = role;
      }
      if (!employee.department && department) {
        employee.department = department;
      }
      if (!employee.location && location) {
        employee.location = location;
      }
      const date = record.attendance_date;
      if (date) {
        employee.attendance.set(date, {
          status: record.status,
          code: getAttendanceCode(record.status),
          overtime: record.overtime || false,
          double_duty: record.double_duty || false,
        });
      }
    });

    // Calculate summary for each employee
    const result = Array.from(grouped.values()).map(emp => {
      let present = 0;
      let leave = 0;
      let absent = 0;
      let overtime = 0;
      let doubleDuty = 0;

      getMonthDates.forEach(date => {
        const dateStr = formatDateForKey(date);
        const att = emp.attendance.get(dateStr);
        if (att) {
          const code = att.code;
          if (code === 'P') present++;
          else if (code === 'HD') present++; // Half-day counts as present
          else if (code === 'L') leave++;
          else if (code === 'A') absent++;
          if (att.overtime) overtime++;
          if (att.double_duty) doubleDuty++;
        } else {
          absent++; // No record means absent
        }
      });

      return {
        ...emp,
        summary: {
          present,
          leave,
          absent,
          overtime,
          doubleDuty,
          workingDays: getMonthDates.length,
        },
      };
    });

    return result.sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [attendanceData, getMonthDates]);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const { from, to } = getMonthDateRange;
      const dateFrom = formatDateForAPI(from);
      const dateTo = formatDateForAPI(to);

      const data = await fetchAttendanceReport({
        dateFrom,
        dateTo,
      });
      setAttendanceData(data);
    } catch (error) {
      console.error('Report error:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to generate attendance report');
      } else {
        Alert.alert('Error', 'Failed to generate attendance report');
      }
    } finally {
      setLoading(false);
    }
  };

  const buildPdfHtml = () => {
    const monthName = MONTHS[selectedMonth];
    const monthYear = `${monthName}, ${selectedYear}`;
    
    // Build date headers
    const dateHeaders = getMonthDates.map(date => {
      const day = date.getDate();
      const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
      return `<th style="border: 1px solid #000; padding: 4px; font-size: 10px; text-align: center;">${day}<br/>${dayName}</th>`;
    }).join('');

    // Build employee rows
    const employeeRows = groupedByEmployee.map(emp => {
      const dateCells = getMonthDates.map(date => {
        const dateStr = formatDateForKey(date);
        const att = emp.attendance.get(dateStr);
        const code = att ? att.code : '';
        return `<td style="border: 1px solid #000; padding: 0; font-size: 7px; text-align: center; width: 12px; min-width: 12px;">${code}</td>`;
      }).join('');

      return `
        <tr>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px;">${emp.empNo || emp.staffId || ''}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px;">${emp.staffName}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px;">${formatRole(emp.role)}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px;">${emp.department || '-'}</td>
          ${dateCells}
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center;">${emp.summary.present}</td>
          <td style="border: 1px solid #000; padding: 4px; font-size: 9px; text-align: center;">${emp.summary.leave}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center;">${emp.summary.absent}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center;">${emp.summary.overtime}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center;">${emp.summary.doubleDuty}</td>
          <td style="border: 1px solid #000; padding: 2px; font-size: 9px; text-align: center;">${emp.summary.workingDays}</td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Attendance Report - ${monthYear}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 20px;
        }
        html, body {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        body { 
        font-family: Arial, sans-serif; 
        padding: 20px; 
        font-size: 10px;
      }
      .header {
        margin-bottom: 20px;
      }
      .logo-section {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      .logo {
        width: 60px;
        height: 60px;
        background: #0066cc;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        margin-right: 15px;
        border-radius: 4px;
      }
      .company-name {
        font-size: 16px;
        font-weight: bold;
        color: #000;
      }
      .company-address {
        font-size: 11px;
        color: #333;
        margin-top: 4px;
      }
      .report-title {
        font-size: 14px;
        font-weight: bold;
        margin: 15px 0;
        text-align: center;
      }
      .workflow {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
        font-size: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9px;
        margin-bottom: 20px;
      }
      th {
        background-color: #f0f0f0;
        font-weight: bold;
        border: 1px solid #000;
        padding: 6px;
        text-align: center;
      }
      td {
        border: 1px solid #000;
        padding: 4px;
      }
      .footer {
        margin-top: 20px;
        font-size: 9px;
        text-align: center;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo-section">
        <div class="logo">WSSCS</div>
        <div>
          <div class="company-name">WATER & SANITATION SERVICE COMPANY MINGORA SWAT</div>
          <div class="company-address">MSK TOWER, G.T ROAD, RAHIMABAD</div>
        </div>
      </div>
      <div class="report-title">Attendance: ${monthYear}</div>
      <div class="workflow">
        <div>Prepared By: ${preparedBy || 'N/A'}</div>
        <div>Approved By: ${approvedBy || 'N/A'}</div>
        <div>Accepted By: ${acceptedBy || 'N/A'}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">E.No</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">Name</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">Role</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">Dept</th>
          <th colspan="${getMonthDates.length}" style="border: 1px solid #000; padding: 1px;">Daily Attendance</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">P</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">L</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">A</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">OT</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">DD</th>
          <th rowspan="2" style="border: 1px solid #000; padding: 2px;">WD</th>
        </tr>
        <tr>
          ${dateHeaders}
        </tr>
      </thead>
      <tbody>
        ${employeeRows}
      </tbody>
    </table>
    <div class="footer">
      This Computer generated Report doesn't require any Signature.<br/>
      1 of 1
    </div>
  </body>
</html>`;
  };

  const exportToPDF = async () => {
    try {
      if (groupedByEmployee.length === 0) {
        if (Platform.OS === 'web') {
          window.alert('No data to export');
        } else {
          Alert.alert('Error', 'No data to export');
        }
        return;
      }

      const html = buildPdfHtml();
      const fileName = `attendance_report_${MONTHS[selectedMonth]}_${selectedYear}.pdf`;
      const A4_WIDTH_POINTS = 842; // ~11.69in * 72
      const A4_HEIGHT_POINTS = 595; // ~8.27in * 72

      if (Platform.OS === 'web') {
        try {
          const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4',
          });

          const pageWidth = doc.internal.pageSize.getWidth();

          doc.setTextColor(0, 0, 0);
          doc.setFontSize(18);
          doc.text('WATER & SANITATION SERVICE COMPANY MINGORA SWAT', pageWidth / 2, 34, {
            align: 'center',
          });
          doc.setFontSize(11);
          doc.text('MSK TOWER, G.T ROAD, RAHIMABAD', pageWidth / 2, 52, { align: 'center' });
          doc.setFontSize(13);
          doc.text(`Attendance: ${MONTHS[selectedMonth]} ${selectedYear}`, pageWidth / 2, 70, {
            align: 'center',
          });

          doc.setFontSize(10);
          const metadataRows = [
            `Prepared By: ${preparedBy || 'N/A'}`,
            `Approved By: ${approvedBy || 'N/A'}`,
            `Accepted By: ${acceptedBy || 'N/A'}`,
          ];
          metadataRows.forEach((text, index) => {
            doc.text(text, 40 + index * 190, 88);
          });

          const dayHeaders = getMonthDates.map((date) => {
            const day = `${date.getDate()}`.padStart(2, '0');
            const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
            return `${day}\n${dayName}`;
          });

          const headRow = [
            'E.No',
            'Name',
            'Role',
            'Dept',
            ...dayHeaders,
            'P',
            'L',
            'A',
            'OT',
            'DD',
            'WD',
          ];

          const bodyRows = groupedByEmployee.map((emp) => {
            const dateValues = getMonthDates.map((date) => {
              const dateStr = formatDateForKey(date);
              const att = emp.attendance.get(dateStr);
              return att ? att.code : '';
            });

            return [
              emp.empNo || emp.staffId || '',
              emp.staffName,
              formatRole(emp.role),
              emp.department || '-',
              ...dateValues,
              emp.summary.present,
              emp.summary.leave,
              emp.summary.absent,
              emp.summary.overtime,
              emp.summary.doubleDuty,
              emp.summary.workingDays,
            ];
          });

          autoTable(doc, {
            head: [headRow],
            body: bodyRows,
            startY: 110,
            styles: {
              fontSize: 8,
              cellPadding: 3,
              textColor: [30, 30, 30],
              lineColor: [160, 160, 160],
              lineWidth: 0.6,
            },
            headStyles: {
              fillColor: [230, 230, 230],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              halign: 'center',
              lineColor: [120, 120, 120],
              lineWidth: 0.8,
            },
            alternateRowStyles: {
              fillColor: [248, 248, 248],
            },
            columnStyles: dayHeaders.reduce(
              (acc, _, index) => ({
                ...acc,
                [4 + index]: {
                  cellWidth: 16,
                  minCellWidth: 16,
                  halign: 'center',
                },
              }),
              {
                0: { cellWidth: 45 },
                1: { cellWidth: 100 },
                2: { cellWidth: 65 },
                3: { cellWidth: 45 },
              }
            ),
          });

          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text(
            'This computer generated report does not require signature.',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 20,
            { align: 'center' }
          );

          doc.save(fileName);
        } catch (error) {
          console.error('Web PDF export error:', error);
          window.alert('Failed to export PDF report');
        }
        return;
      }

      const { uri } = await Print.printToFileAsync({
        html,
        width: A4_WIDTH_POINTS,
        height: A4_HEIGHT_POINTS,
      });

      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.moveAsync({ from: uri, to: fileUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Attendance Report (PDF)',
        });
      } else {
        if (Platform.OS === 'web') {
          window.alert(`PDF report saved as ${fileName}`);
        } else {
          Alert.alert('Success', `PDF report saved as ${fileName}`);
        }
      }
    } catch (error) {
      console.error('PDF export error:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to export PDF report');
      } else {
        Alert.alert('Error', 'Failed to export PDF report');
      }
    }
  };

  const exportToExcel = async () => {
    try {
      if (groupedByEmployee.length === 0) {
        if (Platform.OS === 'web') {
          window.alert('No data to export');
        } else {
          Alert.alert('Error', 'No data to export');
        }
        return;
      }

      const monthName = MONTHS[selectedMonth];
      const monthYear = `${monthName}, ${selectedYear}`;

      // Build Excel data
      const headers = [
        'Emp. No.',
        'Emp. Name',
        'Role',
        'Department',
        'Location',
        ...getMonthDates.map(d => formatDateForExcel(d)),
        'Present',
        'Leave',
        'Absent',
        'Overtime',
        'D. Duty',
        'W. Days',
      ];

      const rows = groupedByEmployee.map(emp => {
        const dateValues = getMonthDates.map(date => {
          const dateStr = formatDateForKey(date);
          const att = emp.attendance.get(dateStr);
          return att ? att.code : '';
        });

        return [
          emp.empNo || emp.staffId || '',
          emp.staffName,
          formatRole(emp.role),
          emp.department || '-',
          emp.location || '-',
          ...dateValues,
          emp.summary.present,
          emp.summary.leave,
          emp.summary.absent,
          emp.summary.overtime,
          emp.summary.doubleDuty,
          emp.summary.workingDays,
        ];
      });

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

      const fileName = `attendance_report_${MONTHS[selectedMonth]}_${selectedYear}.xlsx`;

      if (Platform.OS === 'web') {
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
        encoding: getEncoding('Base64'),
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Attendance Report (Excel)',
        });
      } else {
        Alert.alert('Success', `Excel report saved as ${fileName}`);
      }
    } catch (error) {
      console.error('Excel export error:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to export Excel report');
      } else {
        Alert.alert('Error', 'Failed to export Excel report');
      }
    }
  };

  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const canAccessReports = hasExecutivePrivileges(role);

  if (!canAccessReports) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Access Denied</Text>
        <Text style={styles.accessDeniedSubtext}>
          Only General Manager and above can access reports
        </Text>
      </View>
    );
  }

  const monthName = MONTHS[selectedMonth];
  const monthYear = `${monthName} ${selectedYear}`;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Filters</Text>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>Month</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowMonthPicker(true)}
              >
                <Text style={styles.dateText}>{monthName}</Text>
                <Text style={styles.selectionCaret}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateField}>
              <Text style={styles.label}>Year</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowYearPicker(true)}
              >
                <Text style={styles.dateText}>{selectedYear}</Text>
                <Text style={styles.selectionCaret}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prepared By</Text>
            <TextInput
              style={styles.textInput}
              value={preparedBy}
              onChangeText={setPreparedBy}
              placeholder="Enter name and ID"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Approved By</Text>
            <TextInput
              style={styles.textInput}
              value={approvedBy}
              onChangeText={setApprovedBy}
              placeholder="Enter name and ID"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Accepted By</Text>
            <TextInput
              style={styles.textInput}
              value={acceptedBy}
              onChangeText={setAcceptedBy}
              placeholder="Enter name and ID"
            />
          </View>

          <TouchableOpacity
            style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            onPress={handleGenerateReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>Generate Report</Text>
            )}
          </TouchableOpacity>
        </View>

        {groupedByEmployee.length > 0 && (
          <View style={styles.section}>
            <View style={styles.reportHeader}>
              <Text style={styles.sectionTitle}>Report Results</Text>
              <Text style={styles.resultsSubtitle}>
                {groupedByEmployee.length} employee(s) • {monthYear}
              </Text>
            </View>

            <View style={styles.exportRow}>
              <TouchableOpacity style={[styles.exportCard, styles.pdfCard]} onPress={exportToPDF}>
                <Text style={styles.exportCardTitle}>Export PDF</Text>
                <Text style={styles.exportCardSubtitle}>Printable format</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportCard, styles.excelCard]} onPress={exportToExcel}>
                <Text style={styles.exportCardTitle}>Export Excel</Text>
                <Text style={styles.exportCardSubtitle}>.xlsx formatted file</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal style={styles.tableScroll}>
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.empNoCell]}>Emp. No.</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.empNameCell]}>Emp. Name</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.roleCell]}>Role</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.deptCell]}>Department</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.locationCell]}>Location</Text>
                  {getMonthDates.slice(0, 7).map((date, idx) => (
                    <Text key={idx} style={[styles.tableCell, styles.tableHeaderCell, styles.dateCell]}>
                      {date.getDate()}
                    </Text>
                  ))}
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.summaryCell]}>P</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.summaryCell]}>L</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.summaryCell]}>A</Text>
                </View>
                {groupedByEmployee.slice(0, 10).map((emp, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.empNoCell]}>{emp.empNo || emp.staffId || '-'}</Text>
                    <Text style={[styles.tableCell, styles.empNameCell]} numberOfLines={1}>{emp.staffName}</Text>
                    <Text style={[styles.tableCell, styles.roleCell]} numberOfLines={1}>{formatRole(emp.role)}</Text>
                      <Text style={[styles.tableCell, styles.deptCell]} numberOfLines={1}>{emp.department || '-'}</Text>
                      <Text style={[styles.tableCell, styles.locationCell]} numberOfLines={1}>{emp.location || '-'}</Text>
                    {getMonthDates.slice(0, 7).map((date, dateIdx) => {
                      const dateStr = formatDateForKey(date);
                      const att = emp.attendance.get(dateStr);
                      const code = att ? att.code : '';
                      return (
                        <Text key={dateIdx} style={[styles.tableCell, styles.dateCell, styles.codeCell]}>
                          {code}
                        </Text>
                      );
                    })}
                    <Text style={[styles.tableCell, styles.summaryCell]}>{emp.summary.present}</Text>
                    <Text style={[styles.tableCell, styles.summaryCell]}>{emp.summary.leave}</Text>
                    <Text style={[styles.tableCell, styles.summaryCell]}>{emp.summary.absent}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.noteText}>
              Note: Showing first 10 employees. Export to PDF/Excel to see full report.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Month Picker Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showMonthPicker}
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowMonthPicker(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Month</Text>
            <FlatList
              data={MONTHS}
              keyExtractor={(item, index) => `${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    selectedMonth === index && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedMonth(index);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedMonth === index && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Year Picker Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showYearPicker}
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowYearPicker(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Year</Text>
            <FlatList
              data={years}
              keyExtractor={(item) => `${item}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    selectedYear === item && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedYear(item);
                    setShowYearPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedYear === item && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper functions
const formatRole = (role) => {
  if (!role) return '-';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDateForKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForAPI = (date) => {
  return formatDateForKey(date);
};

const formatDateForExcel = (date) => {
  const day = date.getDate();
  const month = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getMonth()];
  return `${day} ${month}`;
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
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
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  resultsSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    fontSize: 15,
    color: '#111827',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 15,
    color: '#111827',
  },
  selectionCaret: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 12,
  },
  generateButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reportHeader: {
    marginBottom: 16,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  exportCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  exportCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  exportCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  pdfCard: {
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
  },
  excelCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
  },
  tableScroll: {
    marginBottom: 12,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    padding: 8,
    fontSize: 11,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  tableHeaderCell: {
    fontWeight: '600',
    color: '#374151',
  },
  empNoCell: {
    width: 80,
  },
  empNameCell: {
    width: 150,
  },
  roleCell: {
    width: 100,
  },
  deptCell: {
    width: 100,
  },
  locationCell: {
    width: 100,
  },
  dateCell: {
    width: 40,
    textAlign: 'center',
  },
  summaryCell: {
    width: 40,
    textAlign: 'center',
  },
  codeCell: {
    textAlign: 'center',
    fontWeight: '500',
  },
  noteText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#1f2937',
  },
  modalOptionTextSelected: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
});

export default ReportsScreen;
