const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const net = require('net');

dotenv.config();

const app = express();

let authRoutes, userRoutes, attendanceRoutes, locationRoutes, assignmentRoutes;
let leaveRoutes, dashboardRoutes, approvalRoutes, performanceRoutes;
let systemRoutes, liveTrackingRoutes;

try {
  authRoutes = require('./routes/auth');
  userRoutes = require('./routes/users');
  attendanceRoutes = require('./routes/attendance');
  locationRoutes = require('./routes/locations');
  assignmentRoutes = require('./routes/assignments');
  leaveRoutes = require('./routes/leave');
  dashboardRoutes = require('./routes/dashboard');
  approvalRoutes = require('./routes/approvals');
  performanceRoutes = require('./routes/performance');
  systemRoutes = require('./routes/system');
  liveTrackingRoutes = require('./routes/liveTracking');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
  process.exit(1);
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WSSC Management System API',
    version: '1.0.0',
    endpoints: {
      health: '/health - Server health check',
      api: '/api - API information and available routes',
      database: '/api/db-info - Database connection info',
      auth: '/api/auth - Authentication routes',
      users: '/api/users - User management',
      attendance: '/api/attendance - Attendance tracking',
      locations: '/api/locations - Location management',
      assignments: '/api/assignments - Staff assignments',
      leave: '/api/leave - Leave requests',
      dashboard: '/api/dashboard - Dashboard data',
      approvals: '/api/approvals - Approval workflows',
      performance: '/api/performance - Performance reviews',
      system: '/api/system - System configuration',
      liveTracking: '/api/live-tracking - Live location tracking'
    },
    server: {
      port: req.socket.localPort || process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

let serverPort = null;

app.get('/api/db-info', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc-db';
  const dbName = mongoUri.split('/').pop().split('?')[0];
  
  // Get database statistics
  let dbStats = null;
  let usersCount = 0;
  let collections = [];
  
  if (dbState === 1) { // connected
    try {
      const db = mongoose.connection.db;
      dbStats = await db.stats();
      collections = await db.listCollections().toArray();
      
      // Count users in the users collection
      const User = require('./models/User');
      usersCount = await User.countDocuments();
    } catch (error) {
      console.error('Error getting database stats:', error.message);
    }
  }
  
  res.json({
    success: true,
    database: {
      name: mongoose.connection.name || dbName,
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 27017,
      state: states[dbState] || 'unknown',
      readyState: dbState,
      uri: mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      collections: collections.map(c => c.name),
      usersCollection: {
        exists: collections.some(c => c.name === 'users'),
        documentCount: usersCount
      },
      stats: dbStats ? {
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize
      } : null
    },
    backend: {
      port: serverPort || req.socket.localPort || process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// API root endpoint - shows available routes
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'WSSC Management System API',
    version: '1.0.0',
    documentation: {
      health: '/health - Server health check',
      database: '/api/db-info - Database connection info',
      endpoints: {
        auth: '/api/auth - Authentication routes',
        users: '/api/users - User management',
        attendance: '/api/attendance - Attendance tracking',
        locations: '/api/locations - Location management',
        assignments: '/api/assignments - Staff assignments',
        leave: '/api/leave - Leave requests',
        dashboard: '/api/dashboard - Dashboard data',
        approvals: '/api/approvals - Approval workflows',
        performance: '/api/performance - Performance reviews',
        system: '/api/system - System configuration',
        liveTracking: '/api/live-tracking - Live location tracking'
      }
    },
    server: {
      port: req.socket.localPort || process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/live-tracking', liveTrackingRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc-db';
    const dbName = mongoUri.split('/').pop().split('?')[0];
    
    console.log(`Connecting to MongoDB...`);
    console.log(`Database: ${dbName}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    }
    
    mongoose.set('strictQuery', false);
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Database: ${conn.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Make sure MongoDB is running and MONGODB_URI is correct in backend/.env');
    throw error;
  }
};

const PORT = process.env.PORT || 3000;

const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
};

const findAvailablePort = async (startPort, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`Could not find an available port starting from ${startPort}`);
};

const startServer = async () => {
  try {
    await connectDB();
    
    let serverPort = PORT;
    const requestedPort = PORT;
    const isPortExplicitlySet = !!process.env.PORT;
    
    if (!(await isPortAvailable(serverPort))) {
      if (isPortExplicitlySet) {
        console.error(`\n❌ Port ${serverPort} is already in use (specified in PORT env variable)`);
        console.error(`   Please free port ${serverPort} or set a different PORT in backend/.env\n`);
        process.exit(1);
      } else {
        console.warn(`⚠️  Port ${serverPort} is already in use`);
        console.warn(`   Looking for an available port starting from ${serverPort}...`);
        
        try {
          serverPort = await findAvailablePort(serverPort, 10);
          console.log(`✅ Found available port: ${serverPort}`);
          console.log(`   Server will run on port ${serverPort} instead of ${requestedPort}`);
          console.log(`   Update your frontend .env EXPO_PUBLIC_API_URL to: http://localhost:${serverPort}/api`);
        } catch (error) {
          console.error(`❌ ${error.message}`);
          console.error(`   Please free up some ports or set PORT in backend/.env\n`);
          process.exit(1);
        }
      }
    }
    
    const server = app.listen(serverPort, '0.0.0.0', () => {
      const actualPort = server.address().port;
      serverPort = actualPort;
      console.log(`✅ Server running on port ${actualPort} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`✅ Health check: http://localhost:${actualPort}/health`);
      console.log(`✅ API base URL: http://localhost:${actualPort}/api`);
      if (actualPort !== requestedPort) {
        console.log(`\n⚠️  NOTE: Server is running on port ${actualPort} (requested: ${requestedPort})`);
      }
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${serverPort} is already in use!`);
        console.error(`   Please set a different PORT in backend/.env\n`);
        process.exit(1);
      } else {
        console.error(`\n❌ Server error: ${error.message}\n`);
        console.error(error.stack);
      }
    });

    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} signal received: closing HTTP server gracefully`);
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      console.error(error.stack);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      console.error(reason?.stack || reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

startServer().catch((error) => {
  console.error('❌ Fatal error starting server:', error);
  console.error(error.stack);
  process.exit(1);
});

module.exports = app;