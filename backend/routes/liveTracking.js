const express = require('express');
const router = express.Router();
const LiveTracking = require('../models/LiveTracking');
const { protect } = require('../middleware/auth');

// @route   GET /api/live-tracking/active
// @desc    Get active live locations
// @access  Private
router.get('/active', protect, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const trackings = await LiveTracking.find({
      date: todayStr,
      isActive: true
    })
      .populate('staffId', 'fullName username email')
      .sort({ lastUpdate: -1 });

    const formatted = trackings.map(track => {
      const lastLocation = track.locations && track.locations.length > 0
        ? track.locations[track.locations.length - 1]
        : null;

      return {
        id: track._id,
        staff_id: track.staffId?._id?.toString(),
        staff_name: track.staffId?.fullName || track.staffId?.username || 'Unknown',
        lat: lastLocation?.lat || null,
        lng: lastLocation?.lng || null,
        timestamp: lastLocation?.timestamp || track.lastUpdate,
        start_time: track.startTime,
        last_update: track.lastUpdate
      };
    });

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

