/**
 * License Model
 * Stores information about generated license keys
 */
const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  licenseKey: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  name: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  activatedAt: Date,
  expiresAt: Date,
  metadata: {
    type: Map,
    of: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['manual', 'gumroad', 'appsumo', 'other'],
    default: 'manual'
  },
  notes: String
});

// Create indexes for faster lookups
licenseSchema.index({ email: 1 });
licenseSchema.index({ licenseKey: 1 });

module.exports = mongoose.model('License', licenseSchema);