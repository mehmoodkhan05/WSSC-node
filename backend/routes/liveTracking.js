const express = require('express');
const router = express.Router();
const LiveTracking = require('../models/LiveTracking');
const { protect } = require('../middleware/auth');

// @route   POST /api/live-tracking/start
// @desc    Start live tracking for current user
// @access  Private
router.post('/start', protect, async (req, res) => {
  try {
    const staffId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    // Check if tracking already exists for today
    let tracking = await LiveTracking.findOne({
      staffId,
      date: todayStr,
      isActive: true
    });

    if (tracking) {
      // Update existing tracking
      tracking.lastUpdate = new Date();
      await tracking.save();
      
      return res.json({
        success: true,
        data: {
          id: tracking._id,
          staffId: tracking.staffId.toString(),
          date: tracking.date,
          isActive: tracking.isActive,
          startTime: tracking.startTime,
          lastUpdate: tracking.lastUpdate
        }
      });
    }

    // Create new tracking record
    tracking = await LiveTracking.create({
      staffId,
      date: todayStr,
      isActive: true,
      startTime: new Date(),
      lastUpdate: new Date(),
      locations: []
    });

    res.json({
      success: true,
      data: {
        id: tracking._id,
        staffId: tracking.staffId.toString(),
        date: tracking.date,
        isActive: tracking.isActive,
        startTime: tracking.startTime,
        lastUpdate: tracking.lastUpdate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/live-tracking/stop
// @desc    Stop live tracking for current user
// @access  Private
router.post('/stop', protect, async (req, res) => {
  try {
    const staffId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const tracking = await LiveTracking.findOne({
      staffId,
      date: todayStr,
      isActive: true
    });

    if (tracking) {
      tracking.isActive = false;
      tracking.lastUpdate = new Date();
      await tracking.save();
    }

    res.json({
      success: true,
      message: 'Live tracking stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/live-tracking/update-location
// @desc    Update location for current user's live tracking
// @access  Private
router.post('/update-location', protect, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const staffId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude must be numbers'
      });
    }

    let tracking = await LiveTracking.findOne({
      staffId,
      date: todayStr,
      isActive: true
    });

    if (!tracking) {
      // Auto-start tracking if not exists
      tracking = await LiveTracking.create({
        staffId,
        date: todayStr,
        isActive: true,
        startTime: new Date(),
        lastUpdate: new Date(),
        locations: []
      });
    }

    // Add location to array
    tracking.locations.push({
      lat: latitude,
      lng: longitude,
      timestamp: new Date()
    });

    tracking.lastUpdate = new Date();
    await tracking.save();

    res.json({
      success: true,
      message: 'Location updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/live-tracking/status/:staffId?
// @desc    Get live tracking status for a staff member
// @access  Private
router.get('/status/:staffId?', protect, async (req, res) => {
  try {
    const targetStaffId = req.params.staffId || req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const tracking = await LiveTracking.findOne({
      staffId: targetStaffId,
      date: todayStr,
      isActive: true
    }).populate('staffId', 'fullName username email');

    if (!tracking) {
      return res.json({
        success: true,
        data: { isActive: false }
      });
    }

    const lastLocation = tracking.locations && tracking.locations.length > 0
      ? tracking.locations[tracking.locations.length - 1]
      : null;

    // Handle case where staffId might not be populated (user deleted)
    if (!tracking.staffId) {
      return res.json({
        success: true,
        data: { isActive: false }
      });
    }

    res.json({
      success: true,
      data: {
        id: tracking._id,
        staffId: tracking.staffId._id?.toString() || tracking.staffId.toString(),
        staffName: tracking.staffId.fullName || tracking.staffId.username || 'Unknown',
        date: tracking.date,
        isActive: tracking.isActive,
        startTime: tracking.startTime,
        lastUpdate: tracking.lastUpdate,
        currentLat: lastLocation?.lat || null,
        currentLng: lastLocation?.lng || null,
        locations: tracking.locations || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/live-tracking/active
// @desc    Get active live locations
// @access  Private
// NOTE: This route MUST be defined BEFORE /:staffId to avoid "active" being treated as staffId
router.get('/active', protect, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const trackings = await LiveTracking.find({
      date: todayStr,
      isActive: true
    })
      .populate('staffId', 'fullName username email department departments')
      .sort({ lastUpdate: -1 });

    const formatted = trackings.map(track => {
      const lastLocation = track.locations && track.locations.length > 0
        ? track.locations[track.locations.length - 1]
        : null;

      return {
        id: track._id,
        staff_id: track.staffId?._id?.toString(),
        staff_name: track.staffId?.fullName || track.staffId?.username || 'Unknown',
        department: track.staffId?.department || null,
        departments: track.staffId?.departments || [],
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

// @route   GET /api/live-tracking/:staffId
// @desc    Get live tracking data for a staff member
// @access  Private
router.get('/:staffId', protect, async (req, res) => {
  try {
    const { staffId } = req.params;
    const { date } = req.query;
    const queryDate = date || new Date().toISOString().split('T')[0];

    // Validate staffId is a valid ObjectId format
    if (!staffId || staffId === 'undefined' || staffId === 'null') {
      return res.status(400).json({
        success: false,
        error: 'Valid staffId is required'
      });
    }

    const tracking = await LiveTracking.findOne({
      staffId,
      date: queryDate
    }).populate('staffId', 'fullName username email');

    if (!tracking) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Handle case where staffId might not be populated (user deleted)
    if (!tracking.staffId) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        id: tracking._id,
        staffId: tracking.staffId._id?.toString() || tracking.staffId.toString(),
        staffName: tracking.staffId.fullName || tracking.staffId.username || 'Unknown',
        date: tracking.date,
        isActive: tracking.isActive,
        startTime: tracking.startTime,
        endTime: tracking.updatedAt,
        lastUpdate: tracking.lastUpdate,
        locations: tracking.locations || []
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

