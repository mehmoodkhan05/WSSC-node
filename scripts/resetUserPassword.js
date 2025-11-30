/**
 * Script to reset a user's password
 * Usage: node scripts/resetUserPassword.js <email> <newPassword>
 * 
 * Note: This requires direct database access. For production, use proper password reset flow.
 */

require('dotenv').config();

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000/api';

async function testLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    return { success: response.ok, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/resetUserPassword.js <email> <newPassword>');
    console.log('\nExample:');
    console.log('  node scripts/resetUserPassword.js admin@wssc.com newpassword123');
    console.log('\nNote: This script tests login. To actually reset password, you need admin access.');
    process.exit(1);
  }
  
  const email = args[0];
  const password = args[1];
  
  (async () => {
    try {
      console.log(`Testing login for: ${email}`);
      console.log(`API URL: ${API_BASE_URL}\n`);
      
      const loginResult = await testLogin(email, password);
      
      if (loginResult.success && loginResult.result.success) {
        console.log('✅ Login successful!');
        console.log(`   User: ${loginResult.result.user.email}`);
        console.log(`   Role: ${loginResult.result.user.role}`);
        console.log('\nThe credentials are correct. If you\'re still getting errors, check:');
        console.log('1. Backend server logs for detailed error messages');
        console.log('2. Network connectivity between mobile app and backend');
        console.log('3. CORS settings if accessing from web');
      } else {
        console.log('❌ Login failed');
        console.log(`   Error: ${loginResult.result?.error || loginResult.error}`);
        console.log('\nPossible issues:');
        console.log('1. Wrong password - try resetting it');
        console.log('2. User is inactive - check database');
        console.log('3. User doesn\'t exist - create it first');
        console.log('\nTo create a new user:');
        console.log('  node scripts/createFirstUser.js <email> <password> <fullName> [role]');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { testLogin };

