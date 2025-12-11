const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Location = require('../models/Location');
const StaffAssignment = require('../models/StaffAssignment');
const SupervisorLocation = require('../models/SupervisorLocation');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const { protect, normalizeRole } = require('../middleware/auth');

// Helper: Get system config
async function getSystemConfig() {
  const config = await SystemConfig.findOne({ configKey: 'attendance_settings' });
  return {
    gracePeriodMinutes: config?.gracePeriodMinutes || 15,
    minClockIntervalHours: config?.minClockIntervalHours || 6
  };
}

// Helper: Parse shift time
function parseShiftTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

// Helper: Check if office location
function isOfficeLocation(location) {
  if (!location) return false;
  const name = (location.name || '').toLowerCase();
  const code = (location.code || '').toLowerCase();
  return name.includes('office') || code.includes('office') || location.isOffice === true;
}

// Helper: Calculate distance
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// @route   POST /api/attendance/clock-in
// @desc    Clock in
// @access  Private
router.post('/clock-in', protect, async (req, res) => {
  try {
    const {
      staff_id,
      supervisor_id,
      nc_location_id,
      overtime,
      double_duty,
      lat,
      lng,
      clock_in_photo_url,
      is_override,
      clocked_by_id,
      attendance_date // Optional: for backdated attendance (YYYY-MM-DD)
    } = req.body;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      return res.status(400).json({
        success: false,
        error: 'staff_id, supervisor_id, and nc_location_id are required'
      });
    }

    const currentUser = req.user;
    const currentUserRole = normalizeRole(currentUser.role);
    const isGeneralManager = currentUserRole === 'general_manager';
    const isManager = currentUserRole === 'manager';
    const isManagerOrGM = isManager || isGeneralManager;

    // Get supervisor, location, and staff
    const [supervisor, location, staff] = await Promise.all([
      User.findById(supervisor_id),
      Location.findById(nc_location_id),
      staff_id !== supervisor_id ? User.findById(staff_id) : User.findById(supervisor_id)
    ]);

    if (!supervisor || !location) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor or location not found'
      });
    }

    const isOfficeLoc = isOfficeLocation(location);
    const isSelfAction = staff_id === currentUser._id.toString();

    // Manager/GM must clock in at office
    if (isManagerOrGM && isSelfAction && !isOfficeLoc) {
      return res.status(400).json({
        success: false,
        error: 'Managers and General Managers must clock in at office location'
      });
    }

    // Verify location coordinates if provided
    if (lat && lng && location.centerLat && location.centerLng && isManagerOrGM && isSelfAction) {
      const distance = calculateDistance(lat, lng, location.centerLat, location.centerLng);
      const radiusMeters = location.radiusMeters || 100;
      if (distance > radiusMeters) {
        return res.status(400).json({
          success: false,
          error: 'You must be at the office location to clock in'
        });
      }
    }

    // Override mode check
    const overrideMode = is_override === true && isGeneralManager && !isSelfAction;

    if (!overrideMode) {
      // Verify supervisor-location assignment
      const supLoc = await SupervisorLocation.findOne({
        supervisorId: supervisor_id,
        ncLocationId: nc_location_id
      });

      if (!supLoc) {
        return res.status(400).json({
          success: false,
          error: 'Supervisor is not assigned to this location'
        });
      }

      // Check staff assignment (if not self-action)
      if (staff_id !== supervisor_id) {
        const assignment = await StaffAssignment.findOne({
          staffId: staff_id,
          supervisorId: supervisor_id,
          ncLocationId: nc_location_id,
          isActive: true
        });

        if (!assignment) {
          return res.status(400).json({
            success: false,
            error: 'Staff is not assigned to this supervisor at this location'
          });
        }
      }
    }

    // Check for existing attendance
    // Allow managers to clock in/out staff for today or yesterday
    let targetDate = new Date();
    let todayStr = targetDate.toISOString().split('T')[0];
    
    if (attendance_date && isManager && !isSelfAction) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(attendance_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }
      
      // Allow today or yesterday only (not future dates or more than 1 day back)
      const requestedDate = new Date(attendance_date + 'T00:00:00');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Check if date is in the future
      if (requestedDate >= tomorrow) {
        return res.status(400).json({
          success: false,
          error: 'Cannot create attendance for future dates'
        });
      }
      
      // Check if date is more than 1 day old
      if (requestedDate < yesterday) {
        return res.status(400).json({
          success: false,
          error: 'Can only mark attendance for today or yesterday'
        });
      }
      
      todayStr = attendance_date;
      targetDate = requestedDate;
    }
    
    const existingAttendance = await Attendance.findOne({
      staffId: staff_id,
      attendanceDate: todayStr,
      clockOut: null
    }).sort({ createdAt: -1 });

    if (existingAttendance) {
      return res.json({
        success: true,
        data: {
          id: existingAttendance._id,
          staff_id: staff_id,
          supervisor_id: existingAttendance.supervisorId?.toString() || supervisor_id,
          nc_location_id: existingAttendance.ncLocationId?.toString() || nc_location_id,
          attendance_date: existingAttendance.attendanceDate,
          clock_in: existingAttendance.clockIn,
          status: existingAttendance.status,
          overtime: existingAttendance.overtime,
          double_duty: existingAttendance.doubleDuty,
          clock_in_lat: existingAttendance.clockInLat,
          clock_in_lng: existingAttendance.clockInLng,
          clock_in_photo_url: existingAttendance.clockInPhotoUrl,
          alreadyClockedIn: true
        }
      });
    }

    // Get system config
    const systemConfig = await getSystemConfig();
    
    // Calculate if late based on USER's shift time (not location's shift time)
    // For backdated attendance, use the target date; otherwise use current time
    const now = attendance_date && isManager && !isSelfAction ? targetDate : new Date();
    
    // Use staff member's personal shift configuration
    const staffShiftStartTime = staff.shiftStartTime || '09:00';
    let shiftTime = parseShiftTime(staffShiftStartTime) || { hour: 9, minute: 0 };
    
    const clockInMinutes = now.getHours() * 60 + now.getMinutes();
    const workStartMinutes = shiftTime.hour * 60 + shiftTime.minute;
    const isLate = clockInMinutes > (workStartMinutes + systemConfig.gracePeriodMinutes);

    // Check if today is an off day (weekly or company holiday)
    const Holiday = require('../models/Holiday');
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    
    // Get staff's shift configuration
    const staffShiftDays = staff.shiftDays || 6; // Default to 6-day week
    
    // Check weekly off days
    let isWeeklyOff = false;
    if (staffShiftDays === 6) {
      // 6-day shift: Only Sunday is off
      isWeeklyOff = (dayOfWeek === 0);
    } else if (staffShiftDays === 5) {
      // 5-day shift: Saturday and Sunday are off
      isWeeklyOff = (dayOfWeek === 0 || dayOfWeek === 6);
    }
    
    // Check company holidays
    const companyHoliday = await Holiday.findOne({ date: todayStr });
    const isCompanyHoliday = !!companyHoliday;
    
    // Automatic overtime if working on any off day
    const isOffDay = isWeeklyOff || isCompanyHoliday;
    const autoOvertime = isOffDay;
    const finalOvertime = overtime || autoOvertime;

    // Create attendance record
    // clockedInBy should be set when someone else clocks in on behalf of staff
    const clockedByOther = !isSelfAction;
    
    const attendance = await Attendance.create({
      staffId: staff_id,
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id,
      attendanceDate: todayStr,
      clockIn: now,
      overtime: finalOvertime,
      doubleDuty: double_duty || false,
      status: isLate ? 'Late' : 'Present',
      approvalStatus: 'pending',
      clockInLat: lat || null,
      clockInLng: lng || null,
      clockInPhotoUrl: clock_in_photo_url || null,
      clockedInBy: clockedByOther ? currentUser._id : null,
      isOverride: overrideMode
    });

    // Get clocked by name if someone else clocked them in
    let clockedByName = null;
    if (clockedByOther && attendance.clockedInBy) {
      clockedByName = currentUser.fullName || currentUser.username || 'Unknown';
    }

    res.json({
      success: true,
      data: {
        id: attendance._id,
        staff_id: staff_id,
        supervisor_id: supervisor_id,
        nc_location_id: nc_location_id,
        attendance_date: attendance.attendanceDate,
        clock_in: attendance.clockIn,
        status: attendance.status,
        overtime: attendance.overtime,
        double_duty: attendance.doubleDuty,
        clock_in_lat: attendance.clockInLat,
        clock_in_lng: attendance.clockInLng,
        clock_in_photo_url: attendance.clockInPhotoUrl,
        clocked_in_by: clockedByName,
        is_override: attendance.isOverride,
        alreadyClockedIn: false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/attendance/clock-out
// @desc    Clock out
// @access  Private
router.post('/clock-out', protect, async (req, res) => {
  try {
    const {
      staff_id,
      supervisor_id,
      nc_location_id,
      lat,
      lng,
      clock_out_photo_url,
      is_override,
      attendance_date // Optional: for backdated attendance (YYYY-MM-DD)
    } = req.body;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      return res.status(400).json({
        success: false,
        error: 'staff_id, supervisor_id, and nc_location_id are required'
      });
    }

    const currentUser = req.user;
    const currentUserRole = normalizeRole(currentUser.role);
    const isGeneralManager = currentUserRole === 'general_manager';
    const isManager = currentUserRole === 'manager';
    const isManagerOrGM = isManager || isGeneralManager;

    const [supervisor, location, staff] = await Promise.all([
      User.findById(supervisor_id),
      Location.findById(nc_location_id),
      User.findById(staff_id)
    ]);

    if (!supervisor || !location || !staff) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor, location, or staff not found'
      });
    }

    const isOfficeLoc = isOfficeLocation(location);
    const isSelfAction = staff_id === currentUser._id.toString();

    // Manager/GM must clock out at office
    if (isManagerOrGM && isSelfAction && !isOfficeLoc) {
      return res.status(400).json({
        success: false,
        error: 'Managers and General Managers must clock out at office location'
      });
    }

    const overrideMode = is_override === true && isGeneralManager && !isSelfAction;

    if (!overrideMode) {
      const supLoc = await SupervisorLocation.findOne({
        supervisorId: supervisor_id,
        ncLocationId: nc_location_id
      });

      if (!supLoc) {
        return res.status(400).json({
          success: false,
          error: 'Supervisor is not assigned to this location'
        });
      }
    }

    // Find today's attendance (or backdated attendance for managers)
    let todayStr = new Date().toISOString().split('T')[0];
    
    if (attendance_date && isManager && !isSelfAction) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(attendance_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }
      todayStr = attendance_date;
    }
    
    const attendance = await Attendance.findOne({
      staffId: staff_id,
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id,
      attendanceDate: todayStr
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'No attendance record found for today'
      });
    }

    if (attendance.clockOut) {
      return res.json({
        success: true,
        data: {
          id: attendance._id,
          staff_id: staff_id,
          supervisor_id: supervisor_id,
          nc_location_id: nc_location_id,
          attendance_date: attendance.attendanceDate,
          clock_in: attendance.clockIn,
          clock_out: attendance.clockOut,
          clock_out_lat: attendance.clockOutLat,
          clock_out_lng: attendance.clockOutLng,
          clock_out_photo_url: attendance.clockOutPhotoUrl,
          alreadyClockedOut: true
        }
      });
    }

    // Check minimum interval
    if (!overrideMode && attendance.clockIn) {
      const systemConfig = await getSystemConfig();
      const now = new Date();
      const clockIn = new Date(attendance.clockIn);
      const timeDiffHours = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      if (timeDiffHours < systemConfig.minClockIntervalHours) {
        const remainingMinutes = Math.ceil((systemConfig.minClockIntervalHours - timeDiffHours) * 60);
        return res.status(400).json({
          success: false,
          error: `Cannot clock out yet. Minimum interval is ${systemConfig.minClockIntervalHours} hours. Please wait ${remainingMinutes} more minute(s).`
        });
      }
    }

    // Update clock out
    // clockedOutBy should be set when someone else clocks out on behalf of staff
    const clockedOutByOther = !isSelfAction;
    
    attendance.clockOut = new Date();
    attendance.clockOutLat = lat || null;
    attendance.clockOutLng = lng || null;
    attendance.clockOutPhotoUrl = clock_out_photo_url || null;
    attendance.clockedOutBy = clockedOutByOther ? currentUser._id : null;
    if (!attendance.isOverride && overrideMode) {
      attendance.isOverride = true;
    }
    await attendance.save();

    // Get clocked by name if someone else clocked them out
    let clockedOutByName = null;
    if (clockedOutByOther) {
      clockedOutByName = currentUser.fullName || currentUser.username || 'Unknown';
    }

    res.json({
      success: true,
      data: {
        id: attendance._id,
        staff_id: staff_id,
        supervisor_id: supervisor_id,
        nc_location_id: nc_location_id,
        clock_out: attendance.clockOut,
        clock_out_lat: attendance.clockOutLat,
        clock_out_lng: attendance.clockOutLng,
        clock_out_photo_url: attendance.clockOutPhotoUrl,
        clocked_out_by: clockedOutByName,
        is_override: attendance.isOverride,
        alreadyClockedOut: false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const attendances = await Attendance.find({ attendanceDate: todayStr })
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name code')
      .populate('clockedInBy', 'fullName username')
      .populate('clockedOutBy', 'fullName username')
      .sort({ createdAt: -1 });

    const formatted = attendances.map(att => ({
      id: att._id,
      staffId: att.staffId?._id?.toString(),
      staffName: att.staffId?.fullName || att.staffId?.username || 'Unknown Staff',
      supervisorId: att.supervisorId?._id?.toString(),
      supervisorName: att.supervisorId?.fullName || att.supervisorId?.username || 'Unknown Supervisor',
      nc_location_id: att.ncLocationId?._id?.toString(),
      nc: att.ncLocationId?.name || 'N/A',
      date: att.attendanceDate,
      clockIn: att.clockIn,
      clockOut: att.clockOut,
      status: att.status ? att.status.toLowerCase().replace(' ', '-') : 'absent',
      approvalStatus: att.approvalStatus || 'pending',
      overtime: att.overtime || false,
      doubleDuty: att.doubleDuty || false,
      clockedInBy: att.clockedInBy ? (att.clockedInBy.fullName || att.clockedInBy.username || null) : null,
      clockedOutBy: att.clockedOutBy ? (att.clockedOutBy.fullName || att.clockedOutBy.username || null) : null,
      isOverride: att.isOverride || false
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/attendance/report
// @desc    Get attendance report
// @access  Private
router.get('/report', protect, async (req, res) => {
  try {
    const { dateFrom, dateTo, supervisorId, areaId, status = 'all' } = req.query;
    const currentUser = req.user;
    const currentUserRole = normalizeRole(currentUser.role);
    const isCEOOrSuperAdmin = ['ceo', 'super_admin'].includes(currentUserRole);
    const isGeneralManager = currentUserRole === 'general_manager';

    // Validate required fields (filter out 'undefined' and 'null' strings)
    const validDateFrom = dateFrom && dateFrom !== 'undefined' && dateFrom !== 'null' ? dateFrom : null;
    const validDateTo = dateTo && dateTo !== 'undefined' && dateTo !== 'null' ? dateTo : null;

    if (!validDateFrom || !validDateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required'
      });
    }

    const query = {
      attendanceDate: { $gte: validDateFrom, $lte: validDateTo }
    };

    // Only add to query if valid value (not undefined, null, or string versions)
    if (supervisorId && supervisorId !== 'undefined' && supervisorId !== 'null') {
      query.supervisorId = supervisorId;
    }

    if (areaId && areaId !== 'undefined' && areaId !== 'null') {
      query.ncLocationId = areaId;
    }

    if (status && status !== 'all' && status !== 'undefined' && status !== 'null') {
      query.status = status;
    }

    // For General Manager: Filter by department
    let departmentFilter = null;
    if (isGeneralManager && !isCEOOrSuperAdmin) {
      // Get General Manager's departments (prefer departments array, fallback to department)
      const gmDepartments = currentUser.departments && currentUser.departments.length > 0
        ? currentUser.departments
        : currentUser.department
        ? [currentUser.department]
        : [];
      
      if (gmDepartments.length > 0) {
        departmentFilter = gmDepartments;
      } else {
        // GM with no departments assigned - return empty results for security
        return res.json({
          success: true,
          data: []
        });
      }
    }

    // Build user query - get all active users
    const userQuery = { isActive: true };
    
    // Apply department filter for General Manager
    if (departmentFilter && departmentFilter.length > 0) {
      userQuery.$or = [
        { empDeptt: { $in: departmentFilter } },
        { department: { $in: departmentFilter } }
      ];
    }

    // Fetch all active users (filtered by department if GM)
    const allActiveUsers = await User.find(userQuery)
      .select('fullName username email empNo empDeptt role department shiftDays')
      .sort({ fullName: 1 });

    // Fetch attendance records for the date range
    const attendances = await Attendance.find(query)
      .populate('staffId', 'fullName username email empNo empDeptt role department shiftDays')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name code')
      .sort({ attendanceDate: -1, createdAt: -1 });

    // Create a map of attendance records by staff_id and date
    const attendanceMap = new Map();
    attendances.forEach(att => {
      if (att.staffId) {
        const staffId = att.staffId._id.toString();
        const dateKey = att.attendanceDate;
        const key = `${staffId}_${dateKey}`;
        attendanceMap.set(key, att);
      }
    });

    // Generate all dates in the range
    const dates = [];
    const startDate = new Date(validDateFrom);
    const endDate = new Date(validDateTo);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create report entries for all active users
    const formatted = [];
    
    // Helper to detect weekly off-day based on shiftDays (5-day: Sat+Sun, 6-day: Sun only)
    const isOffDay = (shiftDays, dateStr) => {
      const day = new Date(dateStr).getDay(); // 0 = Sun, 6 = Sat
      if (shiftDays === 5) {
        return day === 0 || day === 6;
      }
      return day === 0;
    };

    allActiveUsers.forEach(user => {
      const userId = user._id.toString();
      const userShiftDays = user.shiftDays || 6;
      
      // For each date in the range, create an entry
      dates.forEach(dateStr => {
        const key = `${userId}_${dateStr}`;
        const attendance = attendanceMap.get(key);
        const weeklyOff = isOffDay(userShiftDays, dateStr);
        
        if (attendance) {
          // User has attendance record for this date
          const normalizedStatus = attendance.status || 'Absent';
          const finalStatus = weeklyOff && normalizedStatus.toLowerCase() === 'absent'
            ? 'Holiday'
            : normalizedStatus;

          formatted.push({
            id: attendance._id,
            staff_id: userId,
            staff_name: user.fullName || user.username || 'Unknown',
            empNo: user.empNo || null,
            emp_no: user.empNo || null,
            empDeptt: user.empDeptt || null,
            emp_deptt: user.empDeptt || null,
            role: user.role || null,
            shiftDays: userShiftDays,
            shift_days: userShiftDays,
            supervisor_id: attendance.supervisorId?._id?.toString() || null,
            supervisor_name: attendance.supervisorId?.fullName || attendance.supervisorId?.username || 'Unknown',
            nc_location_id: attendance.ncLocationId?._id?.toString() || null,
            location_name: attendance.ncLocationId?.name || 'N/A',
            area_name: attendance.ncLocationId?.name || 'N/A',
            attendance_date: dateStr,
            date: dateStr,
            clock_in: attendance.clockIn || null,
            clock_out: attendance.clockOut || null,
            status: finalStatus,
            approval_status: attendance.approvalStatus || 'pending',
            overtime: attendance.overtime || false,
            double_duty: attendance.doubleDuty || false
          });
        } else {
          // User has no attendance record for this date - mark as absent
          const finalStatus = weeklyOff ? 'Holiday' : 'Absent';

          formatted.push({
            id: null,
            staff_id: userId,
            staff_name: user.fullName || user.username || 'Unknown',
            empNo: user.empNo || null,
            emp_no: user.empNo || null,
            empDeptt: user.empDeptt || null,
            emp_deptt: user.empDeptt || null,
            role: user.role || null,
            shiftDays: userShiftDays,
            shift_days: userShiftDays,
            supervisor_id: null,
            supervisor_name: 'N/A',
            nc_location_id: null,
            location_name: 'N/A',
            area_name: 'N/A',
            attendance_date: dateStr,
            date: dateStr,
            clock_in: null,
            clock_out: null,
            status: finalStatus,
            approval_status: 'pending',
            overtime: false,
            double_duty: false
          });
        }
      });
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/attendance/leadership
// @desc    Get today's attendance for leadership roles (above staff)
// @access  Private - CEO and Super Admin only
router.get('/leadership', protect, async (req, res) => {
  try {
    const user = req.user;
    const userRole = normalizeRole(user.role);

    // Only CEO and Super Admin can access leadership attendance
    if (!['ceo', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. CEO or Super Admin access required.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch all users with leadership roles (all roles above staff)
    const leadershipRoles = ['supervisor', 'sub_engineer', 'manager', 'general_manager'];
    const leadershipUsers = await User.find({
      role: { $in: leadershipRoles },
      isActive: true
    }).select('fullName username email role department');

    // Fetch today's attendance for leadership users
    const leadershipUserIds = leadershipUsers.map(u => u._id);
    const attendances = await Attendance.find({
      attendanceDate: todayStr,
      staffId: { $in: leadershipUserIds }
    })
      .populate('ncLocationId', 'name code')
      .populate('clockedInBy', 'fullName username')
      .populate('clockedOutBy', 'fullName username')
      .sort({ createdAt: -1 });

    // Create a map of attendance by staff ID
    const attendanceMap = new Map();
    attendances.forEach(att => {
      const staffId = att.staffId?.toString();
      if (staffId && !attendanceMap.has(staffId)) {
        attendanceMap.set(staffId, att);
      }
    });

    // Build the result array with all leadership users and their attendance status
    const result = leadershipUsers.map(user => {
      const userId = user._id.toString();
      const attendance = attendanceMap.get(userId);

      const fullName = user.fullName || user.username || 'Unknown';
      const role = user.role || 'unknown';
      const department = user.department || null;

      let clockIn = null;
      let clockOut = null;
      let status = 'absent';
      let nc_location_id = null;
      let nc_location_name = 'N/A';
      let clockedInBy = null;
      let clockedOutBy = null;
      let isOverride = false;

      if (attendance) {
        clockIn = attendance.clockIn ? attendance.clockIn.toISOString() : null;
        clockOut = attendance.clockOut ? attendance.clockOut.toISOString() : null;
        status = attendance.status ? attendance.status.toLowerCase().replace(' ', '-') : 'absent';
        
        if (attendance.ncLocationId) {
          nc_location_id = attendance.ncLocationId._id?.toString();
          nc_location_name = attendance.ncLocationId.name || 'N/A';
        }

        // Get clockedBy information
        if (attendance.clockedInBy) {
          const clockedInById = attendance.clockedInBy._id?.toString();
          if (clockedInById && clockedInById !== userId) {
            clockedInBy = attendance.clockedInBy.fullName || attendance.clockedInBy.username || null;
          }
        }

        if (attendance.clockedOutBy) {
          const clockedOutById = attendance.clockedOutBy._id?.toString();
          if (clockedOutById && clockedOutById !== userId) {
            clockedOutBy = attendance.clockedOutBy.fullName || attendance.clockedOutBy.username || null;
          }
        }

        isOverride = attendance.isOverride || false;
      }

      // Determine status if attendance record exists
      if (attendance) {
        if (clockIn && !clockOut) {
          status = 'present';
        } else if (clockIn && clockOut) {
          status = 'present';
        }
      }

      return {
        id: attendance ? attendance._id.toString() : `${userId}-${todayStr}`,
        userId,
        name: fullName,
        role,
        department,
        clockIn,
        clockOut,
        status,
        nc_location_id,
        nc_location_name,
        clockedInBy,
        clockedOutBy,
        isOverride,
      };
    });

    // Sort by role (General Manager, Manager, Sub Engineer/Supervisor) then by name
    const roleOrder = { general_manager: 1, manager: 2, sub_engineer: 3, supervisor: 3 };
    result.sort((a, b) => {
      const roleDiff = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
      if (roleDiff !== 0) return roleDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching leadership attendance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

