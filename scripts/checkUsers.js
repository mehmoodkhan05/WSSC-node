/**
 * Script to check users in the database
 * Usage: node scripts/checkUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../backend/models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc-db';

async function checkUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).select('-password');
    console.log(`Found ${users.length} user(s) in database:\n`);

    if (users.length === 0) {
      console.log('No users found. You need to create a user first.');
      console.log('Run: node scripts/createFirstUser.js admin@wssc.com admin123 "Admin User" super_admin');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Name: ${user.fullName || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
        console.log(`   ID: ${user._id}`);
        console.log('');
      });
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();

