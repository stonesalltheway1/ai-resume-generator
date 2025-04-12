const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a license key
 * @param {string} userId - Email or user identifier
 * @param {string} productId - Product identifier
 * @param {string|null} expirationDate - ISO date string or null for lifetime
 * @returns {Object} License key and data
 */
function generateLicenseKey(userId, productId, expirationDate = null) {
  // Create a unique identifier
  const uniqueId = uuidv4();
  
  // Create license data
  const licenseData = {
    userId,
    productId,
    uniqueId,
    expirationDate,
    createdAt: new Date().toISOString()
  };
  
  // Create a signature using a secret key
  const dataString = JSON.stringify(licenseData);
  const signature = crypto
    .createHmac('sha256', process.env.LICENSE_SECRET)
    .update(dataString)
    .digest('hex');
  
  // Combine data and signature into license key
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
 * @param {string} licenseKey - The license key to verify
 * @returns {Object} Verification result
 */
function verifyLicenseKey(licenseKey) {
  try {
    // Decode license key
    const licenseObject = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
    const { data, sig } = licenseObject;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.LICENSE_SECRET)
      .update(JSON.stringify(data))
      .digest('hex');
    
    if (sig !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    // Check expiration
    if (data.expirationDate && new Date() > new Date(data.expirationDate)) {
      return { valid: false, reason: 'License expired' };
    }
    
    return { valid: true, data };
  } catch (error) {
    return { valid: false, reason: 'Invalid license format' };
  }
}

module.exports = { generateLicenseKey, verifyLicenseKey };