# MongoDB Backend Changes Summary

## Changes Made for Local MongoDB Backend

Since you're using **local MongoDB** (not Parse Server), the following changes were made to the **backend routes** only. The `cloud/main.js` file is for Parse Server and can be **ignored**.

---

## 1. Leadership Attendance List - Now Shows Roles Above Staff

### Changes:

#### **backend/routes/attendance.js** (NEW ENDPOINT)
Added a new `/api/attendance/leadership` endpoint that:
- Only allows CEO and Super Admin access
- Fetches all users with leadership roles: `supervisor`, `sub_engineer`, `manager`, `general_manager`
- Returns today's attendance for these roles
- Displays role name with each person
- Sorts by role hierarchy (General Manager → Manager → Sub Engineer/Supervisor) then by name

```javascript
// @route   GET /api/attendance/leadership
// @desc    Get today's attendance for leadership roles (above staff)
// @access  Private - CEO and Super Admin only
router.get('/leadership', protect, async (req, res) => {
  // ... implementation includes sub_engineer role
  const leadershipRoles = ['supervisor', 'sub_engineer', 'manager', 'general_manager'];
  // ... sorts with roleOrder = { general_manager: 1, manager: 2, sub_engineer: 3, supervisor: 3 }
});
```

#### **src/lib/attendance.js**
Updated to call the new endpoint:
```javascript
export async function fetchLeadershipAttendance() {
  const response = await apiClient.get('/attendance/leadership');
  return response.data || [];
}
```

#### **src/components/dashboard/AdminDashboard.js**
Already displays role names using `getRoleLabel(leader.role)` on line 471, which shows:
- "General Manager"
- "Manager"
- "Sub Engineer"
- "Supervisor"

---

## 2. Dashboard Status Card for Sub Engineers

### Changes:

#### **backend/routes/dashboard.js**
Updated `/api/dashboard/stats` endpoint to include sub_engineer count:

```javascript
router.get('/stats', protect, async (req, res) => {
  const [totalStaffCount, supervisorCount, subEngineerCount, pendingLeaveRequestsCount] = await Promise.all([
    User.countDocuments({ role: 'staff', isActive: true }),
    User.countDocuments({ role: 'supervisor', isActive: true }),
    User.countDocuments({ role: 'sub_engineer', isActive: true }), // NEW
    LeaveRequest.countDocuments({ status: 'pending' })
  ]);

  return {
    totalStaff: totalStaffCount || 0,
    supervisorCount: supervisorCount || 0,
    subEngineerCount: subEngineerCount || 0, // NEW
    pendingLeaveRequestsCount: pendingLeaveRequestsCount || 0
  };
});
```

#### **src/components/dashboard/AdminDashboard.js**
Added "Sub Engineers" status card in the stats grid:

```javascript
<StatsCard
  title="Sub Engineers"
  value={stats.subEngineerCount || 0}
  icon={Feather}
  iconName="users"
  color="#17a2b8"
/>
```

#### **src/screens/DashboardScreen.js**
Updated state to include `subEngineerCount`:
- Added to initial state declaration
- Added to stats extraction from API response
- Added to setStats call

---

## 3. Organization Overview - Sub Engineers Included

### How It Works:

The **Organization Overview** section automatically includes Sub Engineers because the `/api/dashboard/stats-by-role-dept` endpoint (in `backend/routes/dashboard.js`) dynamically counts **ALL user roles** in the database:

```javascript
filteredUsers.forEach(u => {
  const role = normalizeRole(u.role) || 'unknown';
  statsByRole[role] = (statsByRole[role] || 0) + 1;
  // ... counts all roles including sub_engineer
});
```

The frontend (`AdminDashboard.js` lines 331-345) displays all roles returned by the API, using `ROLE_OPTIONS` to format the labels properly. Since `sub_engineer` is defined in `src/lib/roles.js`, it will automatically show as "Sub Engineer" in the Organization Overview.

---

## Files Changed (MongoDB Backend Only)

1. ✅ `backend/routes/dashboard.js` - Added subEngineerCount to stats
2. ✅ `backend/routes/attendance.js` - Added /leadership endpoint with sub_engineer role
3. ✅ `src/lib/attendance.js` - Updated to call /attendance/leadership
4. ✅ `src/components/dashboard/AdminDashboard.js` - Added Sub Engineers status card
5. ✅ `src/screens/DashboardScreen.js` - Added subEngineerCount to state

## Files to IGNORE (Parse Server Only)

- ❌ `cloud/main.js` - This is for Parse Server, not MongoDB backend

---

## Testing

To verify the changes work:

1. **Leadership Attendance**: 
   - Login as CEO or Super Admin
   - View the dashboard
   - Check the "Leadership Attendance" card shows supervisors, sub engineers, managers, and general managers with their role labels

2. **Sub Engineers Count**:
   - Check the status cards section shows "Sub Engineers" card with count
   
3. **Organization Overview**:
   - Scroll to "Organization Overview" section (CEO/Super Admin only)
   - Check "By Role" section includes "Sub Engineer" with count

---

## Database Requirements

Make sure your MongoDB `users` collection has the `role` field set to `'sub_engineer'` for sub engineer users (as defined in `backend/models/User.js`).

