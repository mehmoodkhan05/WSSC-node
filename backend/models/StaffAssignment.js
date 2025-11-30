const mongoose = require('mongoose');

const staffAssignmentSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ncLocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
staffAssignmentSchema.index({ staffId: 1, isActive: 1 });
staffAssignmentSchema.index({ supervisorId: 1, isActive: 1 });

module.exports = mongoose.model('StaffAssignment', staffAssignmentSchema);

