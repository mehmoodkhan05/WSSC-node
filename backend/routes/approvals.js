const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/approvals/pending
// @desc    Get pending attendance approvals
// @access  Private
router.get('/pending', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager', 'supervisor'), async (req, res) => {
  try {
    const attendances = await Attendance.find({ approvalStatus: 'pending' })
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name code')
      .populate('clockedInBy', 'fullName username')
      .populate('clockedOutBy', 'fullName username')
      .sort({ createdAt: -1 });

    const formatted = attendances.map(att => ({
      id: att._id,
      staff_id: att.staffId?._id?.toString(),
      staff_name: att.staffId?.fullName || att.staffId?.username || 'Unknown',
      supervisor_id: att.supervisorId?._id?.toString(),
      supervisor_name: att.supervisorId?.fullName || 'Unknown',
      nc_location_id: att.ncLocationId?._id?.toString(),
      location_name: att.ncLocationId?.name || 'N/A',
      date: att.attendanceDate,
      clock_in: att.clockIn,
      clock_out: att.clockOut,
      status: att.status,
      approval_status: att.approvalStatus,
      overtime: att.overtime,
      double_duty: att.doubleDuty,
      clock_in_photo_url: att.clockInPhotoUrl,
      clock_out_photo_url: att.clockOutPhotoUrl,
      is_override: att.isOverride
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

// @route   PUT /api/approvals/attendance/:id/approve
// @desc    Approve attendance
// @access  Private
router.put('/attendance/:id/approve', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager', 'supervisor'), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance not found'
      });
    }

    attendance.approvalStatus = 'approved';
    await attendance.save();

    res.json({
      success: true,
      data: {
        id: attendance._id,
        approval_status: attendance.approvalStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/approvals/attendance/:id/reject
// @desc    Reject attendance
// @access  Private
router.put('/attendance/:id/reject', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager', 'supervisor'), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance not found'
      });
    }

    attendance.approvalStatus = 'rejected';
    await attendance.save();

    res.json({
      success: true,
      data: {
        id: attendance._id,
        approval_status: attendance.approvalStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/approvals/attendance-with-photos
// @desc    Get attendance with photos for review
// @access  Private
router.get('/attendance-with-photos', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager', 'supervisor'), async (req, res) => {
  try {
    const { dateFrom, dateTo, supervisorId, status } = req.query;

    const query = {};
    if (dateFrom || dateTo) {
      query.attendanceDate = {};
      if (dateFrom) query.attendanceDate.$gte = dateFrom;
      if (dateTo) query.attendanceDate.$lte = dateTo;
    }
    if (supervisorId) query.supervisorId = supervisorId;
    if (status && status !== 'all') query.status = status;

    const attendances = await Attendance.find(query)
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name code')
      .sort({ attendanceDate: -1, createdAt: -1 });

    const formatted = attendances
      .filter(att => att.clockInPhotoUrl || att.clockOutPhotoUrl)
      .map(att => ({
        id: att._id,
        staff_id: att.staffId?._id?.toString(),
        staff_name: att.staffId?.fullName || 'Unknown',
        supervisor_id: att.supervisorId?._id?.toString(),
        supervisor_name: att.supervisorId?.fullName || 'Unknown',
        nc_location_id: att.ncLocationId?._id?.toString(),
        location_name: att.ncLocationId?.name || 'N/A',
        date: att.attendanceDate,
        clock_in: att.clockIn,
        clock_out: att.clockOut,
        clock_in_photo_url: att.clockInPhotoUrl,
        clock_out_photo_url: att.clockOutPhotoUrl,
        status: att.status,
        approval_status: att.approvalStatus
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

