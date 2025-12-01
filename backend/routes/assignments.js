const express = require('express');
const router = express.Router();
const StaffAssignment = require('../models/StaffAssignment');
const SupervisorLocation = require('../models/SupervisorLocation');
const User = require('../models/User');
const Location = require('../models/Location');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/assignments
// @desc    Get all staff assignments
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const assignments = await StaffAssignment.find({ isActive: true })
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username email')
      .populate('ncLocationId', 'name code')
      .sort({ createdAt: -1 });

    const formatted = assignments.map(ass => ({
      id: ass._id,
      staff_id: ass.staffId?._id?.toString(),
      staff_name: ass.staffId?.fullName || ass.staffId?.username || 'Unknown',
      supervisor_id: ass.supervisorId?._id?.toString(),
      supervisor_name: ass.supervisorId?.fullName || ass.supervisorId?.username || 'Unknown',
      nc_location_id: ass.ncLocationId?._id?.toString(),
      location_name: ass.ncLocationId?.name || 'N/A',
      is_active: ass.isActive
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

// @route   POST /api/assignments
// @desc    Create staff assignment
// @access  Private/Admin
router.post('/', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const { staff_id, supervisor_id, nc_location_id } = req.body;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      return res.status(400).json({
        success: false,
        error: 'staff_id, supervisor_id, and nc_location_id are required'
      });
    }

    // Deactivate existing assignment
    await StaffAssignment.updateMany(
      { staffId: staff_id, isActive: true },
      { isActive: false }
    );

    const assignment = await StaffAssignment.create({
      staffId: staff_id,
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id,
      isActive: true
    });

    const populated = await StaffAssignment.findById(assignment._id)
      .populate('staffId', 'fullName username')
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name');

    res.status(201).json({
      success: true,
      data: {
        id: populated._id,
        staff_id: populated.staffId?._id?.toString(),
        staff_name: populated.staffId?.fullName || 'Unknown',
        supervisor_id: populated.supervisorId?._id?.toString(),
        supervisor_name: populated.supervisorId?.fullName || 'Unknown',
        nc_location_id: populated.ncLocationId?._id?.toString(),
        location_name: populated.ncLocationId?.name || 'N/A'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/assignments/:id/deactivate
// @desc    Deactivate assignment
// @access  Private/Admin
router.put('/:id/deactivate', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const assignment = await StaffAssignment.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Assignment deactivated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/assignments/supervisor-locations
// @desc    Get supervisor locations
// @access  Private
router.get('/supervisor-locations', protect, async (req, res) => {
  try {
    const supLocs = await SupervisorLocation.find()
      .populate('supervisorId', 'fullName username email')
      .populate('ncLocationId', 'name code')
      .sort({ createdAt: -1 });

    const formatted = supLocs.map(sl => ({
      id: sl._id,
      supervisor_id: sl.supervisorId?._id?.toString(),
      supervisor_name: sl.supervisorId?.fullName || sl.supervisorId?.username || 'Unknown',
      nc_location_id: sl.ncLocationId?._id?.toString(),
      location_name: sl.ncLocationId?.name || 'N/A'
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

// @route   POST /api/assignments/supervisor-locations
// @desc    Assign supervisor to location
// @access  Private/Admin
router.post('/supervisor-locations', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const { supervisor_id, nc_location_id } = req.body;

    if (!supervisor_id || !nc_location_id) {
      return res.status(400).json({
        success: false,
        error: 'supervisor_id and nc_location_id are required'
      });
    }

    // Remove existing assignment for this supervisor-location combination
    await SupervisorLocation.deleteMany({
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id
    });

    const supLoc = await SupervisorLocation.create({
      supervisorId: supervisor_id,
      ncLocationId: nc_location_id
    });

    const populated = await SupervisorLocation.findById(supLoc._id)
      .populate('supervisorId', 'fullName username')
      .populate('ncLocationId', 'name');

    res.status(201).json({
      success: true,
      data: {
        id: populated._id,
        supervisor_id: populated.supervisorId?._id?.toString(),
        supervisor_name: populated.supervisorId?.fullName || 'Unknown',
        nc_location_id: populated.ncLocationId?._id?.toString(),
        location_name: populated.ncLocationId?.name || 'N/A'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/assignments/supervisor-locations/:id
// @desc    Remove supervisor from location
// @access  Private/Admin
router.delete('/supervisor-locations/:id', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const supLoc = await SupervisorLocation.findByIdAndDelete(req.params.id);

    if (!supLoc) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor location assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Supervisor location assignment removed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

