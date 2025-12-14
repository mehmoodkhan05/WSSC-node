const mongoose = require('mongoose');
const Department = require('../models/Department');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const departments = [
  { deptId: 11, label: 'Administration', description: 'ADMINISTRATION' },
  { deptId: 12, label: 'Water Supply', description: 'WATER SUPPLY' },
  { deptId: 13, label: 'Sanitation', description: 'SANITATION' },
  { deptId: 14, label: 'Commercial', description: 'COMMERCIAL' },
];

async function seedDepartments() {
  try {
    // If already connected, use existing connection
    if (mongoose.connection.readyState === 1) {
      console.log('Using existing MongoDB connection for seeding...');
    } else {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wssc-db';
      console.log('Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB');
    }

    for (const dept of departments) {
      const existing = await Department.findOne({ deptId: dept.deptId });
      
      if (existing) {
        // Update if exists but inactive
        if (!existing.isActive) {
          existing.isActive = true;
          existing.label = dept.label;
          existing.description = dept.description;
          await existing.save();
          console.log(`✅ Updated department: ${dept.label} (ID: ${dept.deptId})`);
        } else {
          console.log(`⏭️  Department already exists: ${dept.label} (ID: ${dept.deptId})`);
        }
      } else {
        // Create new department
        await Department.create({
          ...dept,
          isActive: true
        });
        console.log(`✅ Created department: ${dept.label} (ID: ${dept.deptId})`);
      }
    }

    console.log('✅ Department seeding completed!');
    
    // Only exit if called directly (not when imported)
    if (require.main === module) {
      await mongoose.connection.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error seeding departments:', error);
    if (require.main === module) {
      process.exit(1);
    } else {
      // If imported, don't exit - just log the error
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedDepartments();
}

module.exports = { seedDepartments, departments };

