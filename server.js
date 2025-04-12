/**
 * AI Resume Generator Server
 * 
 * Features:
 * - Automatic port selection if primary port is in use
 * - Improved error handling and logging
 * - MongoDB connection with retry logic
 * - Proper request logging and security headers
 * - Health check endpoint
 * - Graceful shutdown
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
const { promisify } = require('util');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Configuration with defaults
const CONFIG = {
  PORT: process.env.PORT || 3000,
  PORT_RANGE_MAX: process.env.PORT_RANGE_MAX || 3020, // Try ports up to this number
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-resume-generator',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  LOG_FORMAT: process.env.LOG_FORMAT || 'dev',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  LICENSE_SECRET: process.env.LICENSE_SECRET || 'license-secret-key-change-in-production',
};

// Set up logging
if (CONFIG.NODE_ENV !== 'test') {
  app.use(morgan(CONFIG.LOG_FORMAT));
}

// Create required directories if they don't exist
['public', 'public/auth', 'public/app'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: CONFIG.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Static files
app.use('/auth', express.static(path.join(__dirname, 'public/auth')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Import routes (with error handling in case files don't exist yet)
try {
  const authRoutes = require('./routes/auth.routes');
  const licenseRoutes = require('./routes/license.routes');
  const aiRoutes = require('./routes/ai.routes');
  const webhookRoutes = require('./routes/webhook.routes');

  // Import middleware (with error handling)
  const authMiddleware = require('./middleware/auth.middleware');

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/license', licenseRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Protected routes
  app.use('/app', authMiddleware, express.static(path.join(__dirname, 'public/app')));
} catch (error) {
  console.warn('Some route files or middleware are missing. Please create them before deploying.', error.message);
  
  // Create placeholder routes for development
  app.get('/api/auth', (req, res) => res.json({ message: 'Auth routes not implemented yet' }));
  app.get('/api/license', (req, res) => res.json({ message: 'License routes not implemented yet' }));
  app.get('/api/ai', (req, res) => res.json({ message: 'AI routes not implemented yet' }));
  app.get('/api/webhooks', (req, res) => res.json({ message: 'Webhook routes not implemented yet' }));
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
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  };
  
  try {
    await mongoose.connect(CONFIG.MONGODB_URI, options);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectMongoDB, 5000);
  }
}

// Start the server
async function startApp() {
  try {
    await connectMongoDB();
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
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
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

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdownGracefully();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't shutdown for unhandled promises, just log
});

// Start the application
startApp();

// Export for testing
module.exports = { app, server };