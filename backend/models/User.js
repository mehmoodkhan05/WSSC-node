const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false // Don't return password by default
  },
  fullName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    required: true,
    enum: ['staff', 'supervisor', 'manager', 'general_manager', 'ceo', 'super_admin'],
    default: 'staff'
  },
  department: {
    type: String,
    default: null
  },
  departments: {
    type: [String],
    default: []
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  generalManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Employee fields
  empFname: String,
  empDeptt: String,
  empJob: String,
  empGrade: String,
  empCell1: String,
  empCell2: String,
  empFlg: String,
  empMarried: String,
  empGender: String,
  empNo: String,
  empCnic: String,
  profilePhotoUrl: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

