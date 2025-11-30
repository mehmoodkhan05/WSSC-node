const Parse = require('parse/node');
require('dotenv').config();

if (!process.env.EXPO_PUBLIC_PARSE_APP_ID || !process.env.EXPO_PUBLIC_PARSE_JS_KEY) {
  console.error('Error: EXPO_PUBLIC_PARSE_APP_ID and EXPO_PUBLIC_PARSE_JS_KEY must be set in environment variables');
  process.exit(1);
}

Parse.initialize(
  process.env.EXPO_PUBLIC_PARSE_APP_ID,
  process.env.EXPO_PUBLIC_PARSE_JS_KEY
);
Parse.serverURL = process.env.EXPO_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

const fs = require('fs');
const path = require('path');

async function deployCloudCode() {
  try {
    if (!process.env.PARSE_MASTER_KEY) {
      console.error('Error: PARSE_MASTER_KEY must be set in environment variables');
      process.exit(1);
    }

    console.log('Starting cloud code deployment...');

    const cloudCodePath = path.join(__dirname, 'cloud', 'main.js');
    const cloudCode = fs.readFileSync(cloudCodePath, 'utf8');

    const response = await fetch(`${Parse.serverURL}/functions/deploy`, {
      method: 'POST',
      headers: {
        'X-Parse-Application-Id': Parse.applicationId,
        'X-Parse-Master-Key': process.env.PARSE_MASTER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: cloudCode,
        functions: ['fetchAllProfiles', 'fetchStaff', 'fetchSupervisors', 'deleteUser', 'deleteLocation', 'getDashboardStats', 'fetchTodayAttendance', 'fetchTodayLeaveRequests', 'createStaffAssignment', 'createSupervisorLocation', 'fetchSupervisorLocations', 'fetchAssignments', 'fetchLeaveRequests', 'updateLeaveRequestStatus', 'clockIn', 'clockOut', 'fetchPendingApprovals', 'approveAttendance', 'rejectAttendance', 'fetchPerformanceReviews', 'generatePerformancePDF', 'updatePerformanceReviewPDF']
      })
    });

    if (!response.ok) {
      throw new Error(`Deployment failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Cloud code deployed successfully:', result);

  } catch (error) {
    console.error('Error deploying cloud code:', error);
    process.exit(1);
  }
}

deployCloudCode();
