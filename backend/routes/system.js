const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/system/config
// @desc    Get system configuration
// @access  Private
router.get('/config', protect, async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ configKey: 'attendance_settings' });

    const defaultConfig = {
      gracePeriodMinutes: 15,
      minClockIntervalHours: 6
    };

    if (!config) {
      return res.json({
        success: true,
        data: defaultConfig
      });
    }

    res.json({
      success: true,
      data: {
        gracePeriodMinutes: config.gracePeriodMinutes || 15,
        minClockIntervalHours: config.minClockIntervalHours || 6
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/system/config
// @desc    Update system configuration
// @access  Private/CEO/SuperAdmin
router.put('/config', protect, authorize('ceo', 'super_admin'), async (req, res) => {
  try {
    const { gracePeriodMinutes, minClockIntervalHours } = req.body;

    // Validate inputs
    if (gracePeriodMinutes !== undefined) {
      const graceMinutes = parseInt(gracePeriodMinutes, 10);
      if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 1440) {
        return res.status(400).json({
          success: false,
          error: 'Grace period must be between 0 and 1440 minutes'
        });
      }
    }

    if (minClockIntervalHours !== undefined) {
      const intervalHours = parseFloat(minClockIntervalHours);
      if (isNaN(intervalHours) || intervalHours < 0 || intervalHours > 24) {
        return res.status(400).json({
          success: false,
          error: 'Minimum clock interval must be between 0 and 24 hours'
        });
      }
    }

    let config = await SystemConfig.findOne({ configKey: 'attendance_settings' });

    if (!config) {
      config = await SystemConfig.create({
        configKey: 'attendance_settings',
        gracePeriodMinutes: gracePeriodMinutes || 15,
        minClockIntervalHours: minClockIntervalHours || 6
      });
    } else {
      if (gracePeriodMinutes !== undefined) {
        config.gracePeriodMinutes = gracePeriodMinutes;
      }
      if (minClockIntervalHours !== undefined) {
        config.minClockIntervalHours = minClockIntervalHours;
      }
      await config.save();
    }

    res.json({
      success: true,
      data: {
        gracePeriodMinutes: config.gracePeriodMinutes,
        minClockIntervalHours: config.minClockIntervalHours
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

