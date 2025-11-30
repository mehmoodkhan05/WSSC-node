const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/locations');
const assignmentRoutes = require('./routes/assignments');
const leaveRoutes = require('./routes/leave');
const dashboardRoutes = require('./routes/dashboard');
const approvalRoutes = require('./routes/approvals');
const performanceRoutes = require('./routes/performance');
const systemRoutes = require('./routes/system');
const liveTrackingRoutes = require('./routes/liveTracking');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Database info endpoint (for verification)
app.get('/api/db-info', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    success: true,
    database: {
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      state: states[dbState] || 'unknown',
      readyState: dbState
    },
    backend: {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
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
    
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Make sure MongoDB is running and MONGODB_URI is correct in backend/.env');
    process.exit(1);
  }
};

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use!`);
      console.error(`   Another process is using port ${PORT}.`);
      console.error(`   To find and kill the process:`);
      console.error(`   Windows: netstat -ano | findstr :${PORT}`);
      console.error(`   Then: taskkill /PID <PID> /F`);
      console.error(`   Or use a different port by setting PORT in backend/.env\n`);
      process.exit(1);
    } else {
      console.error(`\n❌ Server error: ${error.message}\n`);
      process.exit(1);
    }
  });
};

startServer();

module.exports = app;