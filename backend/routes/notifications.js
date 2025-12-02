const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

// @route   POST /api/notifications/register-token
// @desc    Register or update user's push notification token
// @access  Private
router.post('/register-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required'
      });
    }

    // Validate the token format
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Expo push token format'
      });
    }

    // Update user's push token
    await User.findByIdAndUpdate(userId, {
      expoPushToken: token,
      pushNotificationsEnabled: true
    });

    res.json({
      success: true,
      message: 'Push token registered successfully'
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/notifications/unregister
// @desc    Disable push notifications for user
// @access  Private
router.post('/unregister', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      expoPushToken: null,
      pushNotificationsEnabled: false
    });

    res.json({
      success: true,
      message: 'Push notifications disabled'
    });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/notifications/status
// @desc    Get user's push notification status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('expoPushToken pushNotificationsEnabled');

    res.json({
      success: true,
      data: {
        enabled: user.pushNotificationsEnabled || false,
        hasToken: !!user.expoPushToken
      }
    });
  } catch (error) {
    console.error('Error getting notification status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to send push notification to a user
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId).select('expoPushToken pushNotificationsEnabled fullName');

    if (!user || !user.pushNotificationsEnabled || !user.expoPushToken) {
      console.log(`[Notifications] User ${userId} has notifications disabled or no token`);
      return { success: false, reason: 'notifications_disabled' };
    }

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      console.log(`[Notifications] Invalid push token for user ${userId}`);
      return { success: false, reason: 'invalid_token' };
    }

    const message = {
      to: user.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    console.log(`[Notifications] Sent notification to user ${userId}: "${title}"`);
    return { success: true, tickets };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, reason: error.message };
  }
}

// Helper function to send push notification to multiple users
async function sendPushNotificationToMany(userIds, title, body, data = {}) {
  const results = [];
  for (const userId of userIds) {
    const result = await sendPushNotification(userId, title, body, data);
    results.push({ userId, ...result });
  }
  return results;
}

// Export helper functions for use in other routes
module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
module.exports.sendPushNotificationToMany = sendPushNotificationToMany;

