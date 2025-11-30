const express = require('express');
const router = express.Router();
const PerformanceReview = require('../models/PerformanceReview');
const { protect } = require('../middleware/auth');

// @route   GET /api/performance
// @desc    Get performance reviews
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { staffId, supervisorId, date } = req.query;

    const query = {};
    if (staffId) query.staffId = staffId;
    if (supervisorId) query.supervisorId = supervisorId;
    if (date) query.date = date;

    const reviews = await PerformanceReview.find(query)
      .populate('staffId', 'fullName username email')
      .populate('supervisorId', 'fullName username')
      .populate('locationId', 'name code')
      .sort({ date: -1, createdAt: -1 });

    const formatted = reviews.map(rev => ({
      id: rev._id,
      staff_id: rev.staffId?._id?.toString(),
      staff_name: rev.staffId?.fullName || 'Unknown',
      supervisor_id: rev.supervisorId?._id?.toString() || null,
      supervisor_name: rev.supervisorId?.fullName || null,
      location_id: rev.locationId?._id?.toString() || null,
      location_name: rev.locationId?.name || null,
      date: rev.date,
      category: rev.category,
      description: rev.description,
      photo_path: rev.photoPath,
      photo2_path: rev.photo2Path,
      photo3_path: rev.photo3Path,
      photo4_path: rev.photo4Path,
      pdf_path: rev.pdfPath,
      status: rev.status,
      created_at: rev.createdAt
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

// @route   POST /api/performance
// @desc    Create performance review
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const {
      staff_id,
      supervisor_id,
      location_id,
      date,
      category,
      description,
      photo_path,
      photo2_path,
      photo3_path,
      photo4_path,
      pdf_path
    } = req.body;

    if (!staff_id || !date || !category) {
      return res.status(400).json({
        success: false,
        error: 'staff_id, date, and category are required'
      });
    }

    const review = await PerformanceReview.create({
      staffId: staff_id,
      supervisorId: supervisor_id || null,
      locationId: location_id || null,
      date,
      category,
      description: description || '',
      photoPath: photo_path || null,
      photo2Path: photo2_path || null,
      photo3Path: photo3_path || null,
      photo4Path: photo4_path || null,
      pdfPath: pdf_path || null,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: {
        id: review._id,
        staff_id: review.staffId,
        supervisor_id: review.supervisorId,
        location_id: review.locationId,
        date: review.date,
        category: review.category,
        description: review.description
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/performance/:id/pdf
// @desc    Update performance review PDF path
// @access  Private
router.put('/:id/pdf', protect, async (req, res) => {
  try {
    const { pdfPath } = req.body;

    const review = await PerformanceReview.findByIdAndUpdate(
      req.params.id,
      { pdfPath },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Performance review not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: review._id,
        pdf_path: review.pdfPath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/performance/:id
// @desc    Delete performance review
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await PerformanceReview.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Performance review not found'
      });
    }

    res.json({
      success: true,
      message: 'Performance review deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

