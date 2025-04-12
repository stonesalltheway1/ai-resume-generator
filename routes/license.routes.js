const express = require('express');
const router = express.Router();
const License = require('../models/license.model');
const { verifyLicenseKey } = require('../utils/license-generator');
const authMiddleware = require('../middleware/auth.middleware');

// Verify license key
router.post('/verify', async (req, res) => {
  try {
    const { licenseKey, machineId } = req.body;
    
    // Verify license key format and signature
    const licenseResult = verifyLicenseKey(licenseKey);
    if (!licenseResult.valid) {
      return res.status(400).json({ valid: false, reason: licenseResult.reason });
    }
    
    // Check if license exists in database
    const license = await License.findOne({ licenseKey });
    if (!license) {
      return res.status(400).json({ valid: false, reason: 'License not found' });
    }
    
    // Check if license is active
    if (!license.isActive) {
      return res.status(400).json({ valid: false, reason: 'License is inactive' });
    }
    
    // Check if license has expired
    if (license.expiresAt && new Date() > license.expiresAt) {
      return res.status(400).json({ valid: false, reason: 'License has expired' });
    }
    
    // Check machine activations
    if (machineId && !license.machineIds.includes(machineId)) {
      // Check if max activations reached
      if (license.activations >= license.maxActivations) {
        return res.status(400).json({ valid: false, reason: 'Maximum activations reached' });
      }
      
      // Add machine ID and increment activations
      license.machineIds.push(machineId);
      license.activations += 1;
      await license.save();
    }
    
    res.json({
      valid: true,
      expiryDate: license.expiresAt,
      email: license.email
    });
  } catch (error) {
    console.error('License verification error:', error);
    res.status(500).json({ valid: false, reason: 'Server error' });
  }
});

// Deactivate a machine
router.post('/deactivate', authMiddleware, async (req, res) => {
  try {
    const { licenseKey, machineId } = req.body;
    
    const license = await License.findOne({ licenseKey });
    if (!license) {
      return res.status(404).json({ message: 'License not found' });
    }
    
    // Remove machine ID
    license.machineIds = license.machineIds.filter(id => id !== machineId);
    license.activations = Math.max(0, license.activations - 1);
    await license.save();
    
    res.json({ message: 'Machine deactivated successfully' });
  } catch (error) {
    console.error('Deactivation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get license info (admin only)
router.get('/admin/licenses', async (req, res) => {
  try {
    // In a real app, this would have admin authentication
    const licenses = await License.find();
    res.json(licenses);
  } catch (error) {
    console.error('Admin license error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;