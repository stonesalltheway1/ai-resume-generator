/**
 * Enhanced AI Resume Generator Server
 * 
 * Features:
 * - License key generation and validation
 * - Admin dashboard for license management
 * - Webhook handlers for payment processors
 * - Improved MongoDB connection handling
 * - Better error handling and logging
 * - Automatic port selection
 * - Security enhancements
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
const { promisify } = require('util');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Configuration with defaults
const CONFIG = {
  PORT: process.env.PORT || 3000,
  PORT_RANGE_MAX: process.env.PORT_RANGE_MAX || 3020,
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/ai-resume-generator',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  LOG_FORMAT: process.env.LOG_FORMAT || 'dev',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  LICENSE_SECRET: process.env.LICENSE_SECRET || 'license-secret-key-change-in-production',
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'admin-secret-key-change-in-production',
  GUMROAD_SELLER_ID: process.env.GUMROAD_SELLER_ID || '',
};

// Set up logging
if (CONFIG.NODE_ENV !== 'test') {
  app.use(morgan(CONFIG.LOG_FORMAT));
}

// Create required directories if they don't exist
['public', 'public/auth', 'public/app', 'public/admin'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for admin dashboard
}));
app.use(cors({
  origin: CONFIG.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Serve static files
app.use('/auth', express.static(path.join(__dirname, 'public/auth')));
app.use('/app', express.static(path.join(__dirname, 'public/app')));

// Root route - serve generator.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'generator.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// License Management Utils
const licenseUtils = {
  generateLicenseKey: (data = {}) => {
    // Add timestamp and unique identifier
    const licenseData = {
      ...data,
      createdAt: new Date().toISOString(),
      uid: crypto.randomBytes(8).toString('hex')
    };

    // Create signature from license data
    const dataStr = JSON.stringify(licenseData);
    const signature = crypto
      .createHmac('sha256', CONFIG.LICENSE_SECRET)
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
  },

  verifyLicenseKey: (licenseKey) => {
    try {
      // Decode license key
      const licenseObj = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
      const { data, sig } = licenseObj;
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', CONFIG.LICENSE_SECRET)
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
};

// Admin Auth Middleware
const adminAuthMiddleware = (req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'];
  
  if (adminSecret !== CONFIG.ADMIN_SECRET) {
    return res.status(401).json({
      error: {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }
    });
  }
  
  next();
};

// Admin Dashboard HTML
app.get('/admin', (req, res) => {
  // Verify admin secret in query
  const secret = req.query.secret;
  
  if (secret !== CONFIG.ADMIN_SECRET) {
    res.redirect('/admin/login.html');
    return;
  }
  
  // Serve admin dashboard HTML
  const adminHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Resume Generator - License Admin</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding-bottom: 20px;
        margin-bottom: 20px;
      }
      h1 {
        margin: 0;
      }
      button {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 15px;
        cursor: pointer;
        border-radius: 4px;
      }
      button:hover {
        background-color: #45a049;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      tr:hover {
        background-color: #f5f5f5;
      }
      .license-form {
        background-color: #f9f9f9;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        display: none;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
      }
      input, textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .actions {
        display: flex;
        gap: 10px;
      }
      .btn-blue {
        background-color: #2196F3;
      }
      .btn-red {
        background-color: #f44336;
      }
      .btn-blue:hover {
        background-color: #0b7dda;
      }
      .btn-red:hover {
        background-color: #d32f2f;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>License Management</h1>
      <button id="create-license-btn">Create New License</button>
    </header>
    
    <div id="license-form" class="license-form">
      <h2>Create License</h2>
      <div class="form-group">
        <label for="email">Email (required)</label>
        <input type="email" id="email" required>
      </div>
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name">
      </div>
      <div class="form-group">
        <label for="expiresAt">Expiration Date</label>
        <input type="date" id="expiresAt">
      </div>
      <div class="form-group">
        <label for="notes">Notes</label>
        <textarea id="notes" rows="3"></textarea>
      </div>
      <div class="actions">
        <button id="submit-license-btn">Generate License</button>
        <button id="cancel-license-btn">Cancel</button>
      </div>
    </div>
    
    <div id="licenses-container">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>License Key</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="licenses-table-body">
          <tr>
            <td colspan="7">Loading licenses...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <script>
      // Store admin secret from URL
      const adminSecret = new URLSearchParams(window.location.search).get('secret');

      // DOM elements
      const createLicenseBtn = document.getElementById('create-license-btn');
      const licenseForm = document.getElementById('license-form');
      const submitLicenseBtn = document.getElementById('submit-license-btn');
      const cancelLicenseBtn = document.getElementById('cancel-license-btn');
      const licensesTableBody = document.getElementById('licenses-table-body');

      // Show/hide license form
      createLicenseBtn.addEventListener('click', () => {
        licenseForm.style.display = 'block';
      });

      cancelLicenseBtn.addEventListener('click', () => {
        licenseForm.style.display = 'none';
      });

      // Submit new license
      submitLicenseBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        if (!email) {
          alert('Email is required');
          return;
        }

        const licenseData = {
          email,
          name: document.getElementById('name').value,
          notes: document.getElementById('notes').value
        };

        const expiresAt = document.getElementById('expiresAt').value;
        if (expiresAt) {
          licenseData.expiresAt = expiresAt;
        }

        try {
          const response = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Secret': adminSecret
            },
            body: JSON.stringify(licenseData)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create license');
          }

          // Refresh license list
          fetchLicenses();
          
          // Hide form and reset
          licenseForm.style.display = 'none';
          document.getElementById('email').value = '';
          document.getElementById('name').value = '';
          document.getElementById('expiresAt').value = '';
          document.getElementById('notes').value = '';
          
        } catch (error) {
          alert('Error: ' + error.message);
        }
      });

      // Fetch licenses
      async function fetchLicenses() {
        try {
          const response = await fetch('/api/admin/licenses', {
            headers: {
              'X-Admin-Secret': adminSecret
            }
          });

          if (!response.ok) {
            throw new Error('Failed to fetch licenses');
          }

          const data = await response.json();
          renderLicenses(data.licenses);
        } catch (error) {
          licensesTableBody.innerHTML = \`
            <tr>
              <td colspan="7">Error: \${error.message}</td>
            </tr>
          \`;
        }
      }

      // Render licenses to table
      function renderLicenses(licenses) {
        if (!licenses || licenses.length === 0) {
          licensesTableBody.innerHTML = \`
            <tr>
              <td colspan="7">No licenses found</td>
            </tr>
          \`;
          return;
        }

        licensesTableBody.innerHTML = licenses.map(license => \`
          <tr>
            <td>\${license.email}</td>
            <td>\${license.name || '-'}</td>
            <td>
              <input type="text" value="\${license.licenseKey}" readonly style="width: 200px; overflow: hidden; text-overflow: ellipsis;">
              <button onclick="copyToClipboard('\${license.licenseKey}')">Copy</button>
            </td>
            <td>\${new Date(license.createdAt).toLocaleDateString()}</td>
            <td>\${license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>\${license.isActive ? 'Active' : 'Inactive'}</td>
            <td class="actions">
              \${license.isActive 
                ? \`<button class="btn-red" onclick="deactivateLicense('\${license._id}')">Deactivate</button>\` 
                : \`<button class="btn-blue" onclick="activateLicense('\${license._id}')">Activate</button>\`
              }
            </td>
          </tr>
        \`).join('');
      }

      // Copy license key to clipboard
      window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(
          () => alert('License key copied to clipboard'),
          () => alert('Failed to copy license key')
        );
      };

      // Activate/deactivate license
      window.activateLicense = async function(id) {
        await toggleLicense(id, 'activate');
      };

      window.deactivateLicense = async function(id) {
        await toggleLicense(id, 'deactivate');
      };

      async function toggleLicense(id, action) {
        try {
          const response = await fetch(\`/api/admin/licenses/\${id}/\${action}\`, {
            method: 'PUT',
            headers: {
              'X-Admin-Secret': adminSecret
            }
          });

          if (!response.ok) {
            throw new Error(\`Failed to \${action} license\`);
          }

          fetchLicenses();
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      // Initial load
      fetchLicenses();
    </script>
  </body>
  </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(adminHtml);
});

// Admin Login Page
app.get('/admin/login.html', (req, res) => {
  const loginHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - AI Resume Generator</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        background-color: #f5f5f5;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
      }
      .login-container {
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 400px;
      }
      h1 {
        text-align: center;
        margin-bottom: 2rem;
      }
      .form-group {
        margin-bottom: 1rem;
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
      input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
      }
      button {
        width: 100%;
        padding: 0.75rem;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;
        margin-top: 1rem;
      }
      button:hover {
        background-color: #45a049;
      }
      .error {
        color: #f44336;
        margin-top: 1rem;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <h1>Admin Login</h1>
      <div class="form-group">
        <label for="admin-secret">Admin Secret</label>
        <input type="password" id="admin-secret" placeholder="Enter admin secret">
      </div>
      <button id="login-btn">Login</button>
      <p id="error-message" class="error" style="display: none;"></p>
    </div>
    
    <script>
      document.getElementById('login-btn').addEventListener('click', function() {
        const secret = document.getElementById('admin-secret').value;
        
        if (!secret) {
          showError('Please enter the admin secret');
          return;
        }
        
        // Redirect to admin dashboard with secret as query parameter
        window.location.href = '/admin?secret=' + encodeURIComponent(secret);
      });
      
      document.getElementById('admin-secret').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          document.getElementById('login-btn').click();
        }
      });
      
      function showError(message) {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
      }
    </script>
  </body>
  </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(loginHtml);
});

// Define MongoDB models
const License = mongoose.model('License', new mongoose.Schema({
  licenseKey: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  source: { type: String, enum: ['manual', 'gumroad', 'appsumo', 'other'], default: 'manual' },
  activations: [{
    timestamp: Date,
    machineId: String,
    os: String,
    app: String,
    ip: String
  }],
  metadata: mongoose.Schema.Types.Mixed
}));

// Admin API Routes
app.get('/api/admin/licenses', adminAuthMiddleware, async (req, res) => {
  try {
    const licenses = await License.find().sort({ createdAt: -1 });
    res.json({ licenses });
  } catch (err) {
    console.error('Error fetching licenses:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/api/admin/licenses', adminAuthMiddleware, async (req, res) => {
  try {
    const { email, name, expiresAt, metadata = {} } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: { message: 'Email is required' } });
    }
    
    // Generate license key
    const { licenseKey } = licenseUtils.generateLicenseKey({
      email,
      name,
      expiresAt,
      metadata
    });
    
    // Create license document
    const license = new License({
      licenseKey,
      email,
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
      source: 'manual'
    });
    
    await license.save();
    
    res.status(201).json({ license });
  } catch (err) {
    console.error('Error creating license:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.put('/api/admin/licenses/:id/activate', adminAuthMiddleware, async (req, res) => {
  try {
    const license = await License.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    
    if (!license) {
      return res.status(404).json({ error: { message: 'License not found' } });
    }
    
    res.json({ license });
  } catch (err) {
    console.error('Error activating license:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.put('/api/admin/licenses/:id/deactivate', adminAuthMiddleware, async (req, res) => {
  try {
    const license = await License.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!license) {
      return res.status(404).json({ error: { message: 'License not found' } });
    }
    
    res.json({ license });
  } catch (err) {
    console.error('Error deactivating license:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

// License Verification API
app.post('/api/license/verify', async (req, res) => {
  try {
    const { licenseKey, machineId, os, app } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ 
        valid: false, 
        reason: 'License key is required' 
      });
    }
    
    // Verify the license key format and signature
    const verificationResult = licenseUtils.verifyLicenseKey(licenseKey);
    
    if (!verificationResult.valid) {
      return res.status(403).json({
        valid: false,
        reason: verificationResult.reason
      });
    }
    
    // Check if license exists in the database
    const license = await License.findOne({ licenseKey });
    
    if (!license) {
      return res.status(403).json({
        valid: false,
        reason: 'License not found'
      });
    }
    
    // Check if license is active
    if (!license.isActive) {
      return res.status(403).json({
        valid: false,
        reason: 'License is not active'
      });
    }
    
    // Check if license is expired
    if (license.expiresAt && new Date() > license.expiresAt) {
      return res.status(403).json({
        valid: false,
        reason: 'License expired'
      });
    }
    
    // Record activation
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    const activation = {
      timestamp: new Date(),
      machineId: machineId || 'unknown',
      os: os || 'unknown',
      app: app || 'unknown',
      ip: clientIP
    };
    
    license.activations.push(activation);
    await license.save();
    
    // Return success response
    res.json({
      valid: true,
      name: license.name,
      email: license.email,
      expiresAt: license.expiresAt
    });
    
  } catch (err) {
    console.error('Error verifying license:', err);
    res.status(500).json({
      valid: false,
      reason: 'Server error'
    });
  }
});

// Gumroad Webhook
app.post('/api/webhooks/gumroad', async (req, res) => {
  try {
    // Verify seller ID
    if (CONFIG.GUMROAD_SELLER_ID && req.body.seller_id !== CONFIG.GUMROAD_SELLER_ID) {
      return res.status(403).json({
        success: false,
        message: 'Invalid seller ID'
      });
    }
    
    // Process only sale events
    if (req.body.resource_name !== 'sale') {
      return res.json({
        success: true,
        message: 'Non-sale event acknowledged'
      });
    }
    
    const { email, full_name, sale_id, product_id } = req.body;
    
    // Check if license already exists for this sale
    const existingLicense = await License.findOne({
      'metadata.gumroad_sale_id': sale_id
    });
    
    if (existingLicense) {
      return res.json({
        success: true,
        message: 'License already exists',
        license: existingLicense
      });
    }
    
    // Generate license key
    const { licenseKey } = licenseUtils.generateLicenseKey({
      email,
      name: full_name,
      metadata: {
        gumroad_sale_id: sale_id,
        gumroad_product_id: product_id
      }
    });
    
    // Create license document
    const license = new License({
      licenseKey,
      email,
      name: full_name,
      source: 'gumroad',
      metadata: {
        gumroad_sale_id: sale_id,
        gumroad_product_id: product_id
      }
    });
    
    await license.save();
    
    console.log(`Created license for Gumroad sale ${sale_id}`);
    
    res.json({
      success: true,
      message: 'License created',
      license
    });
  } catch (err) {
    console.error('Error processing Gumroad webhook:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Import other routes (with error handling)
try {
  const authRoutes = require('./routes/auth.routes');
  const aiRoutes = require('./routes/ai.routes');

  // Mount additional routes
  app.use('/api/auth', authRoutes);
  app.use('/api/ai', aiRoutes);
} catch (error) {
  console.warn('Some route files are missing:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: CONFIG.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
      code: 'INTERNAL_SERVER_ERROR'
    }
  });
});

// 404 handler for all other routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      code: 'NOT_FOUND'
    }
  });
});

// Function to start server with automatic port selection
async function startServer(port) {
  try {
    await promisify(server.listen.bind(server))(port);
    console.log(`Server running at http://localhost:${port}/`);
    return true;
  } catch (err) {
    if (err.code === 'EADDRINUSE' && port < CONFIG.PORT_RANGE_MAX) {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      return startServer(port + 1);
    }
    throw err;
  }
}

// Connect to MongoDB with retry logic
async function connectMongoDB() {
  // Log the MongoDB URI with masked credentials for debugging
  const connectionUri = CONFIG.MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
  console.log(`Connecting to MongoDB: ${connectionUri}`);
  
  try {
    await mongoose.connect(CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    // Create indexes
    await License.collection.createIndex({ licenseKey: 1 }, { unique: true });
    await License.collection.createIndex({ email: 1 });
    console.log('Database indexes created');
    
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying in 5 seconds...');
    return new Promise(resolve => {
      setTimeout(async () => {
        resolve(await connectMongoDB());
      }, 5000);
    });
  }
}

// Start the server
async function startApp() {
  try {
    const dbConnected = await connectMongoDB();
    if (!dbConnected) {
      console.warn('Failed to connect to MongoDB after multiple attempts.');
    }
    await startServer(CONFIG.PORT);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
function shutdownGracefully() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    
    // Use promise-based mongoose.connection.close()
    mongoose.connection.close()
      .then(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
      })
      .catch(err => {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
      });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  });
}

// Handle termination signals
process.on('SIGTERM', shutdownGracefully);
process.on('SIGINT', shutdownGracefully);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdownGracefully();
});

// Start the application
startApp();

// Export for testing
module.exports = { app, server };