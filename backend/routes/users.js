const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize, normalizeRole, hasFullControl, checkDepartmentAccess } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// @route   GET /api/users
// @desc    Get all users
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const user = req.user;
    const normalizedRole = normalizeRole(user.role);

    // CEO/SuperAdmin can see all users including inactive
    const shouldIncludeInactive = hasFullControl(user.role) || includeInactive === 'true';

    const query = {};
    if (!shouldIncludeInactive) {
      query.isActive = true;
    }

    // Log database query for debugging
    console.log(`[DB Query] Fetching users from database with query:`, JSON.stringify(query));
    const startTime = Date.now();
    
    const users = await User.find(query)
      .sort({ createdAt: 1 })
      .limit(1000)
      .select('-password');
    
    const queryTime = Date.now() - startTime;
    console.log(`[DB Query] Found ${users.length} users in ${queryTime}ms`);

    const formattedUsers = users.map(user => ({
      user_id: user._id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      username: user.username,
      created_at: user.createdAt,
      department: user.department || null,
      departments: user.departments || [],
      manager_id: user.managerId?.toString() || null,
      general_manager_id: user.generalManagerId?.toString() || null,
      emp_fname: user.empFname || null,
      emp_deptt: user.empDeptt || null,
      emp_job: user.empJob || null,
      emp_grade: user.empGrade || null,
      emp_cell1: user.empCell1 || null,
      emp_cell2: user.empCell2 || null,
      emp_flg: user.empFlg || null,
      emp_married: user.empMarried || null,
      emp_gender: user.empGender || null,
      emp_no: user.empNo || null,
      emp_cnic: user.empCnic || null,
      is_active: user.isActive !== false
    }));

    res.json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/staff
// @desc    Get all staff members
// @access  Private
router.get('/staff', protect, async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff', isActive: true })
      .sort({ fullName: 1 })
      .limit(1000)
      .select('-password');

    const formattedStaff = staff.map(user => ({
      user_id: user._id,
      name: user.fullName || user.username || 'Unknown Staff',
      email: user.email,
      full_name: user.fullName,
      department: user.department || null,
      manager_id: user.managerId?.toString() || null,
      supervisor_id: user.supervisorId?.toString() || null,
      empNo: user.empNo || null
    }));

    res.json({
      success: true,
      data: formattedStaff
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/supervisors
// @desc    Get all supervisors
// @access  Private
router.get('/supervisors', protect, async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'supervisor', isActive: true })
      .sort({ fullName: 1 })
      .limit(1000)
      .select('-password');

    const formattedSupervisors = supervisors.map(user => ({
      user_id: user._id,
      name: user.fullName || user.username || 'Unknown Supervisor',
      email: user.email,
      full_name: user.fullName,
      department: user.department || null,
      manager_id: user.managerId?.toString() || null
    }));

    res.json({
      success: true,
      data: formattedSupervisors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/managers
// @desc    Get all managers
// @access  Private
router.get('/managers', protect, async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager', isActive: true })
      .sort({ fullName: 1 })
      .limit(1000)
      .select('-password');

    const formattedManagers = managers.map(user => ({
      user_id: user._id,
      name: user.fullName || user.username || 'Unknown',
      email: user.email,
      full_name: user.fullName,
      department: user.department || null,
      departments: user.departments || [],
      general_manager_id: user.generalManagerId?.toString() || null,
      manager_id: user.managerId?.toString() || null
    }));

    res.json({
      success: true,
      data: formattedManagers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/general-managers
// @desc    Get all general managers
// @access  Private
router.get('/general-managers', protect, async (req, res) => {
  try {
    const gms = await User.find({ role: 'general_manager', isActive: true })
      .sort({ fullName: 1 })
      .limit(1000)
      .select('-password');

    const formattedGMs = gms.map(user => ({
      user_id: user._id,
      name: user.fullName || user.username || 'Unknown',
      email: user.email,
      full_name: user.fullName,
      department: user.department || null,
      departments: user.departments || [],
      general_manager_id: user.generalManagerId?.toString() || null,
      manager_id: user.managerId?.toString() || null
    }));

    res.json({
      success: true,
      data: formattedGMs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/executives
// @desc    Get all CEO and Super Admin users
// @access  Private
router.get('/executives', protect, async (req, res) => {
  try {
    const executives = await User.find({ 
      role: { $in: ['ceo', 'super_admin'] }, 
      isActive: true 
    })
      .sort({ fullName: 1 })
      .limit(100)
      .select('-password');

    const formattedExecutives = executives.map(user => ({
      user_id: user._id,
      name: user.fullName || user.username || 'Unknown',
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      department: user.department || null,
      departments: user.departments || []
    }));

    res.json({
      success: true,
      data: formattedExecutives
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/users
// @desc    Create new user (Admin only)
// @access  Private/Admin
router.post('/', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      role = 'staff',
      empFname,
      empDeptt,
      empJob,
      empGrade,
      empCell1,
      empCell2,
      empFlg,
      empMarried,
      empGender
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username: email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    const user = await User.create({
      email,
      username: email,
      password,
      fullName: fullName || '',
      role,
      empFname,
      empDeptt,
      empJob,
      empGrade,
      empCell1,
      empCell2,
      empFlg,
      empMarried,
      empGender
    });

    res.status(201).json({
      success: true,
      data: {
        user_id: user._id,
        email: user.email,
        full_name: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { full_name, role, password, profile_photo_url } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only allow updating own profile or if admin
    if (user._id.toString() !== req.user._id.toString() && 
        !hasFullControl(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    if (full_name !== undefined) user.fullName = full_name;
    if (role !== undefined && hasFullControl(req.user.role)) user.role = role;
    if (password !== undefined && password.trim() !== '') {
      user.password = await bcrypt.hash(password, 10);
    }
    if (profile_photo_url !== undefined) user.profilePhotoUrl = profile_photo_url;

    await user.save();

    res.json({
      success: true,
      data: {
        user_id: user._id,
        email: user.email,
        full_name: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/leadership
// @desc    Update user leadership info
// @access  Private
router.put('/:id/leadership', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const { department, departments, managerId, generalManagerId } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (department !== undefined) {
      if (department === null || department === '') {
        user.department = null;
      } else {
        user.department = department;
      }
    }

    if (Array.isArray(departments)) {
      user.departments = departments;
    } else if (departments === null) {
      user.departments = [];
    }

    if (managerId !== undefined) {
      user.managerId = managerId || null;
    }

    if (generalManagerId !== undefined) {
      user.generalManagerId = generalManagerId || null;
    }

    await user.save();

    res.json({
      success: true,
      data: {
        user_id: user._id,
        department: user.department || null,
        departments: user.departments || [],
        manager_id: user.managerId || null,
        general_manager_id: user.generalManagerId || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/users/:id/can-delete
// @desc    Check if user can be deleted (no child data)
// @access  Private
router.get('/:id/can-delete', protect, async (req, res) => {
  try {
    const StaffAssignment = require('../models/StaffAssignment');
    const Attendance = require('../models/Attendance');
    const SupervisorLocation = require('../models/SupervisorLocation');
    const LeaveRequest = require('../models/LeaveRequest');
    
    // Check for staff assignments (as staff or supervisor)
    const hasStaffAssignments = await StaffAssignment.exists({ 
      $or: [
        { staffId: req.params.id },
        { supervisorId: req.params.id }
      ]
    });
    
    // Check for attendance records
    const hasAttendance = await Attendance.exists({ 
      $or: [
        { staffId: req.params.id },
        { supervisorId: req.params.id }
      ]
    });
    
    // Check for supervisor location mappings
    const hasSupervisorMappings = await SupervisorLocation.exists({ 
      supervisorId: req.params.id 
    });
    
    // Check for leave requests
    const hasLeaveRequests = await LeaveRequest.exists({ 
      staffId: req.params.id 
    });
    
    const canDelete = !hasStaffAssignments && !hasAttendance && !hasSupervisorMappings && !hasLeaveRequests;
    
    let reasons = [];
    if (hasStaffAssignments) reasons.push('staff assignments');
    if (hasAttendance) reasons.push('attendance records');
    if (hasSupervisorMappings) reasons.push('supervisor location mappings');
    if (hasLeaveRequests) reasons.push('leave requests');
    
    res.json({ 
      success: true, 
      canDelete,
      hasStaffAssignments: !!hasStaffAssignments,
      hasAttendance: !!hasAttendance,
      hasSupervisorMappings: !!hasSupervisorMappings,
      hasLeaveRequests: !!hasLeaveRequests,
      reason: reasons.length > 0 ? `User has ${reasons.join(', ')}` : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (only if no child data)
// @access  Private/Admin
router.delete('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const StaffAssignment = require('../models/StaffAssignment');
    const Attendance = require('../models/Attendance');
    const SupervisorLocation = require('../models/SupervisorLocation');
    const LeaveRequest = require('../models/LeaveRequest');
    
    // Check for child data
    const hasStaffAssignments = await StaffAssignment.exists({ 
      $or: [
        { staffId: req.params.id },
        { supervisorId: req.params.id }
      ]
    });
    
    const hasAttendance = await Attendance.exists({ 
      $or: [
        { staffId: req.params.id },
        { supervisorId: req.params.id }
      ]
    });
    
    const hasSupervisorMappings = await SupervisorLocation.exists({ 
      supervisorId: req.params.id 
    });
    
    const hasLeaveRequests = await LeaveRequest.exists({ 
      staffId: req.params.id 
    });
    
    if (hasStaffAssignments || hasAttendance || hasSupervisorMappings || hasLeaveRequests) {
      let reasons = [];
      if (hasStaffAssignments) reasons.push('staff assignments');
      if (hasAttendance) reasons.push('attendance records');
      if (hasSupervisorMappings) reasons.push('supervisor location mappings');
      if (hasLeaveRequests) reasons.push('leave requests');
      
      return res.status(400).json({
        success: false,
        error: `Cannot delete user with ${reasons.join(', ')}`,
        hasChildren: true,
        hasStaffAssignments: !!hasStaffAssignments,
        hasAttendance: !!hasAttendance,
        hasSupervisorMappings: !!hasSupervisorMappings,
        hasLeaveRequests: !!hasLeaveRequests
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

