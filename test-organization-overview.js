// Test script to verify Organization Overview data
// Run this with: node test-organization-overview.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./backend/models/User');

async function testOrganizationOverview() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get all active users
    const allUsers = await User.find({ isActive: true }).select('fullName username role department');
    console.log(`\n📊 Total active users: ${allUsers.length}`);

    // Count by role
    const roleStats = {};
    allUsers.forEach(user => {
      const role = user.role?.toLowerCase().trim() || 'unknown';
      roleStats[role] = (roleStats[role] || 0) + 1;
    });

    console.log('\n📈 Users by Role:');
    console.log('─────────────────────────────');
    Object.entries(roleStats).sort((a, b) => b[1] - a[1]).forEach(([role, count]) => {
      console.log(`  ${role.padEnd(20)}: ${count}`);
    });

    // Check for sub_engineer specifically
    const subEngineers = allUsers.filter(u => u.role === 'sub_engineer');
    console.log('\n🔍 Sub Engineer Users:');
    console.log('─────────────────────────────');
    if (subEngineers.length > 0) {
      subEngineers.forEach(user => {
        console.log(`  - ${user.fullName || user.username} (${user.role})`);
      });
    } else {
      console.log('  ⚠️  No users with role "sub_engineer" found!');
      console.log('  💡 Tip: Make sure users in database have role field set to "sub_engineer"');
    }

    // Show sample of all roles
    console.log('\n📋 Sample users with their roles:');
    console.log('─────────────────────────────');
    allUsers.slice(0, 10).forEach(user => {
      console.log(`  - ${(user.fullName || user.username).padEnd(25)} | Role: ${user.role || 'N/A'}`);
    });

    // Test the API query logic
    console.log('\n🧪 Testing API query logic...');
    const statsByRole = {};
    allUsers.forEach(u => {
      const role = u.role?.toLowerCase().trim() || 'unknown';
      statsByRole[role] = (statsByRole[role] || 0) + 1;
    });

    const byRoleArray = Object.entries(statsByRole).map(([role, count]) => ({ role, count }));
    console.log('API would return byRole array:');
    console.log(JSON.stringify(byRoleArray, null, 2));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testOrganizationOverview();

