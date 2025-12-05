# Database Migration Guide

## Overview
This guide helps you migrate existing data to support the new features.

---

## 🔄 Required Migrations

### 1. Add Shift Fields to Existing Users

All existing users need default shift values. The system will use these defaults:
- `shiftDays`: 6 (6-day work week)
- `shiftTime`: 'day'
- `shiftStartTime`: '09:00'
- `shiftEndTime`: '17:00'

**MongoDB Migration Script:**

```javascript
// Connect to your MongoDB database
use wssc-db

// Update all existing users with default shift values
db.users.updateMany(
  { shiftDays: { $exists: false } },
  {
    $set: {
      shiftDays: 6,
      shiftTime: 'day',
      shiftStartTime: '09:00',
      shiftEndTime: '17:00'
    }
  }
)

// Verify the update
db.users.find({ shiftDays: { $exists: true } }).count()
```

### 2. Create Holidays Collection

The holidays collection will be created automatically when you add the first holiday through the UI.

**Optional: Pre-populate with common holidays:**

```javascript
// Example: Add common Pakistani holidays for 2024
db.holidays.insertMany([
  {
    date: '2024-03-23',
    name: 'Pakistan Day',
    description: 'National holiday commemorating the Pakistan Resolution',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    date: '2024-04-10',
    name: 'Eid-ul-Fitr',
    description: 'Islamic holiday marking the end of Ramadan',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    date: '2024-04-11',
    name: 'Eid-ul-Fitr (2nd day)',
    description: 'Second day of Eid celebrations',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    date: '2024-06-17',
    name: 'Eid-ul-Adha',
    description: 'Islamic holiday of sacrifice',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    date: '2024-08-14',
    name: 'Independence Day',
    description: 'Pakistan Independence Day',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    date: '2024-12-25',
    name: 'Quaid-e-Azam Day',
    description: 'Birthday of Muhammad Ali Jinnah',
    createdAt: new Date(),
    updatedAt: new Date()
  }
])
```

---

## 🔍 Verification Steps

### 1. Verify User Schema Updates

```javascript
// Check a sample user has the new fields
db.users.findOne({}, { 
  shiftDays: 1, 
  shiftTime: 1, 
  shiftStartTime: 1, 
  shiftEndTime: 1,
  role: 1 
})

// Expected output:
// {
//   _id: ObjectId("..."),
//   shiftDays: 6,
//   shiftTime: "day",
//   shiftStartTime: "09:00",
//   shiftEndTime: "17:00",
//   role: "staff" // or other role
// }
```

### 2. Verify Holidays Collection

```javascript
// Check holidays collection exists
db.holidays.find().pretty()

// Check holiday indexes
db.holidays.getIndexes()
// Should show index on 'date' field
```

### 3. Verify Role Enum

```javascript
// Check if any users have the new sub_engineer role
db.users.find({ role: 'sub_engineer' }).count()

// List all unique roles in the system
db.users.distinct('role')
// Should include: staff, supervisor, sub_engineer, manager, general_manager, ceo, super_admin
```

---

## 🚨 Rollback Plan

If you need to rollback the changes:

### Remove Shift Fields

```javascript
db.users.updateMany(
  {},
  {
    $unset: {
      shiftDays: "",
      shiftTime: "",
      shiftStartTime: "",
      shiftEndTime: ""
    }
  }
)
```

### Remove Holidays Collection

```javascript
db.holidays.drop()
```

### Revert Sub Engineer Roles

```javascript
// Change all sub_engineer roles back to supervisor
db.users.updateMany(
  { role: 'sub_engineer' },
  { $set: { role: 'supervisor' } }
)
```

---

## 📊 Data Integrity Checks

### Check for Invalid Shift Days

```javascript
// Find users with invalid shiftDays values
db.users.find({
  shiftDays: { $nin: [5, 6] }
})

// Fix if any found
db.users.updateMany(
  { shiftDays: { $nin: [5, 6] } },
  { $set: { shiftDays: 6 } }
)
```

### Check for Invalid Shift Times

```javascript
// Find users with invalid shiftTime values
db.users.find({
  shiftTime: { $nin: ['day', 'night', 'custom'] }
})

// Fix if any found
db.users.updateMany(
  { shiftTime: { $nin: ['day', 'night', 'custom'] } },
  { $set: { shiftTime: 'day' } }
)
```

### Validate Holiday Dates

```javascript
// Find holidays with invalid date format
db.holidays.find({
  date: { $not: /^\d{4}-\d{2}-\d{2}$/ }
})

// Delete invalid holidays (if any)
db.holidays.deleteMany({
  date: { $not: /^\d{4}-\d{2}-\d{2}$/ }
})
```

---

## 🔧 Performance Optimization

### Create Indexes

```javascript
// Index on holiday dates for faster lookups
db.holidays.createIndex({ date: 1 }, { unique: true })

// Index on user shift fields for reporting
db.users.createIndex({ shiftDays: 1, shiftTime: 1 })

// Compound index for attendance queries with dates
db.attendances.createIndex({ staffId: 1, attendanceDate: 1 })
```

---

## 📝 Post-Migration Tasks

1. **Update User Shifts:**
   - Review each user's shift configuration
   - Update based on their actual work schedule
   - Ensure night shift workers have correct times

2. **Add Holidays:**
   - Add all company holidays for the current year
   - Add religious holidays
   - Add national holidays
   - Add company-specific off days

3. **Assign Sub Engineer Roles:**
   - Identify field engineers who need override permissions
   - Update their roles from 'supervisor' to 'sub_engineer'

4. **Test Backdated Attendance:**
   - Have managers test marking attendance for previous day
   - Verify validations work correctly

5. **Verify Automatic Overtime:**
   - Test clock-in on a Sunday (6-day shift)
   - Test clock-in on a company holiday
   - Verify overtime flag is set automatically

---

## 🐛 Troubleshooting

### Issue: Users don't have shift fields

**Solution:**
```javascript
// Re-run the migration script
db.users.updateMany(
  { shiftDays: { $exists: false } },
  {
    $set: {
      shiftDays: 6,
      shiftTime: 'day',
      shiftStartTime: '09:00',
      shiftEndTime: '17:00'
    }
  }
)
```

### Issue: Holidays not showing in UI

**Check:**
1. Verify holidays collection exists: `db.holidays.find()`
2. Check API endpoint: `GET http://localhost:3000/api/holidays`
3. Verify user has CEO/SuperAdmin role
4. Check browser console for errors

### Issue: Automatic overtime not working

**Check:**
1. Verify user has `shiftDays` field set
2. Verify holiday exists in database for that date
3. Check backend logs for errors
4. Verify attendance route is using updated code

---

## 📞 Support

If you encounter issues during migration:
1. Check backend logs: `npm run dev` (in backend folder)
2. Check MongoDB connection: `http://localhost:3000/api/db-info`
3. Verify all collections: `db.getCollectionNames()`
4. Check indexes: `db.users.getIndexes()`, `db.holidays.getIndexes()`

---

**Migration Version:** 2.0.0  
**Last Updated:** December 5, 2024  
**Status:** ✅ Ready for Production

