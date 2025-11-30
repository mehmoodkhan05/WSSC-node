const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Helper function to normalize role
exports.normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return null;
  return role.trim().toLowerCase();
};

// Check if user has management privileges
exports.hasManagementPrivileges = (role) => {
  const normalized = exports.normalizeRole(role);
  return ['manager', 'general_manager', 'ceo', 'super_admin'].includes(normalized);
};

// Check if user has full control
exports.hasFullControl = (role) => {
  const normalized = exports.normalizeRole(role);
  return ['ceo', 'super_admin'].includes(normalized);
};

// Check department access
exports.checkDepartmentAccess = (user, requestedDepartment) => {
  const normalizedRole = exports.normalizeRole(user.role);
  
  // CEO/SuperAdmin have access to all departments
  if (exports.hasFullControl(user.role)) {
    return true;
  }

  // General Manager - check departments array
  if (normalizedRole === 'general_manager') {
    const userDepts = user.departments || [];
    const singleDept = user.department || user.empDeptt;
    const allDepts = [...userDepts];
    if (singleDept) allDepts.push(singleDept);
    return !requestedDepartment || allDepts.some(d => 
      exports.normalizeRole(d) === exports.normalizeRole(requestedDepartment)
    );
  }

  // Manager - check single department
  if (normalizedRole === 'manager') {
    const userDept = user.department || user.empDeptt;
    return !requestedDepartment || 
      exports.normalizeRole(userDept) === exports.normalizeRole(requestedDepartment);
  }

  return false;
};

