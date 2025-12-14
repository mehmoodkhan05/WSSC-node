const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  deptId: {
    type: Number,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster lookups
departmentSchema.index({ deptId: 1 });
departmentSchema.index({ isActive: 1 });

module.exports = mongoose.model('Department', departmentSchema);

