const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  licenseKey: {
    type: String,
    required: true
  },
  stripeCustomerId: {
    type: String
  },
  subscription: {
    id: String,
    status: String,
    priceId: String,
    currentPeriodEnd: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

module.exports = mongoose.model('User', UserSchema);