const mongoose = require('mongoose');

const liveTrackingSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  },
  locations: [{
    lat: Number,
    lng: Number,
    timestamp: Date
  }]
}, {
  timestamps: true
});

// Index for efficient queries
liveTrackingSchema.index({ staffId: 1, date: 1, isActive: 1 });

module.exports = mongoose.model('LiveTracking', liveTrackingSchema);

