const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { protect, normalizeRole, hasFullControl, checkDepartmentAccess } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const [totalStaffCount, supervisorCount, pendingLeaveRequestsCount] = await Promise.all([
      User.countDocuments({ role: 'staff', isActive: true }),
      User.countDocuments({ role: 'supervisor', isActive: true }),
      LeaveRequest.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        totalStaff: totalStaffCount || 0,
        supervisorCount: supervisorCount || 0,
        pendingLeaveRequestsCount: pendingLeaveRequestsCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/stats-by-role-dept
// @desc    Get stats by role and department
// @access  Private
router.get('/stats-by-role-dept', protect, async (req, res) => {
  try {
    const user = req.user;
    const normalizedRole = normalizeRole(user.role);

    if (!['manager', 'general_manager', 'ceo', 'super_admin'].includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        error: 'Manager or higher access required'
      });
    }

    const hasOrgWideAccess = hasFullControl(user.role);
    const { departmentId } = req.query;

    let departmentFilter = null;
    if (hasOrgWideAccess) {
      departmentFilter = departmentId ? [departmentId] : null;
    } else if (normalizedRole === 'general_manager') {
      const userDepts = user.departments || [];
      const singleDept = user.department || user.empDeptt;
      departmentFilter = [...userDepts];
      if (singleDept) departmentFilter.push(singleDept);
      departmentFilter = Array.from(new Set(departmentFilter));
    } else if (normalizedRole === 'manager') {
      const managerDept = user.department || user.empDeptt;
      departmentFilter = managerDept ? [managerDept] : [];
    }

    if (!hasOrgWideAccess && (!departmentFilter || departmentFilter.length === 0)) {
      return res.json({
        success: true,
        data: {
          byRole: [],
          byDepartment: [],
          byRoleAndDepartment: [],
          totalUsers: 0
        }
      });
    }

    const allUsers = await User.find({ isActive: true }).limit(10000);

    const filteredUsers = allUsers.filter(u => {
      if (!departmentFilter) return true;
      const userDept = u.department || u.empDeptt;
      const userDepts = u.departments || [];
      return departmentFilter.some(d =>
        normalizeRole(userDept) === normalizeRole(d) ||
        userDepts.some(ud => normalizeRole(ud) === normalizeRole(d))
      );
    });

    const statsByRole = {};
    const statsByDepartment = {};
    const statsByRoleAndDepartment = {};

    filteredUsers.forEach(u => {
      const role = normalizeRole(u.role) || 'unknown';
      const dept = normalizeRole(u.department || u.empDeptt) || 'unassigned';

      statsByRole[role] = (statsByRole[role] || 0) + 1;
      statsByDepartment[dept] = (statsByDepartment[dept] || 0) + 1;

      const key = `${role}_${dept}`;
      if (!statsByRoleAndDepartment[key]) {
        statsByRoleAndDepartment[key] = { role, department: dept, count: 0 };
      }
      statsByRoleAndDepartment[key].count++;
    });

    res.json({
      success: true,
      data: {
        byRole: Object.entries(statsByRole).map(([role, count]) => ({ role, count })),
        byDepartment: Object.entries(statsByDepartment).map(([department, count]) => ({ department, count })),
        byRoleAndDepartment: Object.values(statsByRoleAndDepartment),
        totalUsers: filteredUsers.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

