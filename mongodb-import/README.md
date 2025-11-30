# MongoDB Compass Import Guide

This directory contains files generated from your Excel file (EMP.xlsx) for importing into MongoDB.

## Generated Files

- **users.json** - JSON array file ready for MongoDB Compass import (914 users)
- **users-insert.mongodb.js** - MongoDB shell script for batch insert
- **users-individual/** - Individual JSON files (one per user)
- **import-summary.json** - Summary of the import process

## ⚠️ IMPORTANT: Handling Duplicates

If you're getting **"E11000 duplicate key error"**, it means some users already exist in the database.

**Solution:** Use the **UPSERT script** (`users-insert-upsert.mongodb.js`) which will:
- ✅ **UPDATE** existing users (by email)
- ✅ **INSERT** new users
- ✅ **No duplicate errors**

## Import Methods

### Method 1: MongoDB Shell with UPSERT (Recommended for Duplicates)

1. **Open MongoDB Compass**
   - Connect to your database: `mongodb://localhost:27017/wssc-db`

2. **Open MongoDB Shell**
   - Click the **"MongoSH"** tab (or **"mongosh"** button)

3. **Run the UPSERT Script**
   - Open file: `users-insert-upsert.mongodb.js`
   - Copy the entire contents
   - Paste into MongoDB Shell
   - Press Enter to execute

   This will update existing users and insert new ones without errors.

### Method 2: MongoDB Compass GUI Import (Easiest - but may have duplicate errors)

1. **Open MongoDB Compass**
   - Connect to your database: `mongodb://localhost:27017/wssc-db`
   - Or use your connection string from `.env` file

2. **Navigate to the Collection**
   - Select database: `wssc-db`
   - Select collection: `users`
   - If collection doesn't exist, it will be created automatically

3. **Import the File**
   - Click **"Add Data"** button (top right)
   - Select **"Import File"**
   - Choose file: `users.json`
   - File type: **JSON** (Array of documents)
   - Click **"Import"**

4. **Verify**
   - Check that 914 documents were imported
   - Browse the collection to verify data

### Method 3: MongoDB Shell Script (Original - may have duplicate errors)

1. **Open MongoDB Compass**
   - Connect to your database

2. **Open MongoDB Shell**
   - Click the **"MongoSH"** tab (or **"mongosh"** button)
   - This opens the MongoDB shell

3. **Run the Script**
   - Copy the entire contents of `users-insert.mongodb.js`
   - Paste into the MongoDB shell
   - Press Enter to execute

   Or run from command line:
   ```bash
   mongosh mongodb://localhost:27017/wssc-db < users-insert.mongodb.js
   ```

### Method 4: Individual Files (If needed)

If you need to import users one by one or in smaller batches:
- Use files from `users-individual/` folder
- Import them individually through MongoDB Compass

## Important Notes

⚠️ **Before Importing:**
- The script hashes all passwords with bcrypt (default password: `staff123`)
- All users are set as `isActive: true`
- Default role is `staff` (unless specified in Excel)
- Email addresses are auto-generated from names if not provided

⚠️ **Duplicate Handling:**
- If users already exist (same email), MongoDB will throw an error
- The shell script uses `ordered: false` to continue inserting even if some fail
- Check the output for any errors

⚠️ **Password Reset:**
- Default password for all imported users: `staff123`
- Users should change their password after first login
- Or use the reset password script: `node scripts/resetPasswordDirect.js <email> <newPassword>`

## Data Structure

Each user document contains:
- `email` - User email (required, unique)
- `username` - Same as email
- `password` - Hashed password (bcrypt)
- `fullName` - Employee full name
- `role` - User role (staff, supervisor, manager, etc.)
- `department` - Department name
- `empNo`, `empCnic`, `empFname`, `empDeptt`, `empJob`, `empGrade` - Employee details
- `empCell1`, `empCell2` - Contact numbers
- `empFlg`, `empMarried`, `empGender` - Additional info
- `isActive` - Account status (true)
- `createdAt`, `updatedAt` - Timestamps

## Troubleshooting

**Error: "E11000 duplicate key error"**
- Some users already exist in the database
- The script will continue inserting others
- Check which emails already exist

**Error: "Collection doesn't exist"**
- MongoDB will create it automatically on first insert
- Or create manually: `db.createCollection("users")`

**Import is slow**
- Large imports (914 users) may take a few minutes
- Be patient, MongoDB Compass will show progress

**Need to clear existing data first?**
- In MongoDB Shell, run: `db.users.deleteMany({})`
- Or use MongoDB Compass: Select all documents > Delete

## After Import

1. **Verify the import:**
   ```javascript
   // In MongoDB Shell
   db.users.countDocuments()  // Should return 914
   db.users.findOne()         // Check a sample document
   ```

2. **Test login:**
   - Use any imported email
   - Default password: `staff123`
   - Or reset password using the script

3. **Update roles if needed:**
   - Some users may need different roles (supervisor, manager, etc.)
   - Update in MongoDB Compass or use the API

## Support

If you encounter issues:
1. Check MongoDB Compass connection
2. Verify database name is `wssc-db`
3. Check collection name is `users`
4. Review error messages in MongoDB Compass
5. Check the import-summary.json for details

