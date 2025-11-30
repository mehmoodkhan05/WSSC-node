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
      clocked_by_id
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
    const todayStr = new Date().toISOString().split('T')[0];
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
    
    // Calculate if late
    const now = new Date();
    let shiftTime = parseShiftTime(location.morningShiftStart) || 
                    parseShiftTime(location.nightShiftStart) || 
                    { hour: 9, minute: 0 };
    
    const clockInMinutes = now.getHours() * 60 + now.getMinutes();
    const workStartMinutes = shiftTime.hour * 60 + shiftTime.minute;
    const isLate = clockInMinutes > (workStartMinutes + systemConfig.gracePeriodMinutes);

    // Create attendance record
    const attendance = await Attendance.create({
      staffId: staff_id,
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id,
      attendanceDate: todayStr,
      clockIn: now,
      overtime: overtime || false,
      doubleDuty: double_duty || false,
      status: isLate ? 'Late' : 'Present',
      approvalStatus: 'pending',
      clockInLat: lat || null,
      clockInLng: lng || null,
      clockInPhotoUrl: clock_in_photo_url || null,
      clockedInBy: overrideMode || (!isSelfAction && isGeneralManager) ? currentUser._id : staff_id,
      isOverride: overrideMode || (!isSelfAction && isGeneralManager)
    });

    // Get clocked by name if different
    let clockedByName = null;
    if (attendance.clockedInBy?.toString() !== staff_id) {
      const clockedByUser = await User.findById(attendance.clockedInBy);
      clockedByName = clockedByUser ? (clockedByUser.fullName || clockedByUser.username || 'Unknown') : null;
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
      is_override
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

    // Find today's attendance
    const todayStr = new Date().toISOString().split('T')[0];
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
    attendance.clockOut = new Date();
    attendance.clockOutLat = lat || null;
    attendance.clockOutLng = lng || null;
    attendance.clockOutPhotoUrl = clock_out_photo_url || null;
    attendance.clockedOutBy = overrideMode || (!isSelfAction && isGeneralManager) ? currentUser._id : staff_id;
    if (!attendance.isOverride) {
      attendance.isOverride = overrideMode || (!isSelfAction && isGeneralManager);
    }
    await attendance.save();

    // Get clocked by name
    let clockedOutByName = null;
    if (attendance.clockedOutBy?.toString() !== staff_id) {
      const clockedOutByUser = await User.findById(attendance.clockedOutBy);
      clockedOutByName = clockedOutByUser ? (clockedOutByUser.fullName || clockedOutByUser.username || 'Unknown') : null;
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
      clockedInBy: att.clockedInBy?._id?.toString() || null,
      clockedOutBy: att.clockedOutBy?._id?.toString() || null,
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

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required'
      });
    }

    const query = {
      attendanceDate: { $gte: dateFrom, $lte: dateTo }
    };

    if (supervisorId) {
      query.supervisorId = supervisorId;
    }

    if (areaId) {
      query.ncLocationId = areaId;
    }

    if (status !== 'all') {
      query.status = status;
    }

    const attendances = await Attendance.find(query)
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name code')
      .sort({ attendanceDate: -1, createdAt: -1 });

    const formatted = attendances.map(att => ({
      id: att._id,
      staff_id: att.staffId?._id?.toString(),
      staff_name: att.staffId?.fullName || att.staffId?.username || 'Unknown',
      supervisor_id: att.supervisorId?._id?.toString(),
      supervisor_name: att.supervisorId?.fullName || att.supervisorId?.username || 'Unknown',
      nc_location_id: att.ncLocationId?._id?.toString(),
      location_name: att.ncLocationId?.name || 'N/A',
      date: att.attendanceDate,
      clock_in: att.clockIn,
      clock_out: att.clockOut,
      status: att.status || 'Absent',
      approval_status: att.approvalStatus || 'pending',
      overtime: att.overtime || false,
      double_duty: att.doubleDuty || false
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

module.exports = router;

