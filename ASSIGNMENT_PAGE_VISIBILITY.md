# Assignment Page Visibility Guide

## Overview
The Assignments Screen has role-based visibility. Only **Manager** and above can access this page. Staff and Supervisors cannot see it.

---

## Access Control

### ❌ **Cannot Access (Blocked)**
- **Staff** - Shows "Access denied. Executive access only."
- **Supervisor** - Shows "Access denied. Executive access only."

### ✅ **Can Access**
- **Manager** - Limited access (department-scoped)
- **General Manager** - Full access within their department
- **CEO/Super Admin** - Full access to everything

---

## Section Visibility by Role

**IMPORTANT:** Higher roles can see ALL sections that lower roles can see. Visibility is cumulative.

### 1. **General Manager Departments** Section
**Visible to:** General Manager, CEO, Super Admin

**What it does:**
- Assigns General Managers to departments
- Logic: `showGeneralManagerDepartments = isGeneralManagerOrAbove`

**Who sees it:**
- ✅ General Manager
- ✅ CEO/Super Admin
- ❌ Manager

---

### 2. **Supervisor Hierarchy** Section
**Visible to:** General Manager, CEO, Super Admin

**What it does:**
- Assigns Supervisors to Managers
- Shows the hierarchy: Manager → Supervisors
- Logic: `showSupervisorHierarchySection = isGeneralManagerOrAbove`

**Who sees it:**
- ✅ General Manager
- ✅ CEO/Super Admin
- ❌ Manager

---

### 3. **Staff Assignments** Section
**Visible to:** Manager, General Manager, CEO, Super Admin

**What it does:**
- Assigns Staff to Supervisor + Zone
- Logic: `showStaffAssignmentTools = isManagerOrAbove`

**Who sees it:**
- ✅ Manager (department-scoped - only their department)
- ✅ General Manager (can filter by department)
- ✅ CEO/Super Admin (can filter by department)

**Department Filtering:**
- **Managers:** Automatically filtered to their department (no dropdown, just info box)
- **General Managers:** Can filter by department dropdown (sees all departments)
- **CEO/Super Admin:** Can filter by department dropdown (sees all departments)

---

### 4. **Assign Supervisor to Location** Section
**Visible to:** Manager, General Manager, CEO, Super Admin

**What it does:**
- Assigns a Supervisor to a Location (NC)
- Logic: `showStaffAssignmentTools = isManagerOrAbove`

**Who sees it:**
- ✅ Manager (department-scoped - only supervisors from their department)
- ✅ General Manager (sees all supervisors)
- ✅ CEO/Super Admin (sees all supervisors)

---

### 5. **Current Assignments** Section
**Visible to:** All roles (Manager, General Manager, CEO/Super Admin)

**What it shows:**
- List of all staff assignments (Staff → Supervisor → Zone)
- Shows: Supervisor, Staff, Zone, Location

**Filtering:**
- **Manager:** Only sees assignments from their department
- **General Manager:** Sees all assignments (can search)
- **CEO/Super Admin:** Sees all assignments (can search)

**Search:** Available for all roles

---

### 6. **Supervisor Location Mappings** Section
**Visible to:** All roles (Manager, General Manager, CEO/Super Admin)

**What it shows:**
- List of Supervisor → Location mappings
- Shows which supervisors are assigned to which locations

**Filtering:**
- **Manager:** Only sees mappings for supervisors from their department
- **General Manager:** Sees all mappings (can search)
- **CEO/Super Admin:** Sees all mappings (can search)

**Search:** Available for all roles

---

## Department Scoping Rules

### Manager
- Can only see/manage:
  - Staff from their department
  - Supervisors from their department
  - Assignments involving their department
  - Supervisor-Location mappings for their department

### General Manager
- Can see/manage:
  - All staff and supervisors from their department
  - Can filter by department
  - Can assign General Managers to departments

### CEO/Super Admin
- Can see/manage:
  - Everything (no restrictions)
  - All departments
  - All staff, supervisors, managers
  - All assignments and mappings

---

## Summary Table

| Section | Manager | General Manager | CEO/Super Admin |
|---------|---------|----------------|-----------------|
| General Manager Departments | ❌ | ✅ | ✅ |
| Supervisor Hierarchy | ❌ | ✅ | ✅ |
| Staff Assignments | ✅ (dept) | ✅ (filter) | ✅ (filter) |
| Assign Supervisor to Location | ✅ (dept) | ✅ (all) | ✅ (all) |
| Current Assignments | ✅ (dept) | ✅ (all) | ✅ (all) |
| Supervisor Location Mappings | ✅ (dept) | ✅ (all) | ✅ (all) |

**Legend:**
- ✅ = Visible
- ❌ = Hidden
- (dept) = Department-scoped (only their department)
- (filter) = Can filter by department dropdown
- (all) = All departments (no restrictions)

---

## Key Logic Variables

```javascript
canAccessAssignments = isAtLeastRole(currentRole, ROLE.MANAGER)
// Must be Manager or above

showGeneralManagerDepartments = isGeneralManagerOrAbove
// General Manager, CEO, Super Admin

showSupervisorHierarchySection = isGeneralManagerOrAbove
// General Manager, CEO, Super Admin

showStaffAssignmentTools = isManagerOrAbove
// Manager, General Manager, CEO, Super Admin (cumulative visibility)
```

## Visibility Rules Summary

**Cumulative Visibility (Higher roles see everything):**
- **Manager:** Sees their own sections (department-scoped)
- **General Manager:** Sees Manager sections + General Manager sections
- **CEO/Super Admin:** Sees ALL sections (everything)

