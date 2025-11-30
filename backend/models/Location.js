const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    trim: true
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
    default: 100
  },
  morningShiftStart: {
    type: String, // Format: "HH:MM"
    default: null
  },
  morningShiftEnd: {
    type: String,
    default: null
  },
  nightShiftStart: {
    type: String,
    default: null
  },
  nightShiftEnd: {
    type: String,
    default: null
  },
  isOffice: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Location', locationSchema);

