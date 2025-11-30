const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/auth');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'staff' } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check if user exists in database
    console.log(`[DB Query] Checking if user exists with email: ${email}`);
    const existingUser = await User.findOne({ $or: [{ email }, { username: email }] });
    if (existingUser) {
      console.log(`[DB Query] User already exists in database`);
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create user in database
    console.log(`[DB Query] Creating new user in database: ${email}`);
    const startTime = Date.now();
    const user = await User.create({
      email,
      username: email,
      password,
      fullName: fullName || '',
      role
    });
    const createTime = Date.now() - startTime;
    console.log(`[DB Query] User created successfully in ${createTime}ms. User ID: ${user._id}`);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check for user in database
    console.log(`[DB Query] Searching for user with email: ${email}`);
    const startTime = Date.now();
    
    const user = await User.findOne({ $or: [{ email }, { username: email }] })
      .select('+password');
    
    const queryTime = Date.now() - startTime;
    console.log(`[DB Query] User lookup completed in ${queryTime}ms. Found: ${user ? 'Yes' : 'No'}`);

    if (!user || !user.isActive) {
      console.log(`[Auth] Login failed: User not found or inactive`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password matches
    console.log(`[Auth] Comparing password for user: ${user.email}`);
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log(`[Auth] Login failed: Password mismatch for user ${user.email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    console.log(`[Auth] Password verified successfully for user: ${user.email}`);

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    console.log(`[DB Query] Fetching user profile for ID: ${req.user._id}`);
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.log(`[DB Query] User not found in database`);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log(`[DB Query] User profile retrieved: ${user.email}`);

    res.json({
      success: true,
      user: {
        user_id: user._id,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        username: user.username,
        profile_photo_url: user.profilePhotoUrl || null,
        department: user.department || null,
        departments: user.departments || [],
        manager_id: user.managerId || null,
        general_manager_id: user.generalManagerId || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

