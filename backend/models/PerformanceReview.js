const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  photoPath: {
    type: String,
    default: null
  },
  photo2Path: {
    type: String,
    default: null
  },
  photo3Path: {
    type: String,
    default: null
  },
  photo4Path: {
    type: String,
    default: null
  },
  pdfPath: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for efficient queries
performanceReviewSchema.index({ staffId: 1, date: 1 });
performanceReviewSchema.index({ supervisorId: 1 });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);

