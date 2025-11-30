const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/locations
// @desc    Get all locations
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const locations = await Location.find().sort({ name: 1 });

    const formatted = locations.map(loc => ({
      id: loc._id,
      name: loc.name,
      code: loc.code,
      description: loc.description,
      center_lat: loc.centerLat,
      center_lng: loc.centerLng,
      radius_meters: loc.radiusMeters,
      morning_shift_start: loc.morningShiftStart,
      morning_shift_end: loc.morningShiftEnd,
      night_shift_start: loc.nightShiftStart,
      night_shift_end: loc.nightShiftEnd
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

// @route   POST /api/locations
// @desc    Create location
// @access  Private/Admin
router.post('/', protect, authorize('ceo', 'super_admin', 'general_manager'), async (req, res) => {
  try {
    const location = await Location.create(req.body);

    res.status(201).json({
      success: true,
      data: {
        id: location._id,
        name: location.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/locations/:id
// @desc    Update location
// @access  Private/Admin
router.put('/:id', protect, authorize('ceo', 'super_admin', 'general_manager'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/locations/:id
// @desc    Delete location
// @access  Private/Admin
router.delete('/:id', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

