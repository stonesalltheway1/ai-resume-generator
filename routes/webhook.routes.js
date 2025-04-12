const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateLicenseKey } = require('../utils/license-generator');
const License = require('../models/license.model');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Gumroad webhook for license creation
router.post('/gumroad', async (req, res) => {
  try {
    // Verify the webhook is from Gumroad
    if (req.body.seller_id !== process.env.GUMROAD_SELLER_ID) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { email, product_id, sale_id, price } = req.body;
    
    // Check if this sale has already been processed
    const existingLicense = await License.findOne({ saleId: sale_id });
    if (existingLicense) {
      return res.json({ success: true, message: 'License already exists' });
    }
    
    // Generate license key (1 year validity)
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    
    const { licenseKey, licenseData } = generateLicenseKey(
      email,
      product_id,
      expirationDate.toISOString()
    );
    
    // Save license in database
    const license = new License({
      licenseKey,
      licenseData,
      platform: 'gumroad',
      saleId: sale_id,
      email,
      expiresAt: expirationDate,
      isActive: true
    });
    await license.save();
    
    // Send license key to customer
    const transporter = nodemailer.createTransport({
      // Configure your email service
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    await transporter.sendMail({
      from: 'your-app@example.com',
      to: email,
      subject: 'Your License Key for AI Resume Generator',
      html: `<p>Thank you for your purchase! Here is your license key:</p>
              <p><strong>${licenseKey}</strong></p>
              <p>To activate your product, copy this key and paste it when prompted during setup.</p>`
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Gumroad webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// AppSumo webhook for license creation
router.post('/appsumo', async (req, res) => {
  try {
    // Verify the webhook signature
    // AppSumo uses a different verification method, this is a simplified example
    const hmac = crypto.createHmac('sha256', process.env.APPSUMO_SECRET);
    hmac.update(JSON.stringify(req.body));
    const signature = hmac.digest('hex');
    
    if (signature !== req.headers['x-appsumo-signature']) {
      return res.status(403).json({ message: 'Invalid signature' });
    }
    
    const { email, uuid, plan_id, status } = req.body;
    
    // Only process if status is active
    if (status !== 'active') {
      return res.json({ success: true, message: 'Skipping non-active status' });
    }
    
    // Check if this sale has already been processed
    const existingLicense = await License.findOne({ saleId: uuid });
    if (existingLicense) {
      return res.json({ success: true, message: 'License already exists' });
    }
    
    // Generate license key (lifetime validity for AppSumo)
    const { licenseKey, licenseData } = generateLicenseKey(
      email,
      plan_id,
      null // No expiration for AppSumo deals
    );
    
    // Save license in database
    const license = new License({
      licenseKey,
      licenseData,
      platform: 'appsumo',
      saleId: uuid,
      email,
      expiresAt: null,
      isActive: true
    });
    await license.save();
    
    // Send license key to customer (similar to Gumroad)
    // ...
    
    res.json({ success: true });
  } catch (error) {
    console.error('AppSumo webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stripe webhook for subscription management
router.post('/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        await handleSubscriptionChange(subscription);
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function for checkout completed
async function handleCheckoutCompleted(session) {
  // Create a license if it's a one-time purchase
  if (session.mode === 'payment') {
    const email = session.customer_details.email;
    const productId = session.line_items?.data[0]?.price.product || 'unknown';
    
    // Generate license key (1 year validity)
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    
    const { licenseKey, licenseData } = generateLicenseKey(
      email,
      productId,
      expirationDate.toISOString()
    );
    
    // Save license in database
    const license = new License({
      licenseKey,
      licenseData,
      platform: 'stripe',
      saleId: session.id,
      email,
      expiresAt: expirationDate,
      isActive: true
    });
    await license.save();
    
    // Send license key to customer
    // ...
  }
}

// Helper function for subscription changes
async function handleSubscriptionChange(subscription) {
  const stripeCustomerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId });
  
  if (user) {
    user.subscription = {
      id: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0]?.price.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    };
    await user.save();
  }
}

module.exports = router;