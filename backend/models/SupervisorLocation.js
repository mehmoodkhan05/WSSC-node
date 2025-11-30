const mongoose = require('mongoose');

const supervisorLocationSchema = new mongoose.Schema({
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ncLocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
supervisorLocationSchema.index({ supervisorId: 1, ncLocationId: 1 }, { unique: true });

module.exports = mongoose.model('SupervisorLocation', supervisorLocationSchema);

