const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    unique: true
  },
  gracePeriodMinutes: {
    type: Number,
    default: 15
  },
  minClockIntervalHours: {
    type: Number,
    default: 6
  },
  otherSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

