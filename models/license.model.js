const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LicenseSchema = new Schema({
  licenseKey: {
    type: String,
    required: true,
    unique: true
  },
  licenseData: {
    type: Object,
    required: true
  },
  platform: {
    type: String,
    enum: ['gumroad', 'appsumo', 'stripe', 'manual'],
    required: true
  },
  saleId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  machineIds: [{
    type: String
  }],
  activations: {
    type: Number,
    default: 0
  },
  maxActivations: {
    type: Number,
    default: 3
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('License', LicenseSchema);