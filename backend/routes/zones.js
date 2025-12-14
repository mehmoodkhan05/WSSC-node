const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/zones
// @desc    Get all zones (optionally filtered by location_id)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { location_id } = req.query;
    const query = { isActive: true };
    
    if (location_id) {
      query.locationId = location_id;
    }

    const zones = await Zone.find(query)
      .populate('locationId', 'name code')
      .sort({ name: 1 });

    const formatted = zones.map(zone => ({
      id: zone._id,
      name: zone.name,
      location_id: zone.locationId?._id?.toString(),
      location_name: zone.locationId?.name || 'N/A',
      description: zone.description,
      center_lat: zone.centerLat,
      center_lng: zone.centerLng,
      radius_meters: zone.radiusMeters,
      is_active: zone.isActive
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

// @route   GET /api/zones/:id
// @desc    Get single zone
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id)
      .populate('locationId', 'name code');

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: zone._id,
        name: zone.name,
        location_id: zone.locationId?._id?.toString(),
        location_name: zone.locationId?.name || 'N/A',
        description: zone.description,
        center_lat: zone.centerLat,
        center_lng: zone.centerLng,
        radius_meters: zone.radiusMeters,
        is_active: zone.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/zones
// @desc    Create zone
// @access  Private/Admin
router.post('/', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const { name, location_id, description, center_lat, center_lng, radius_meters } = req.body;

    if (!name || !location_id || !center_lat || !center_lng || !radius_meters) {
      return res.status(400).json({
        success: false,
        error: 'name, location_id, center_lat, center_lng, and radius_meters are required'
      });
    }

    const zone = await Zone.create({
      name,
      locationId: location_id,
      description: description || '',
      centerLat: parseFloat(center_lat),
      centerLng: parseFloat(center_lng),
      radiusMeters: parseInt(radius_meters, 10),
      isActive: true
    });

    const populated = await Zone.findById(zone._id)
      .populate('locationId', 'name code');

    res.status(201).json({
      success: true,
      data: {
        id: populated._id,
        name: populated.name,
        location_id: populated.locationId?._id?.toString(),
        location_name: populated.locationId?.name || 'N/A',
        description: populated.description,
        center_lat: populated.centerLat,
        center_lng: populated.centerLng,
        radius_meters: populated.radiusMeters,
        is_active: populated.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/zones/:id
// @desc    Update zone
// @access  Private/Admin
router.put('/:id', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const { name, description, center_lat, center_lng, radius_meters } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (center_lat !== undefined) updateData.centerLat = parseFloat(center_lat);
    if (center_lng !== undefined) updateData.centerLng = parseFloat(center_lng);
    if (radius_meters !== undefined) updateData.radiusMeters = parseInt(radius_meters, 10);

    const zone = await Zone.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('locationId', 'name code');

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: zone._id,
        name: zone.name,
        location_id: zone.locationId?._id?.toString(),
        location_name: zone.locationId?.name || 'N/A',
        description: zone.description,
        center_lat: zone.centerLat,
        center_lng: zone.centerLng,
        radius_meters: zone.radiusMeters,
        is_active: zone.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/zones/:id
// @desc    Delete zone (soft delete by setting isActive to false)
// @access  Private/Admin
router.delete('/:id', protect, authorize('ceo', 'super_admin', 'general_manager', 'manager'), async (req, res) => {
  try {
    const StaffAssignment = require('../models/StaffAssignment');
    
    // Check if zone has active assignments
    const hasAssignments = await StaffAssignment.exists({ 
      zoneId: req.params.id, 
      isActive: true 
    });
    
    if (hasAssignments) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete zone with active staff assignments',
        hasAssignments: true
      });
    }

    // Soft delete by setting isActive to false
    const zone = await Zone.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

