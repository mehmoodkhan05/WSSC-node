const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .sort({ deptId: 1 });

    const formatted = departments.map(dept => ({
      id: String(dept.deptId),
      deptId: dept.deptId,
      label: dept.label,
      description: dept.description,
      isActive: dept.isActive
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

// @route   GET /api/departments/:id
// @desc    Get single department
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const department = await Department.findOne({
      $or: [
        { _id: req.params.id },
        { deptId: parseInt(req.params.id) }
      ],
      isActive: true
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: String(department.deptId),
        deptId: department.deptId,
        label: department.label,
        description: department.description,
        isActive: department.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/departments
// @desc    Create department
// @access  Private/CEO/Super Admin only
router.post('/', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const { deptId, label, description } = req.body;

    if (!deptId || !label || !description) {
      return res.status(400).json({
        success: false,
        error: 'deptId, label, and description are required'
      });
    }

    // Check if deptId already exists
    const existingDept = await Department.findOne({ deptId: parseInt(deptId) });
    if (existingDept) {
      return res.status(400).json({
        success: false,
        error: `Department with ID ${deptId} already exists`
      });
    }

    const department = await Department.create({
      deptId: parseInt(deptId),
      label: label.trim(),
      description: description.trim().toUpperCase(),
      isActive: true
    });

    res.status(201).json({
      success: true,
      data: {
        id: String(department.deptId),
        deptId: department.deptId,
        label: department.label,
        description: department.description,
        isActive: department.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private/CEO/Super Admin only
router.put('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const { label, description, isActive } = req.body;

    const updateData = {};
    if (label !== undefined) updateData.label = label.trim();
    if (description !== undefined) updateData.description = description.trim().toUpperCase();
    if (isActive !== undefined) updateData.isActive = isActive;

    const department = await Department.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { deptId: parseInt(req.params.id) }
        ]
      },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: String(department.deptId),
        deptId: department.deptId,
        label: department.label,
        description: department.description,
        isActive: department.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/departments/:id
// @desc    Delete department (soft delete by setting isActive to false)
// @access  Private/CEO/Super Admin only
router.delete('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const department = await Department.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { deptId: parseInt(req.params.id) }
        ]
      },
      { isActive: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

