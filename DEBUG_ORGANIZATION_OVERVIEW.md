# Debug Guide: Organization Overview Not Showing Sub Engineers

## Issue
The "Organization Overview" section is not displaying Sub Engineer count in the "By Role" list.

## Root Cause Analysis

The Organization Overview gets its data from the backend API endpoint `/api/dashboard/stats-by-role-dept`. This endpoint should automatically include all roles, including `sub_engineer`.

## Debugging Steps

### Step 1: Check if you have Sub Engineers in the database

Run this test script to verify:

```bash
node test-organization-overview.js
```

This will show:
- Total active users
- Count by each role
- List of sub_engineer users (if any)
- What the API would return

**Expected Output:**
```
📈 Users by Role:
─────────────────────────────
  staff               : 150
  supervisor          : 12
  sub_engineer        : 8    ← Should see this
  manager             : 5
```

**If you see "No users with role 'sub_engineer' found":**
- You need to add users with the `sub_engineer` role to your database
- Or update existing users to have `role: 'sub_engineer'`

### Step 2: Check the API Response

1. **Open your browser's Developer Tools** (F12)
2. **Go to the Network tab**
3. **Refresh the dashboard**
4. **Look for the request to** `/api/dashboard/stats-by-role-dept`
5. **Check the response**

You should see something like:
```json
{
  "success": true,
  "data": {
    "byRole": [
      { "role": "staff", "count": 150 },
      { "role": "supervisor", "count": 12 },
      { "role": "sub_engineer", "count": 8 },  ← Should be here
      { "role": "manager", "count": 5 }
    ],
    "byDepartment": [...],
    "byRoleAndDepartment": [...],
    "totalUsers": 175
  }
}
```

**If `sub_engineer` is missing from the API response:**
- Check if you have any users with `role: 'sub_engineer'` in the database
- The API only returns roles that exist in the database

### Step 3: Check Console Logs

The app already has debugging logs built in. Check your console for:

```
=== Organization Overview - Data Received ===
Stats received: {...}
By Role: [...]  ← Check if sub_engineer is in this array
```

### Step 4: Verify Role Enum in Database

Make sure your MongoDB User model accepts `sub_engineer` as a valid role:

```javascript
// In backend/models/User.js (line 30)
enum: ['staff', 'supervisor', 'sub_engineer', 'manager', 'general_manager', 'ceo', 'super_admin']
```

✅ This is already correct in your code.

## Solution: Add Sub Engineer Users to Database

If you don't have any Sub Engineer users, you need to add them:

### Option 1: Update Existing Users via MongoDB Shell

```javascript
// Connect to MongoDB
use wssc

// Update a user to be a sub_engineer
db.users.updateOne(
  { email: "john.doe@example.com" },
  { $set: { role: "sub_engineer" } }
)

// Or update multiple users
db.users.updateMany(
  { email: { $in: ["user1@example.com", "user2@example.com"] } },
  { $set: { role: "sub_engineer" } }
)

// Verify the update
db.users.find({ role: "sub_engineer" }).pretty()
```

### Option 2: Create New Sub Engineer Users via API

Use your user creation endpoint or admin panel to create users with `role: 'sub_engineer'`.

### Option 3: Update via Settings Screen

If your app has a user management screen:
1. Go to Settings → Users
2. Edit a user
3. Change their role to "Sub Engineer"
4. Save

## Verification

After adding Sub Engineer users:

1. **Refresh the dashboard**
2. **Check the Organization Overview section**
3. **You should now see:**

```
By Role:
- Super Admin: 1
- CEO: 1
- General Manager: 2
- Manager: 5
- Sub Engineer: 8        ← Should appear here now
- Supervisor: 12
- Staff: 150
```

## Additional Notes

### Why it might not show:

1. **No users with that role** - Most common reason
2. **Users are inactive** - API only counts `isActive: true` users
3. **Role field is null/undefined** - Check database for null values
4. **Role field has typo** - Check for "sub engineer" (with space) vs "sub_engineer" (with underscore)
5. **Case sensitivity** - The API normalizes to lowercase, but check database values

### Frontend Changes Made:

✅ Added sorting to display roles in hierarchy order
✅ Sub Engineer will appear between Manager and Supervisor
✅ Uses `ROLE_OPTIONS` to get proper label "Sub Engineer"

### Backend Changes Made:

✅ API endpoint `/api/dashboard/stats-by-role-dept` counts ALL roles dynamically
✅ No filtering that would exclude sub_engineer
✅ User model enum includes 'sub_engineer'

## Quick Test Query

Run this in MongoDB shell to check:

```javascript
db.users.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: "$role", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

This will show you exactly what the API sees.

