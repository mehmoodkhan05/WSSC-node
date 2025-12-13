const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  centerLat: {
    type: Number,
    required: true
  },
  centerLng: {
    type: Number,
    required: true
  },
  radiusMeters: {
    type: Number,
    required: true,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
zoneSchema.index({ locationId: 1, isActive: 1 });

module.exports = mongoose.model('Zone', zoneSchema);

