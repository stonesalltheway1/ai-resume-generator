/**
 * License Key Generator Utility
 * Provides functions to create and validate license keys
 */
const crypto = require('crypto');

// Secret key for license generation (should be in environment variables)
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'your-license-secret-key';

/**
 * Generate a secure license key
 * @param {Object} data - License data (email, name, etc.)
 * @returns {Object} - License key and data
 */
function generateLicenseKey(data = {}) {
  // Add timestamp and unique identifier
  const licenseData = {
    ...data,
    createdAt: new Date().toISOString(),
    uid: crypto.randomBytes(8).toString('hex')
  };

  // Create signature from license data
  const dataStr = JSON.stringify(licenseData);
  const signature = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(dataStr)
    .digest('hex');

  // Create the final license key
  const licenseKey = Buffer.from(JSON.stringify({
    data: licenseData,
    sig: signature
  })).toString('base64');

  return {
    licenseKey,
    licenseData
  };
}

/**
 * Verify a license key
 * @param {String} licenseKey - The license key to verify
 * @returns {Object} - Verification result and license data
 */
function verifyLicenseKey(licenseKey) {
  try {
    // Decode license key
    const licenseObj = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
    const { data, sig } = licenseObj;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', LICENSE_SECRET)
      .update(JSON.stringify(data))
      .digest('hex');
    
    if (sig !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    // Check expiration if it exists
    if (data.expiresAt && new Date() > new Date(data.expiresAt)) {
      return { valid: false, reason: 'License expired' };
    }
    
    return { valid: true, data };
  } catch (error) {
    return { valid: false, reason: 'Invalid license format' };
  }
}

module.exports = { 
  generateLicenseKey, 
  verifyLicenseKey 
};