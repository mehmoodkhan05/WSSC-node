/**
 * Verification script to check if backend and frontend are configured
 * to use the same database connection
 */

const fs = require('fs');
const path = require('path');

const backendEnvPath = path.join(__dirname, 'backend', '.env');
const frontendEnvPath = path.join(__dirname, '.env');

let hasIssues = false;

function checkEnvFile(envPath, fileType) {
  if (!fs.existsSync(envPath)) {
    console.log(`⚠️  ${fileType} .env file not found!`);
    const envFileName = envPath.includes('backend') ? 'backend/.env' : '.env';
    console.log(`   Please create ${envFileName} file with the required configuration.\n`);
    return { exists: false, content: null };
  }
  console.log(`✅ ${fileType} .env file exists`);
  return { exists: true, content: fs.readFileSync(envPath, 'utf8') };
}

function checkMongoDBUri(envContent) {
  if (!envContent || !envContent.includes('MONGODB_URI')) {
    console.log('   ⚠️  MONGODB_URI not found in backend/.env');
    return false;
  }
  const mongoUri = envContent.match(/MONGODB_URI=(.+)/)?.[1];
  if (mongoUri && !mongoUri.includes('localhost') && !mongoUri.includes('mongodb.net')) {
    console.log('   ⚠️  MONGODB_URI found but may need verification');
  } else {
    console.log('   ✅ MONGODB_URI configured');
  }
  return true;
}

function checkApiUrl(envContent) {
  if (!envContent || !envContent.includes('EXPO_PUBLIC_API_URL')) {
    console.log('   ⚠️  EXPO_PUBLIC_API_URL not found in .env');
    return false;
  }
  const apiUrl = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/)?.[1];
  if (apiUrl) {
    console.log('   ✅ EXPO_PUBLIC_API_URL configured:', apiUrl.trim());
  }
  return true;
}

console.log('🔍 Verifying Database Configuration...\n');

const backendEnv = checkEnvFile(backendEnvPath, 'Backend');
if (!backendEnv.exists || !checkMongoDBUri(backendEnv.content)) {
  hasIssues = true;
}

const frontendEnv = checkEnvFile(frontendEnvPath, 'Frontend');
if (!frontendEnv.exists || !checkApiUrl(frontendEnv.content)) {
  hasIssues = true;
}

console.log('\n📋 Configuration Summary:');
console.log('   Backend connects to MongoDB using MONGODB_URI');
console.log('   Frontend connects to Backend API using EXPO_PUBLIC_API_URL');
console.log('   Both use the same database through the backend connection\n');

if (hasIssues) {
  console.log('❌ Some configuration issues found. Please fix them before running the app.');
  console.log('   See DATABASE_CONFIG.md for detailed instructions.\n');
  process.exit(1);
}

console.log('✅ Configuration looks good!');
console.log('   Next steps:');
console.log('   1. Start MongoDB: net start MongoDB (Windows) or brew services start mongodb-community (Mac)');
console.log('   2. Start backend: cd backend && npm run dev');
console.log('   3. Start frontend: npm start');
console.log('   4. Verify: curl http://localhost:3000/api/db-info\n');