/**
 * Script to generate MongoDB import files with UPSERT support (handles duplicates)
 * This version will UPDATE existing users or INSERT new ones
 * 
 * Usage: node scripts/generateMongoDBImportUpsert.js <excel-file-path> [output-dir]
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
  
  // Generate MongoDB shell script with UPSERT
  const mongoScriptPath = path.join(outputDir, 'users-insert-upsert.mongodb.js');
  let mongoScript = `// MongoDB Shell Script to insert/update users (handles duplicates)
// Run this in MongoDB Compass's MongoDB Shell or mongosh
// This script will UPDATE existing users or INSERT new ones (UPSERT)

use('wssc-db'); // Change to your database name

const users = ${JSON.stringify(employees, null, 2)};

let inserted = 0;
let updated = 0;
let errors = [];

print(\`Processing \${users.length} users...\\n\`);

users.forEach((user, index) => {
  try {
    // Use upsert: update if exists (by email), insert if not
    const result = db.users.updateOne(
      { email: user.email },
      { 
        $set: {
          username: user.username,
          password: user.password,
          fullName: user.fullName,
          role: user.role,
          department: user.department,
          departments: user.departments,
          managerId: user.managerId,
          generalManagerId: user.generalManagerId,
          empFname: user.empFname,
          empDeptt: user.empDeptt,
          empJob: user.empJob,
          empGrade: user.empGrade,
          empCell1: user.empCell1,
          empCell2: user.empCell2,
          empFlg: user.empFlg,
          empMarried: user.empMarried,
          empGender: user.empGender,
          empNo: user.empNo,
          empCnic: user.empCnic,
          profilePhotoUrl: user.profilePhotoUrl,
          isActive: user.isActive,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) {
      inserted++;
    } else if (result.modifiedCount > 0) {
      updated++;
    }
    
    if ((index + 1) % 100 === 0) {
      print(\`Processed \${index + 1}/\${users.length} users... (Inserted: \${inserted}, Updated: \${updated})\`);
    }
  } catch (error) {
    errors.push({
      email: user.email,
      error: error.message,
      index: index
    });
    print(\`Error processing \${user.email}: \${error.message}\`);
  }
});

print(\`\\n✅ Import completed!\`);
print(\`   Inserted: \${inserted} new users\`);
print(\`   Updated: \${updated} existing users\`);
print(\`   Errors: \${errors.length}\`);
print(\`   Total processed: \${inserted + updated}\`);

if (errors.length > 0) {
  print(\`\\n⚠️  Errors encountered:\`);
  errors.forEach(err => {
    print(\`   \${err.email}: \${err.error}\`);
  });
}

print(\`\\nTotal users in collection: \${db.users.countDocuments()}\`);
`;
  
  fs.writeFileSync(mongoScriptPath, mongoScript);
  console.log(`✅ Created: ${mongoScriptPath}`);
  console.log(`   This script uses UPSERT to handle duplicates\n`);
  
  // Generate summary
  const summary = {
    totalRows: rows.length,
    processed: employees.length,
    skipped: rows.length - employees.length,
    generated: new Date().toISOString(),
    files: {
      mongoScript: mongoScriptPath
    },
    instructions: {
      mongoShell: [
        '1. Open MongoDB Compass',
        '2. Click "MongoSH" tab',
        '3. Copy and paste the contents of users-insert-upsert.mongodb.js',
        '4. This will UPDATE existing users or INSERT new ones',
        '5. No duplicate errors will occur'
      ]
    }
  };
  
  const summaryPath = path.join(outputDir, 'import-summary-upsert.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Created summary: ${summaryPath}\n`);
  
  console.log('='.repeat(60));
  console.log('IMPORT INSTRUCTIONS (UPSERT VERSION)');
  console.log('='.repeat(60));
  console.log('\n📋 This script handles duplicates automatically:');
  console.log('   - If user exists: UPDATES the user data');
  console.log('   - If user is new: INSERTS the user');
  console.log('   - No duplicate errors will occur');
  console.log('\n📋 Steps:');
  console.log('   1. Open MongoDB Compass');
  console.log('   2. Click "MongoSH" tab');
  console.log('   3. Copy contents of: ' + mongoScriptPath);
  console.log('   4. Paste and run in MongoDB Shell');
  console.log('\n✅ Script generated successfully!');
  console.log(`   Output: ${mongoScriptPath}\n`);
  
  return summary;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node scripts/generateMongoDBImportUpsert.js <excel-file-path> [output-dir]');
    console.log('\nExample:');
    console.log('  node scripts/generateMongoDBImportUpsert.js EMP.xlsx ./mongodb-import');
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

