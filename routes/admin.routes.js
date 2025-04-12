/**
 * Admin Routes
 * Protected routes for license management
 */
const express = require('express');
const router = express.Router();
const License = require('../models/license.model');
const { generateLicenseKey } = require('../utils/licenseGenerator');
const path = require('path');

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  // Very basic auth - replace with proper authentication
  const adminSecret = process.env.ADMIN_SECRET || 'admin-secret-change-this';
  const providedSecret = req.headers['x-admin-secret'];
  
  if (providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Admin dashboard
router.get('/', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Get all licenses
router.get('/licenses', adminAuth, async (req, res) => {
  try {
    const licenses = await License.find().sort({ createdAt: -1 });
    res.json({ licenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new license
router.post('/licenses', adminAuth, async (req, res) => {
  try {
    const { email, name, expiresAt, notes, metadata } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Generate license key
    const { licenseKey, licenseData } = generateLicenseKey({
      email,
      name,
      expiresAt,
      metadata
    });
    
    // Save to database
    const license = new License({
      licenseKey,
      email,
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
      notes,
      source: 'manual'
    });
    
    await license.save();
    
    res.status(201).json({ license });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate license
router.put('/licenses/:id/deactivate', adminAuth, async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    license.isActive = false;
    await license.save();
    
    res.json({ license });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activate license
router.put('/licenses/:id/activate', adminAuth, async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    license.isActive = true;
    await license.save();
    
    res.json({ license });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;