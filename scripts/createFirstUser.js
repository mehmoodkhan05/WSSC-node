/**
 * Script to create the first user account
 * Usage: node scripts/createFirstUser.js <email> <password> <fullName> [role]
 * 
 * Example:
 *   node scripts/createFirstUser.js admin@wssc.com admin123 "Admin User" super_admin
 */

require('dotenv').config();

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000/api';

async function createUser(email, password, fullName, role = 'staff') {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        fullName,
        role
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Request failed with status ${response.status}`);
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node scripts/createFirstUser.js <email> <password> <fullName> [role]');
    console.log('\nExample:');
    console.log('  node scripts/createFirstUser.js admin@wssc.com admin123 "Admin User" super_admin');
    console.log('\nAvailable roles: staff, supervisor, manager, general_manager, ceo, super_admin');
    console.log('\nEnvironment variables:');
    console.log('  EXPO_PUBLIC_API_URL or API_URL - API base URL (default: http://localhost:3000/api)');
    process.exit(1);
  }
  
  const email = args[0];
  const password = args[1];
  const fullName = args[2];
  const role = args[3] || 'staff';
  
  (async () => {
    try {
      console.log(`Creating user: ${email}`);
      console.log(`API URL: ${API_BASE_URL}`);
      const result = await createUser(email, password, fullName, role);
      
      if (result.success) {
        console.log('\n✅ User created successfully!');
        console.log(`   Email: ${result.user.email}`);
        console.log(`   Name: ${result.user.fullName}`);
        console.log(`   Role: ${result.user.role}`);
        console.log(`   User ID: ${result.user.id}`);
        console.log('\nYou can now login with these credentials in the mobile app.');
      } else {
        console.error('❌ Failed to create user:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { createUser };

