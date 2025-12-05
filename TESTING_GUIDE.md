# Testing Guide - New Features

## 🎯 Quick Start Testing

This guide will help you test all the new features that have been implemented.

---

## Prerequisites

1. **Start the Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the Frontend:**
   ```bash
   cd ..
   npm start
   ```

3. **Login as CEO/SuperAdmin** to test admin features

---

## Test Scenarios

### ✅ Test 1: User Shift Management

**Objective:** Verify shift configuration works for new and existing users

**Steps:**
1. Login as CEO/SuperAdmin
2. Navigate to **Users** screen
3. Click **Create New User**
4. Fill in required fields (Email, Password, Full Name)
5. Scroll to **Shift Management** section
6. Test **Shift Days:**
   - Select "5 Days (Sat & Sun Off)"
   - Verify it saves correctly
7. Test **Shift Time:**
   - Select "Day Shift (09:00 - 17:00)"
   - Verify start time auto-populates to 09:00
   - Verify end time auto-populates to 17:00
8. Change to "Night Shift (21:00 - 05:00)"
   - Verify start time changes to 21:00
   - Verify end time changes to 05:00
9. Manually edit start/end times
10. Click **Create User**
11. Verify user is created successfully

**Expected Results:**
- ✅ Shift fields appear in create form
- ✅ Auto-population works for Day/Night shift
- ✅ Manual time override works
- ✅ User is created with shift configuration

---

### ✅ Test 2: Company Holiday Management

**Objective:** Verify holiday management system works correctly

**Steps:**
1. Login as CEO/SuperAdmin
2. Navigate to **Settings** screen
3. Scroll to **Company Holidays** section
4. Test **Add Holiday:**
   - Enter Date: `2024-12-25`
   - Enter Name: `Christmas Day`
   - Enter Description: `Public holiday`
   - Click **Add Holiday**
5. Verify holiday appears in the list
6. Test **Invalid Date Format:**
   - Enter Date: `25-12-2024` (wrong format)
   - Try to add
   - Verify error message appears
7. Test **Duplicate Holiday:**
   - Try to add same date again
   - Verify error message appears
8. Test **Delete Holiday:**
   - Click Delete on a holiday
   - Confirm deletion
   - Verify holiday is removed

**Expected Results:**
- ✅ Holiday is added successfully
- ✅ Holiday appears in list with date, name, description
- ✅ Invalid date format is rejected
- ✅ Duplicate dates are rejected
- ✅ Delete works correctly

---

### ✅ Test 3: Automatic Overtime on Weekly Off Days

**Objective:** Verify automatic overtime for weekly off days

**Test 3A: 6-Day Shift (Sunday Off)**

**Steps:**
1. Create a user with **6-day shift**
2. Wait for or set system date to **Sunday**
3. Clock in for this user
4. Check the attendance record
5. Verify **overtime** flag is set to `true`

**Test 3B: 5-Day Shift (Sat & Sun Off)**

**Steps:**
1. Create a user with **5-day shift**
2. Wait for or set system date to **Saturday**
3. Clock in for this user
4. Check the attendance record
5. Verify **overtime** flag is set to `true`
6. Repeat for **Sunday**

**Expected Results:**
- ✅ Sunday is off for 6-day shift users
- ✅ Saturday & Sunday are off for 5-day shift users
- ✅ Overtime flag is automatically set when working on off days
- ✅ No manual overtime selection needed

---

### ✅ Test 4: Automatic Overtime on Company Holidays

**Objective:** Verify automatic overtime for company holidays

**Steps:**
1. Add a holiday for today's date (or upcoming date)
2. Clock in for any user on that holiday
3. Check the attendance record
4. Verify **overtime** flag is set to `true`
5. Verify attendance is marked as "Present" (not absent)

**Expected Results:**
- ✅ Working on holiday automatically sets overtime
- ✅ Holiday workers are marked Present, not Absent
- ✅ Combines with manual overtime if both apply

---

### ✅ Test 5: Sub Engineer Role

**Objective:** Verify sub engineer role exists and works

**Steps:**
1. Login as CEO/SuperAdmin
2. Navigate to **Users** screen
3. Create or edit a user
4. Click on **Role** dropdown
5. Verify **Sub Engineer** appears in the list
6. Select **Sub Engineer**
7. Save the user
8. Login as the sub engineer user
9. Try to clock in staff with location override
10. Verify override works (similar to General Manager)

**Expected Results:**
- ✅ Sub Engineer role appears in dropdown
- ✅ Role can be assigned to users
- ✅ Sub Engineer can override location restrictions
- ✅ Functions like supervisor with extra permissions

---

### ✅ Test 6: Backdated Attendance (Managers Only)

**Objective:** Verify managers can mark attendance for previous day

**Test 6A: Valid Backdated Attendance**

**Steps:**
1. Login as **Manager**
2. Navigate to **Mark Attendance** screen
3. Select a staff member
4. Select **yesterday's date** (not today)
5. Complete clock-in
6. Verify attendance is created for yesterday
7. Check that it's marked as "override" or "backdated"

**Test 6B: Invalid Backdated Attempts**

**Steps:**
1. Try to mark attendance for **today** (should fail)
2. Try to mark attendance for **2 days ago** (should fail)
3. Try to mark attendance for **future date** (should fail)
4. Login as **Supervisor** (not manager)
5. Try to use backdated feature (should not be available)

**Expected Results:**
- ✅ Managers can mark attendance for yesterday
- ✅ Today's date is rejected
- ✅ Dates older than yesterday are rejected
- ✅ Future dates are rejected
- ✅ Non-managers cannot use this feature

---

### ✅ Test 7: Attendance with Photos and Timestamps

**Objective:** Verify photos and timestamps are captured and displayed

**Steps:**
1. Clock in for a user
2. Capture photo during clock-in
3. Note the timestamp
4. Clock out for the same user
5. Capture photo during clock-out
6. Note the timestamp
7. Navigate to **Reports** or **Approvals** screen
8. Find the attendance record
9. Verify both photos are displayed
10. Verify both timestamps are shown
11. Verify GPS coordinates are captured (if available)

**Expected Results:**
- ✅ Clock-in photo is captured and stored
- ✅ Clock-out photo is captured and stored
- ✅ Clock-in timestamp is recorded
- ✅ Clock-out timestamp is recorded
- ✅ Photos are displayed in reports
- ✅ Timestamps are displayed with photos
- ✅ GPS coordinates are captured (if available)

---

### ✅ Test 8: Leave Request Hierarchy

**Objective:** Verify leave requests go to correct approvers

**Test 8A: Manager's Leave Request**

**Steps:**
1. Login as **Manager**
2. Submit a leave request
3. Logout
4. Login as **General Manager**
5. Check leave requests
6. Verify manager's request appears for approval

**Test 8B: General Manager's Leave Request**

**Steps:**
1. Login as **General Manager**
2. Submit a leave request
3. Logout
4. Login as **CEO** or **SuperAdmin**
5. Check leave requests
6. Verify GM's request appears for approval

**Expected Results:**
- ✅ Manager's leave goes to General Manager
- ✅ General Manager's leave goes to CEO/SuperAdmin
- ✅ Notifications are sent to correct approvers
- ✅ Approval flow works correctly

---

## 🔍 Edge Cases to Test

### Edge Case 1: Midnight Shift
- User with night shift (21:00 - 05:00)
- Clock in at 21:00
- Clock out at 05:00 next day
- Verify hours are calculated correctly

### Edge Case 2: Holiday on Weekly Off Day
- Create holiday for a Sunday
- User with 6-day shift (Sunday already off)
- Clock in on that Sunday
- Verify overtime is still set

### Edge Case 3: Multiple Backdated Attempts
- Manager marks attendance for yesterday
- Try to mark again for same staff, same date
- Verify duplicate is prevented

### Edge Case 4: Shift Change Mid-Month
- User has 6-day shift
- Change to 5-day shift
- Verify off days update correctly going forward
- Past attendance remains unchanged

---

## 🐛 Common Issues and Solutions

### Issue 1: Shift fields not showing in user form
**Solution:** Refresh the page, clear cache, or restart the app

### Issue 2: Holiday not saving
**Check:**
- Date format is YYYY-MM-DD
- Date is not duplicate
- You're logged in as CEO/SuperAdmin

### Issue 3: Automatic overtime not working
**Check:**
- User has shiftDays field set
- Holiday exists in database
- Backend is running latest code

### Issue 4: Backdated attendance not working
**Check:**
- You're logged in as Manager
- Date is yesterday (not today or older)
- You're marking for someone else (not self)

---

## 📊 Test Results Template

Use this template to track your testing:

```
Feature: ___________________________
Date Tested: _______________________
Tester: ____________________________

Test Cases:
[ ] Test 1: _______________________
    Result: PASS / FAIL
    Notes: ________________________

[ ] Test 2: _______________________
    Result: PASS / FAIL
    Notes: ________________________

Overall Status: PASS / FAIL / PARTIAL
Issues Found: ______________________
```

---

## 🎯 Acceptance Criteria

All features are considered ready for production when:

- ✅ All test scenarios pass
- ✅ No critical bugs found
- ✅ Edge cases handled correctly
- ✅ UI is responsive and user-friendly
- ✅ Error messages are clear and helpful
- ✅ Data is saved correctly in database
- ✅ Notifications work as expected
- ✅ Performance is acceptable

---

## 📞 Reporting Issues

If you find any issues during testing:

1. **Note the exact steps** to reproduce
2. **Capture screenshots** or screen recording
3. **Check browser console** for errors
4. **Check backend logs** for errors
5. **Document expected vs actual behavior**
6. **Report with severity level:**
   - 🔴 Critical: Feature doesn't work at all
   - 🟡 Major: Feature works but has significant issues
   - 🟢 Minor: Small UI/UX improvements needed

---

## ✅ Sign-Off

Once all tests pass:

```
Tested By: _______________________
Date: ____________________________
Signature: _______________________

Approved By: _____________________
Date: ____________________________
Signature: _______________________
```

---

**Testing Version:** 2.0.0  
**Last Updated:** December 5, 2024  
**Status:** ✅ Ready for Testing

