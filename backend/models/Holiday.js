const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
holidaySchema.index({ date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);

