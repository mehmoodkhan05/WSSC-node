/**
 * Script to generate MongoDB import files from Excel
 * Generates JSON files and MongoDB shell scripts for MongoDB Compass import
 * 
 * Usage: node scripts/generateMongoDBImport.js <excel-file-path> [output-dir]
 * 
 * Example:
 *   node scripts/generateMongoDBImport.js EMP.xlsx ./mongodb-import
 * 
 * This will create:
 *   - users.json (JSON array for MongoDB Compass import)
 *   - users-insert.mongodb.js (MongoDB shell script)
 *   - users-individual/ (folder with individual JSON files)
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Use bcryptjs from backend node_modules
const backendPath = path.join(__dirname, '..', 'backend');
const bcrypt = require(path.join(backendPath, 'node_modules', 'bcryptjs'));

// Field mapping from Excel to MongoDB User schema
const fieldMapping = {
  'email': ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'EMP_EMAIL', 'emp_email'],
  'password': ['password', 'Password', 'PASSWORD'],
  'role': ['role', 'Role', 'ROLE'],
  'fullName': ['fullName', 'Full Name', 'FULL NAME', 'full_name', 'name', 'Name', 'NAME', 'Employee Name', 'EMPLOYEE NAME', 'EMP_NAME', 'emp_name'],
  'empNo': ['empNo', 'Employee Number', 'EMPLOYEE NUMBER', 'emp_no', 'Emp No', 'Employee No', 'EMP_NO', 'emp_no'],
  'empCnic': ['empCnic', 'CNIC', 'cnic', 'CNIC Number', 'CNIC Number', 'EMP_CNIC', 'emp_cnic'],
  'empFname': ['empFname', 'Father Name', 'FATHER NAME', 'Father\'s Name', 'emp_fname', 'EMP_FNAME', 'emp_fname'],
  'empDeptt': ['empDeptt', 'Department', 'DEPARTMENT', 'dept', 'Dept', 'emp_deptt', 'EMP_DEPTT', 'emp_deptt'],
  'empJob': ['empJob', 'Job', 'JOB', 'Job Title', 'job_title', 'Position', 'emp_job', 'EMP_JOB', 'emp_job'],
  'empGrade': ['empGrade', 'Grade', 'GRADE', 'emp_grade', 'EMP_GRADE', 'emp_grade'],
  'empCell1': ['empCell1', 'Cell 1', 'CELL 1', 'Phone 1', 'Phone', 'Mobile 1', 'emp_cell1', 'EMP_CELL1', 'emp_cell1'],
  'empCell2': ['empCell2', 'Cell 2', 'CELL 2', 'Phone 2', 'Mobile 2', 'emp_cell2', 'EMP_CELL2', 'emp_cell2'],
  'empFlg': ['empFlg', 'Flag', 'FLAG', 'emp_flg', 'EMP_FLG', 'emp_flg'],
  'empMarried': ['empMarried', 'Married', 'MARRIED', 'Marital Status', 'emp_married', 'EMP_MARRIED', 'emp_married'],
  'empGender': ['empGender', 'Gender', 'GENDER', 'Sex', 'emp_gender', 'EMP_GENDER', 'emp_gender'],
};

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

function readExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
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

function generateEmailFromName(name, suffix = null) {
  if (!name) return null;
  
  let sanitized = String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
    
  if (!sanitized) return null;
  
  if (suffix !== null && suffix !== undefined && suffix !== '') {
    const cleanSuffix = String(suffix).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanSuffix) {
      sanitized = `${sanitized}.${cleanSuffix}`;
    }
  }
  
  return `${sanitized}@wssc.com`;
}

function rowToEmployee(row, headers, columnMap) {
  const employee = {};
  
  for (const [field, colIndex] of Object.entries(columnMap)) {
    if (colIndex >= 0 && colIndex < row.length) {
      let value = row[colIndex];
      
      if (value === null || value === undefined || value === '') {
        employee[field] = null;
      } else {
        if (typeof value === 'string') {
          value = value.trim();
        }
        
        const stringFields = [
          'empNo', 'empCnic', 'empCell1', 'empCell2', 'empDeptt', 
          'empJob', 'empGrade', 'empFname', 'empFlg', 'empMarried', 
          'empGender', 'fullName'
        ];
        
        if (stringFields.includes(field)) {
          value = String(value).trim();
          if (value === '' || value === 'NaN' || value === 'null' || value === 'undefined') {
            value = null;
          }
        }
        
        if (field === 'role') {
          value = String(value).toLowerCase().trim();
        }
        
        employee[field] = value;
      }
    }
  }
  
  return employee;
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function processEmployees(excelFilePath, outputDir) {
  console.log('Reading Excel file...');
  const { headers, rows } = readExcelFile(excelFilePath);
  console.log(`Found ${rows.length} rows of data\n`);
  
  // Map columns
  const columnMap = {};
  for (const field of Object.keys(fieldMapping)) {
    const colIndex = findColumnIndex(headers, field);
    columnMap[field] = colIndex;
    if (colIndex >= 0) {
      console.log(`  Mapped "${field}" to column "${headers[colIndex]}"`);
    }
  }
  
  // Check for required columns
  if (columnMap.email < 0 && columnMap.fullName < 0) {
    throw new Error('Either "email" or "fullName"/"name" column is required');
  }
  
  // Process rows
  const employees = [];
  const usedEmails = new Set();
  const defaultPassword = 'staff123';
  
  console.log('\nProcessing employees...');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip empty rows
    if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue;
    }
    
    const employee = rowToEmployee(row, headers, columnMap);
    
    // Generate email if not provided
    if (!employee.email && employee.fullName) {
      let baseEmail = generateEmailFromName(employee.fullName);
      
      if (baseEmail && usedEmails.has(baseEmail)) {
        if (employee.empNo) {
          baseEmail = generateEmailFromName(employee.fullName, employee.empNo);
        }
        
        if (usedEmails.has(baseEmail)) {
          let counter = 1;
          let uniqueEmail = baseEmail;
          while (usedEmails.has(uniqueEmail)) {
            uniqueEmail = generateEmailFromName(employee.fullName, counter);
            counter++;
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
      }
    } else if (employee.email) {
      usedEmails.add(employee.email);
    }
    
    if (!employee.email) {
      console.log(`  Row ${i + 2}: Skipped (no email or name)`);
      continue;
    }
    
    // Set defaults
    if (!employee.password) {
      employee.password = defaultPassword;
    }
    if (!employee.role) {
      employee.role = 'staff';
    }
    
    // Hash password
    employee.password = await hashPassword(employee.password);
    
    // Create MongoDB document
    const mongoDoc = {
      email: employee.email.toLowerCase().trim(),
      username: employee.email.toLowerCase().trim(),
      password: employee.password,
      fullName: employee.fullName || employee.email.split('@')[0],
      role: employee.role.toLowerCase(),
      department: employee.empDeptt || null,
      departments: [],
      managerId: null,
      generalManagerId: null,
      empFname: employee.empFname || null,
      empDeptt: employee.empDeptt || null,
      empJob: employee.empJob || null,
      empGrade: employee.empGrade || null,
      empCell1: employee.empCell1 || null,
      empCell2: employee.empCell2 || null,
      empFlg: employee.empFlg || null,
      empMarried: employee.empMarried || null,
      empGender: employee.empGender || null,
      empNo: employee.empNo || null,
      empCnic: employee.empCnic || null,
      profilePhotoUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    employees.push(mongoDoc);
    
    if ((i + 1) % 10 === 0) {
      console.log(`  Processed ${i + 1}/${rows.length} rows...`);
    }
  }
  
  console.log(`\n✅ Processed ${employees.length} employees\n`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate JSON array file (for MongoDB Compass import)
  const jsonArrayPath = path.join(outputDir, 'users.json');
  fs.writeFileSync(jsonArrayPath, JSON.stringify(employees, null, 2));
  console.log(`✅ Created: ${jsonArrayPath}`);
  console.log(`   This file can be imported directly into MongoDB Compass`);
  console.log(`   Instructions: MongoDB Compass > Collection > Add Data > Import File > users.json\n`);
  
  // Generate MongoDB shell script
  const mongoScriptPath = path.join(outputDir, 'users-insert.mongodb.js');
  let mongoScript = `// MongoDB Shell Script to insert users
// Run this in MongoDB Compass's MongoDB Shell or mongosh
// Usage: mongosh <connection-string> < users-insert.mongodb.js

use('wssc-db'); // Change to your database name

// Clear existing users collection (optional - comment out if you want to keep existing data)
// db.users.deleteMany({});

// Insert users
const users = ${JSON.stringify(employees, null, 2)};

try {
  const result = db.users.insertMany(users, { ordered: false });
  print(\`✅ Successfully inserted \${result.insertedCount} users\`);
  print(\`   Inserted IDs: \${result.insertedIds.length}\`);
} catch (error) {
  if (error.writeErrors) {
    print(\`⚠️  Inserted \${error.insertedCount} users, but \${error.writeErrors.length} failed:\`);
    error.writeErrors.forEach((err, index) => {
      print(\`   Error \${index + 1}: \${err.errmsg}\`);
    });
  } else {
    print(\`❌ Error: \${error.message}\`);
  }
}

print(\`\\nTotal users in collection: \${db.users.countDocuments()}\`);
`;
  
  fs.writeFileSync(mongoScriptPath, mongoScript);
  console.log(`✅ Created: ${mongoScriptPath}`);
  console.log(`   This script can be run in MongoDB Compass's MongoDB Shell\n`);
  
  // Generate individual JSON files (optional)
  const individualDir = path.join(outputDir, 'users-individual');
  if (!fs.existsSync(individualDir)) {
    fs.mkdirSync(individualDir, { recursive: true });
  }
  
  employees.forEach((emp, index) => {
    const fileName = `${String(index + 1).padStart(4, '0')}-${emp.email.replace('@', '_at_')}.json`;
    const filePath = path.join(individualDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(emp, null, 2));
  });
  
  console.log(`✅ Created ${employees.length} individual JSON files in: ${individualDir}/`);
  console.log(`   These can be imported one by one if needed\n`);
  
  // Generate summary
  const summary = {
    totalRows: rows.length,
    processed: employees.length,
    skipped: rows.length - employees.length,
    generated: new Date().toISOString(),
    files: {
      jsonArray: jsonArrayPath,
      mongoScript: mongoScriptPath,
      individualFiles: individualDir
    },
    instructions: {
      mongoDBCompass: [
        '1. Open MongoDB Compass',
        '2. Connect to your database (wssc-db)',
        '3. Select the "users" collection',
        '4. Click "Add Data" > "Import File"',
        '5. Select users.json',
        '6. Click "Import"'
      ],
      mongoShell: [
        '1. Open MongoDB Compass',
        '2. Click "MongoSH" tab',
        '3. Copy and paste the contents of users-insert.mongodb.js',
        '4. Or run: mongosh <connection-string> < users-insert.mongodb.js'
      ]
    }
  };
  
  const summaryPath = path.join(outputDir, 'import-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Created summary: ${summaryPath}\n`);
  
  console.log('='.repeat(60));
  console.log('IMPORT INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log('\n📋 Method 1: MongoDB Compass Import (Easiest)');
  console.log('   1. Open MongoDB Compass');
  console.log('   2. Connect to: mongodb://localhost:27017/wssc-db');
  console.log('   3. Select "users" collection');
  console.log('   4. Click "Add Data" > "Import File"');
  console.log('   5. Select: ' + jsonArrayPath);
  console.log('   6. Click "Import"');
  
  console.log('\n📋 Method 2: MongoDB Shell Script');
  console.log('   1. Open MongoDB Compass');
  console.log('   2. Click "MongoSH" tab');
  console.log('   3. Copy contents of: ' + mongoScriptPath);
  console.log('   4. Paste and run in MongoDB Shell');
  
  console.log('\n✅ All files generated successfully!');
  console.log(`   Output directory: ${outputDir}\n`);
  
  return summary;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node scripts/generateMongoDBImport.js <excel-file-path> [output-dir]');
    console.log('\nExample:');
    console.log('  node scripts/generateMongoDBImport.js EMP.xlsx ./mongodb-import');
    console.log('\nThis will generate:');
    console.log('  - users.json (for MongoDB Compass import)');
    console.log('  - users-insert.mongodb.js (MongoDB shell script)');
    console.log('  - users-individual/ (individual JSON files)');
    process.exit(1);
  }
  
  const excelFilePath = path.resolve(args[0]);
  const outputDir = args[1] || path.join(path.dirname(excelFilePath), 'mongodb-import');
  
  if (!fs.existsSync(excelFilePath)) {
    console.error(`❌ Error: File not found: ${excelFilePath}`);
    process.exit(1);
  }
  
  (async () => {
    try {
      await processEmployees(excelFilePath, outputDir);
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  })();
}

module.exports = { processEmployees };

