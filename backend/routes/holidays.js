const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/holidays
// @desc    Get all holidays
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const holidays = await Holiday.find()
      .sort({ date: 1 })
      .populate('createdBy', 'fullName username');

    const formatted = holidays.map(holiday => ({
      id: holiday._id,
      date: holiday.date,
      name: holiday.name,
      description: holiday.description,
      created_by: holiday.createdBy ? {
        id: holiday.createdBy._id,
        name: holiday.createdBy.fullName || holiday.createdBy.username
      } : null,
      created_at: holiday.createdAt
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

// @route   POST /api/holidays
// @desc    Create new holiday
// @access  Private/CEO/SuperAdmin
router.post('/', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const { date, name, description } = req.body;

    if (!date || !name) {
      return res.status(400).json({
        success: false,
        error: 'Date and name are required'
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if holiday already exists for this date
    const existingHoliday = await Holiday.findOne({ date });
    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        error: 'Holiday already exists for this date'
      });
    }

    const holiday = await Holiday.create({
      date,
      name,
      description: description || '',
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: {
        id: holiday._id,
        date: holiday.date,
        name: holiday.name,
        description: holiday.description,
        created_at: holiday.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/holidays/:id
// @desc    Update holiday
// @access  Private/CEO/SuperAdmin
router.put('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    const holiday = await Holiday.findById(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: 'Holiday not found'
      });
    }

    if (name) holiday.name = name;
    if (description !== undefined) holiday.description = description;

    await holiday.save();

    res.json({
      success: true,
      data: {
        id: holiday._id,
        date: holiday.date,
        name: holiday.name,
        description: holiday.description
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/holidays/:id
// @desc    Delete holiday
// @access  Private/CEO/SuperAdmin
router.delete('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: 'Holiday not found'
      });
    }

    await holiday.deleteOne();

    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/holidays/check/:date
// @desc    Check if a specific date is a holiday
// @access  Private
router.get('/check/:date', protect, async (req, res) => {
  try {
    const holiday = await Holiday.findOne({ date: req.params.date });

    res.json({
      success: true,
      isHoliday: !!holiday,
      holiday: holiday ? {
        id: holiday._id,
        name: holiday.name,
        description: holiday.description
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

