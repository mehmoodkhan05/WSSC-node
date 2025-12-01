const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  attendanceDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  clockIn: {
    type: Date,
    default: null
  },
  clockOut: {
    type: Date,
    default: null
  },
  clockInLat: {
    type: Number,
    default: null
  },
  clockInLng: {
    type: Number,
    default: null
  },
  clockOutLat: {
    type: Number,
    default: null
  },
  clockOutLng: {
    type: Number,
    default: null
  },
  clockInPhotoUrl: {
    type: String,
    default: null
  },
  clockOutPhotoUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Absent'],
    default: 'Present'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  overtime: {
    type: Boolean,
    default: false
  },
  doubleDuty: {
    type: Boolean,
    default: false
  },
  clockedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  clockedOutBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isOverride: {
    type: Boolean,
    default: false
  },
  // Multi-level approval for overtime and double duty
  overtimeApprovalStatus: {
    type: String,
    enum: ['pending', 'supervisor_approved', 'manager_approved', 'rejected', null],
    default: null
  },
  doubleDutyApprovalStatus: {
    type: String,
    enum: ['pending', 'supervisor_approved', 'manager_approved', 'rejected', null],
    default: null
  },
  markedBySupervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedByManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSchema.index({ staffId: 1, attendanceDate: 1 });
attendanceSchema.index({ supervisorId: 1, attendanceDate: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

