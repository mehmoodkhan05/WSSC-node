/**
 * Script to reset user password directly in database
 * Usage: node scripts/resetPasswordDirect.js <email> <newPassword>
 * 
 * Run from project root: node scripts/resetPasswordDirect.js admin@wssc.com admin123
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

// Use backend's node_modules
const backendPath = require('path').join(__dirname, '..', 'backend');
process.env.NODE_PATH = require('path').join(backendPath, 'node_modules');

const mongoose = require(require('path').join(backendPath, 'node_modules', 'mongoose'));
const bcrypt = require(require('path').join(backendPath, 'node_modules', 'bcryptjs'));
const User = require(require('path').join(backendPath, 'models', 'User'));

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc-db';

async function resetPassword(email, newPassword) {
  try {
    console.log('Connecting to MongoDB...');
    console.log(`Database: ${mongoUri.split('/').pop().split('?')[0]}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    const user = await User.findOne({ $or: [{ email }, { username: email }] });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      console.log('\nCreating new user instead...');
      
      const newUser = await User.create({
        email,
        username: email,
        password: newPassword,
        fullName: email.split('@')[0],
        role: 'super_admin',
        isActive: true
      });
      
      console.log('✅ User created successfully!');
      console.log(`\nCredentials:`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Password: ${newPassword}`);
      console.log(`   Role: ${newUser.role}`);
      
      await mongoose.disconnect();
      return;
    }

    console.log(`Found user: ${user.email}`);
    console.log(`Current status: Active=${user.isActive !== false}, Role=${user.role}`);
    
    // Fix invalid role
    const validRoles = ['staff', 'supervisor', 'manager', 'general_manager', 'ceo', 'super_admin'];
    if (!validRoles.includes(user.role)) {
      console.log(`⚠️  Invalid role "${user.role}" detected. Updating to "super_admin"...`);
      user.role = 'super_admin';
    }
    
    // Ensure username exists
    if (!user.username) {
      console.log(`⚠️  Missing username. Setting to email...`);
      user.username = user.email;
    }
    
    console.log(`\nResetting password...`);

    // Update password - the pre-save hook will hash it
    user.password = newPassword; // Set plain password, pre-save hook will hash it
    user.isActive = true; // Ensure user is active
    
    // Mark password as modified so pre-save hook processes it
    user.markModified('password');
    await user.save();

    console.log('✅ Password reset successfully!');
    console.log(`\nNew credentials:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`\nYou can now login with these credentials.`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/resetPasswordDirect.js <email> <newPassword>');
    console.log('\nExample:');
    console.log('  node scripts/resetPasswordDirect.js admin@wssc.com admin123');
    process.exit(1);
  }
  
  const email = args[0];
  const password = args[1];
  
  resetPassword(email, password);
}

module.exports = { resetPassword };
