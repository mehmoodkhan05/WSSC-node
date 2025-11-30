/**
 * Verification script to check if backend and frontend are configured
 * to use the same database connection and test actual connectivity
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const backendEnvPath = path.join(__dirname, 'backend', '.env');
const frontendEnvPath = path.join(__dirname, '.env');

let hasIssues = false;
let backendPort = 3000;

async function checkEnvFile(envPath, fileType) {
  if (!fs.existsSync(envPath)) {
    console.log(`⚠️  ${fileType} .env file not found!`);
    const envFileName = envPath.includes('backend') ? 'backend/.env' : '.env';
    console.log(`   Please create ${envFileName} file with the required configuration.\n`);
    return { exists: false, content: null };
  }
  console.log(`✅ ${fileType} .env file exists`);
  const content = fs.readFileSync(envPath, 'utf8');
  
  const portMatch = content.match(/PORT=(.+)/);
  if (portMatch && envPath.includes('backend')) {
    backendPort = parseInt(portMatch[1].trim()) || 3000;
  }
  
  return { exists: true, content };
}

function checkMongoDBUri(envContent) {
  if (!envContent || !envContent.includes('MONGODB_URI')) {
    console.log('   ⚠️  MONGODB_URI not found in backend/.env');
    return { valid: false, uri: null, dbName: null };
  }
  const mongoUriMatch = envContent.match(/MONGODB_URI=(.+)/);
  if (!mongoUriMatch) {
    console.log('   ⚠️  MONGODB_URI format is invalid');
    return { valid: false, uri: null, dbName: null };
  }
  
  const mongoUri = mongoUriMatch[1].trim().replace(/['"]/g, '');
  const dbName = mongoUri.split('/').pop().split('?')[0];
  
  console.log(`   ✅ MONGODB_URI configured`);
  console.log(`   📊 Database name: ${dbName}`);
  
  return { valid: true, uri: mongoUri, dbName };
}

function checkApiUrl(envContent) {
  if (!envContent || !envContent.includes('EXPO_PUBLIC_API_URL')) {
    console.log('   ⚠️  EXPO_PUBLIC_API_URL not found in .env');
    console.log('   💡 Using default: http://localhost:3000/api');
    return { valid: false, url: 'http://localhost:3000/api' };
  }
  const apiUrlMatch = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
  if (!apiUrlMatch) {
    console.log('   ⚠️  EXPO_PUBLIC_API_URL format is invalid');
    return { valid: false, url: 'http://localhost:3000/api' };
  }
  
  let apiUrl = apiUrlMatch[1].trim().replace(/['"]/g, '');
  if (!apiUrl.endsWith('/api')) {
    if (apiUrl.endsWith('/')) {
      apiUrl += 'api';
    } else {
      apiUrl += '/api';
    }
  }
  
  console.log(`   ✅ EXPO_PUBLIC_API_URL configured: ${apiUrl}`);
  
  const urlMatch = apiUrl.match(/http:\/\/[^:]+:(\d+)/);
  if (urlMatch) {
    backendPort = parseInt(urlMatch[1]) || backendPort;
  }
  
  return { valid: true, url: apiUrl };
}

function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const timeoutId = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, timeout);
    
    const req = client.get(url, (res) => {
      clearTimeout(timeoutId);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

async function testBackendConnection(apiUrl) {
  console.log(`\n🔌 Testing backend connection...`);
  const baseUrl = apiUrl.replace('/api', '');
  console.log(`   Attempting to connect to: ${baseUrl}`);
  
  try {
    const healthUrl = baseUrl + '/health';
    const response = await makeRequest(healthUrl, 5000);
    
    if (response.ok) {
      console.log(`   ✅ Backend is running and responding`);
      return { connected: true, error: null };
    } else {
      console.log(`   ⚠️  Backend responded with status: ${response.status}`);
      return { connected: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`   ❌ Cannot connect to backend: ${error.message}`);
    console.log(`   💡 Make sure the backend server is running:`);
    console.log(`      cd backend && npm run dev`);
    return { connected: false, error: error.message };
  }
}

async function testDatabaseConnection(apiUrl) {
  console.log(`\n🗄️  Testing database connection...`);
  
  try {
    const dbInfoUrl = apiUrl.replace('/api', '') + '/api/db-info';
    const response = await makeRequest(dbInfoUrl, 5000);
    
    if (!response.ok) {
      console.log(`   ❌ Failed to get database info: HTTP ${response.status}`);
      return { connected: false, info: null, error: `HTTP ${response.status}` };
    }
    
    const data = response.data;
    
    if (data.success && data.database) {
      const dbState = data.database.state;
      const dbName = data.database.name;
      
      if (dbState === 'connected') {
        console.log(`   ✅ Database is connected`);
        console.log(`   📊 Database name: ${dbName}`);
        console.log(`   🖥️  Database host: ${data.database.host}:${data.database.port || 27017}`);
        return { connected: true, info: data.database, error: null };
      } else {
        console.log(`   ⚠️  Database state: ${dbState}`);
        return { connected: false, info: data.database, error: `State: ${dbState}` };
      }
    } else {
      console.log(`   ⚠️  Unexpected response format`);
      return { connected: false, info: null, error: 'Invalid response format' };
    }
  } catch (error) {
    console.log(`   ❌ Cannot get database info: ${error.message}`);
    return { connected: false, info: null, error: error.message };
  }
}

async function verifyConfiguration() {
  console.log('🔍 Verifying Database Configuration...\n');
  
  const backendEnv = await checkEnvFile(backendEnvPath, 'Backend');
  let mongoConfig = { valid: false, uri: null, dbName: null };
  
  if (backendEnv.exists) {
    mongoConfig = checkMongoDBUri(backendEnv.content);
    if (!mongoConfig.valid) {
      hasIssues = true;
    }
  } else {
    hasIssues = true;
  }
  
  console.log('');
  const frontendEnv = await checkEnvFile(frontendEnvPath, 'Frontend');
  let apiConfig = checkApiUrl(frontendEnv.exists ? frontendEnv.content : null);
  
  console.log('\n📋 Configuration Summary:');
  console.log('   Backend connects to MongoDB using MONGODB_URI');
  console.log('   Frontend connects to Backend API using EXPO_PUBLIC_API_URL');
  console.log('   Both use the same database through the backend connection\n');
  
  if (hasIssues) {
    console.log('❌ Configuration issues found. Please fix them before running the app.\n');
    process.exit(1);
  }
  
  console.log('🔗 Testing connections...\n');
  
  const backendTest = await testBackendConnection(apiConfig.url);
  
  if (backendTest.connected) {
    const dbTest = await testDatabaseConnection(apiConfig.url);
    
    if (dbTest.connected) {
      console.log('\n✅ All connections verified successfully!');
      console.log('\n📊 Connection Status:');
      console.log(`   ✅ Backend server: Running on port ${backendPort}`);
      console.log(`   ✅ Database: Connected (${dbTest.info.name})`);
      console.log(`   ✅ Frontend API URL: ${apiConfig.url}`);
      console.log(`   ✅ All systems using the same database\n`);
      process.exit(0);
    } else {
      console.log('\n⚠️  Backend is running but database is not connected.');
      console.log('   Please check MongoDB connection in backend/.env\n');
      process.exit(1);
    }
  } else {
    console.log('\n⚠️  Backend server is not running.');
    console.log('   Please start the backend server first:');
    console.log('   cd backend && npm run dev\n');
    process.exit(1);
  }
}

verifyConfiguration().catch((error) => {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});