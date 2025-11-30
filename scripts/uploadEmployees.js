const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// API Base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000/api';

/**
 * Maps Excel column names to employee field names
 * You can customize this mapping based on your Excel column headers
 */
const fieldMapping = {
  // Required fields
  'email': ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'EMP_EMAIL', 'emp_email'],
  'password': ['password', 'Password', 'PASSWORD'],
  'role': ['role', 'Role', 'ROLE'],
  
  // Basic info
  'fullName': ['fullName', 'Full Name', 'FULL NAME', 'full_name', 'name', 'Name', 'NAME', 'Employee Name', 'EMPLOYEE NAME', 'EMP_NAME', 'emp_name'],
  'empNo': ['empNo', 'Employee Number', 'EMPLOYEE NUMBER', 'emp_no', 'Emp No', 'Employee No', 'EMP_NO', 'emp_no'],
  'empCnic': ['empCnic', 'CNIC', 'cnic', 'CNIC Number', 'CNIC Number', 'EMP_CNIC', 'emp_cnic'],
  'empFname': ['empFname', 'Father Name', 'FATHER NAME', 'Father\'s Name', 'emp_fname', 'EMP_FNAME', 'emp_fname'],
  
  // Department and job info
  'empDeptt': ['empDeptt', 'Department', 'DEPARTMENT', 'dept', 'Dept', 'emp_deptt', 'EMP_DEPTT', 'emp_deptt'],
  'empJob': ['empJob', 'Job', 'JOB', 'Job Title', 'job_title', 'Position', 'emp_job', 'EMP_JOB', 'emp_job'],
  'empGrade': ['empGrade', 'Grade', 'GRADE', 'emp_grade', 'EMP_GRADE', 'emp_grade'],
  
  // Contact info
  'empCell1': ['empCell1', 'Cell 1', 'CELL 1', 'Phone 1', 'Phone', 'Mobile 1', 'emp_cell1', 'EMP_CELL1', 'emp_cell1'],
  'empCell2': ['empCell2', 'Cell 2', 'CELL 2', 'Phone 2', 'Mobile 2', 'emp_cell2', 'EMP_CELL2', 'emp_cell2'],
  
  // Additional info
  'empFlg': ['empFlg', 'Flag', 'FLAG', 'emp_flg', 'EMP_FLG', 'emp_flg'],
  'empMarried': ['empMarried', 'Married', 'MARRIED', 'Marital Status', 'emp_married', 'EMP_MARRIED', 'emp_married'],
  'empGender': ['empGender', 'Gender', 'GENDER', 'Sex', 'emp_gender', 'EMP_GENDER', 'emp_gender'],
  // Note: EMP_WEEK_DAYS is not currently used in the database schema but can be added if needed
};

/**
 * Find the column index for a given field
 */
function findColumnIndex(headers, field) {
  const possibleNames = fieldMapping[field] || [];
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim();
    if (possibleNames.includes(header)) {
      return i;
    }
  }
  return -1;
}

/**
 * Read and parse Excel file
 */
function readExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (data.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return { headers, rows };
  } catch (error) {
    throw new Error(`Error reading Excel file: ${error.message}`);
  }
}

/**
 * Convert Excel row to employee object
 */
function rowToEmployee(row, headers, columnMap) {
  const employee = {};
  
  for (const [field, colIndex] of Object.entries(columnMap)) {
    if (colIndex >= 0 && colIndex < row.length) {
      let value = row[colIndex];
      
      // Handle null/undefined/empty values
      if (value === null || value === undefined || value === '') {
        if (field === 'password' || field === 'email' || field === 'role') {
          // Required fields cannot be empty
          employee[field] = null;
        } else {
          employee[field] = null;
        }
      } else {
        // Convert to appropriate type
        if (typeof value === 'string') {
          value = value.trim();
        }
        
        // Convert to string for text fields (including department and other string fields)
        const stringFields = [
          'empNo', 
          'empCnic', 
          'empCell1', 
          'empCell2', 
          'empDeptt', 
          'empJob', 
          'empGrade', 
          'empFname', 
          'empFlg', 
          'empMarried', 
          'empGender',
          'fullName'
        ];
        
        if (stringFields.includes(field)) {
          value = String(value).trim();
          // If it's empty after conversion, set to null
          if (value === '' || value === 'NaN' || value === 'null' || value === 'undefined') {
            value = null;
          }
        }
        
        // Normalize role to lowercase
        if (field === 'role') {
          value = String(value).toLowerCase().trim();
        }
        
        employee[field] = value;
      }
    }
  }
  
  return employee;
}

/**
 * Generate email from name if not provided
 * Format: (name)@wssc.com or (name).(suffix)@wssc.com if suffix provided
 */
function generateEmailFromName(name, suffix = null) {
  if (!name) return null;
  
  // Convert to lowercase, replace spaces with dots, remove special characters
  let sanitized = String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')  // Replace spaces with dots
    .replace(/[^a-z0-9.]/g, '')  // Remove special characters except dots
    .replace(/\.+/g, '.')  // Replace multiple dots with single dot
    .replace(/^\.|\.$/g, '');  // Remove leading/trailing dots
    
  if (!sanitized) return null;
  
  // Append suffix if provided (for handling duplicates)
  if (suffix !== null && suffix !== undefined && suffix !== '') {
    const cleanSuffix = String(suffix).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanSuffix) {
      sanitized = `${sanitized}.${cleanSuffix}`;
    }
  }
  
  return `${sanitized}@wssc.com`;
}

/**
 * Generate default password if not provided
 */
function generateDefaultPassword() {
  // Default password: staff123
  return 'staff123';
}

/**
 * Make API request
 */
async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}`);
  }

  return result;
}

/**
 * Upload employee to database via REST API
 */
async function uploadEmployee(employee, token) {
  try {
    // Generate email from name if not provided
    if (!employee.email) {
      if (employee.fullName) {
        employee.email = generateEmailFromName(employee.fullName);
        if (employee.email) {
          console.log(`  Generated email from name: ${employee.email}`);
        }
      }
      
      if (!employee.email) {
        throw new Error('Email or fullName is required');
      }
    }
    
    // Use default password if not provided
    if (!employee.password) {
      employee.password = generateDefaultPassword();
      console.log(`  Using default password: staff123`);
    }
    
    if (!employee.role) {
      employee.role = 'staff'; // Default role
    }
    
    // Call REST API to create user
    const result = await apiRequest('/users', 'POST', {
      email: employee.email,
      password: employee.password,
      fullName: employee.fullName || employee.email,
      role: employee.role,
      empNo: employee.empNo || null,
      empCnic: employee.empCnic || null,
      empFname: employee.empFname || null,
      empDeptt: employee.empDeptt || null,
      empJob: employee.empJob || null,
      empGrade: employee.empGrade || null,
      empCell1: employee.empCell1 || null,
      empCell2: employee.empCell2 || null,
      empFlg: employee.empFlg || null,
      empMarried: employee.empMarried || null,
      empGender: employee.empGender || null,
    }, token);
    
    return { success: true, result, error: null };
  } catch (error) {
    return { success: false, result: null, error: error.message };
  }
}

/**
 * Main function to process Excel file and upload employees
 */
async function uploadEmployeesFromExcel(excelFilePath, adminEmail, adminPassword) {
  try {
    console.log('Starting employee upload process...');
    console.log(`Reading Excel file: ${excelFilePath}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    
    // Read Excel file
    const { headers, rows } = readExcelFile(excelFilePath);
    console.log(`Found ${rows.length} rows of data`);
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Map columns
    const columnMap = {};
    for (const field of Object.keys(fieldMapping)) {
      const colIndex = findColumnIndex(headers, field);
      columnMap[field] = colIndex;
      if (colIndex >= 0) {
        console.log(`  Mapped "${field}" to column "${headers[colIndex]}" (index ${colIndex})`);
      }
    }
    
    // Check for required columns (email or fullName/name)
    if (columnMap.email < 0 && columnMap.fullName < 0) {
      throw new Error('Either "email" or "fullName"/"name" column is required in Excel file. Email will be auto-generated from name if not provided.');
    }
    
    // Authenticate as admin
    console.log('\nAuthenticating as admin...');
    let token;
    try {
      const loginResult = await apiRequest('/auth/login', 'POST', {
        email: adminEmail,
        password: adminPassword
      });
      
      if (!loginResult.success || !loginResult.token) {
        throw new Error('Login failed: Invalid response');
      }
      
      token = loginResult.token;
      console.log('✓ Successfully authenticated');
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}. Please check your admin credentials.`);
    }
    
    // Process each row
    console.log('\nProcessing employees...');
    const results = {
      successful: [],
      failed: [],
      skipped: [],
    };
    
    // Track generated emails to handle duplicates
    const usedEmails = new Set();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because we skipped header and 0-indexed
      
      // Skip empty rows
      if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
        console.log(`Row ${rowNum}: Skipped (empty row)`);
        results.skipped.push({ row: rowNum, reason: 'Empty row' });
        continue;
      }
      
      // Convert row to employee object
      const employee = rowToEmployee(row, headers, columnMap);
      
      // Generate email from name if not provided
      if (!employee.email && employee.fullName) {
        let baseEmail = generateEmailFromName(employee.fullName);
        
        // If email already exists, try to make it unique
        if (baseEmail && usedEmails.has(baseEmail)) {
          // First try using employee number if available
          if (employee.empNo) {
            baseEmail = generateEmailFromName(employee.fullName, employee.empNo);
          }
          
          // If still duplicate, use sequential number
          if (usedEmails.has(baseEmail)) {
            let counter = 1;
            let uniqueEmail = baseEmail;
            while (usedEmails.has(uniqueEmail)) {
              uniqueEmail = generateEmailFromName(employee.fullName, counter);
              counter++;
              // Safety check to prevent infinite loop
              if (counter > 1000) {
                uniqueEmail = generateEmailFromName(employee.fullName, Date.now());
                break;
              }
            }
            baseEmail = uniqueEmail;
          }
        }
        
        employee.email = baseEmail;
        if (employee.email) {
          usedEmails.add(employee.email);
          if (baseEmail !== generateEmailFromName(employee.fullName)) {
            console.log(`Row ${rowNum}: Generated unique email: ${employee.email} (duplicate name handled)`);
          } else {
            console.log(`Row ${rowNum}: Generated email from name: ${employee.email}`);
          }
        }
      } else if (employee.email) {
        // Track provided emails too to catch duplicates
        if (usedEmails.has(employee.email)) {
          console.log(`Row ${rowNum}: Warning - Email ${employee.email} already used in this batch`);
        }
        usedEmails.add(employee.email);
      }
      
      if (!employee.email) {
        console.log(`Row ${rowNum}: Skipped (no email or name)`);
        results.skipped.push({ row: rowNum, employee, reason: 'No email or name provided' });
        continue;
      }
      
      console.log(`\nRow ${rowNum}: Processing ${employee.email}...`);
      
      // Upload employee with session token
      let uploadResult = await uploadEmployee(employee, token);
      
      // If email already exists in database, try to make it unique and retry
      if (!uploadResult.success && uploadResult.error && 
          (uploadResult.error.includes('already exists') || 
           uploadResult.error.includes('Account already exists') ||
           uploadResult.error.includes('User already exists'))) {
        
        console.log(`  Email ${employee.email} already exists in database, generating unique email...`);
        
        // Try with employee number if available
        if (employee.empNo) {
          const uniqueEmail = generateEmailFromName(employee.fullName, employee.empNo);
          if (uniqueEmail !== employee.email && !usedEmails.has(uniqueEmail)) {
            employee.email = uniqueEmail;
            usedEmails.add(uniqueEmail);
            console.log(`  Retrying with unique email: ${employee.email}`);
            uploadResult = await uploadEmployee(employee, token);
          }
        }
        
        // If still failed, try with sequential number
        if (!uploadResult.success) {
          let counter = 1;
          let retryEmail = employee.email;
          while (uploadResult.error && 
                 (uploadResult.error.includes('already exists') || 
                  uploadResult.error.includes('Account already exists') ||
                  uploadResult.error.includes('User already exists'))) {
            retryEmail = generateEmailFromName(employee.fullName, counter);
            if (!usedEmails.has(retryEmail)) {
              employee.email = retryEmail;
              usedEmails.add(retryEmail);
              console.log(`  Retrying with unique email: ${employee.email}`);
              uploadResult = await uploadEmployee(employee, token);
            }
            counter++;
            if (counter > 100) break; // Safety limit
          }
        }
      }
      
      if (uploadResult.success) {
        console.log(`  ✓ Successfully created user: ${employee.email}`);
        results.successful.push({
          row: rowNum,
          email: employee.email,
          userId: uploadResult.result?.data?.user_id || uploadResult.result?.user_id,
          password: employee.password,
        });
      } else {
        console.log(`  ✗ Failed: ${uploadResult.error}`);
        results.failed.push({
          row: rowNum,
          email: employee.email,
          error: uploadResult.error,
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('UPLOAD SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed: ${rows.length}`);
    console.log(`✓ Successful: ${results.successful.length}`);
    console.log(`✗ Failed: ${results.failed.length}`);
    console.log(`⊘ Skipped: ${results.skipped.length}`);
    
    if (results.failed.length > 0) {
      console.log('\nFailed employees:');
      results.failed.forEach(item => {
        console.log(`  Row ${item.row} - ${item.email}: ${item.error}`);
      });
    }
    
    if (results.successful.length > 0) {
      console.log('\n✓ Successfully uploaded employees:');
      results.successful.forEach(item => {
        console.log(`  ${item.email} (User ID: ${item.userId})`);
      });
    }
    
    // Save results to file
    const resultsFile = path.join(path.dirname(excelFilePath), 'upload-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results saved to: ${resultsFile}`);
    
    return results;
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node uploadEmployees.js <excel-file-path> <admin-email> <admin-password>');
    console.log('\nExample:');
    console.log('  node uploadEmployees.js employees.xlsx admin@example.com password123');
    console.log('\nEnvironment variables:');
    console.log('  EXPO_PUBLIC_API_URL or API_URL - API base URL (default: http://localhost:3000/api)');
    process.exit(1);
  }
  
  const excelFilePath = path.resolve(args[0]);
  
  if (!fs.existsSync(excelFilePath)) {
    console.error(`Error: File not found: ${excelFilePath}`);
    process.exit(1);
  }
  
  const adminEmail = args[1];
  const adminPassword = args[2];
  
  (async () => {
    try {
      console.log(`Using admin credentials: ${adminEmail}`);
      await uploadEmployeesFromExcel(excelFilePath, adminEmail, adminPassword);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { uploadEmployeesFromExcel };
