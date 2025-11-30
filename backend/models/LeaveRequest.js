const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
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
  leaveType: {
    type: String,
    required: true
  },
  startDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  endDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaveRequestSchema.index({ staffId: 1, status: 1 });
leaveRequestSchema.index({ supervisorId: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

