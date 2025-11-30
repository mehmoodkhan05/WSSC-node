// Push notification cloud functions were intentionally removed.

Parse.Cloud.define('fetchAllProfiles', async (request) => {
  try {
    const query = new Parse.Query(Parse.User);
    
    // Check if requester is CEO/Superadmin - they should see all users (including inactive)
    const executor = request.user;
    let includeInactive = request.params?.includeInactive === true;
    
    if (executor) {
      const rawRole = executor.get('role') || executor.get('userRole') || executor.get('roleName') || null;
      const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : null;
      
      // CEO/Superadmin automatically see all users including inactive
      if (['super_admin', 'ceo'].includes(normalizedRole)) {
        includeInactive = true;
      }
    }
    
    // Only filter by active if not including inactive
    if (!includeInactive) {
      query.equalTo('isActive', true);
    }
    
    query.ascending('createdAt');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });

    return results.map(user => ({
      user_id: user.id,
      email: user.get('email'),
      full_name: user.get('fullName'),
      role: user.get('role'),
      username: user.get('username'),
      created_at: user.createdAt,
      department: user.get('department') || null,
      departments: user.get('departments') || [],
      manager_id: user.get('managerId') || null,
      general_manager_id: user.get('generalManagerId') || null,
      emp_fname: user.get('empFname') || null,
      emp_deptt: user.get('empDeptt') || null,
      emp_job: user.get('empJob') || null,
      emp_grade: user.get('empGrade') || null,
      emp_cell1: user.get('empCell1') || null,
      emp_cell2: user.get('empCell2') || null,
      emp_flg: user.get('empFlg') || null,
      emp_married: user.get('empMarried') || null,
      emp_gender: user.get('empGender') || null,
      emp_no: user.get('empNo') || null,
      emp_cnic: user.get('empCnic') || null,
      is_active: user.get('isActive') !== false, // Default to true if not set
    }));
  } catch (error) {
    console.error('Error in fetchAllProfiles:', error);
    throw new Error('Failed to fetch profiles: ' + error.message);
  }
});

Parse.Cloud.define('fetchStaff', async (request) => {
  try {
    const query = new Parse.Query(Parse.User);
    query.equalTo('role', 'staff');
    query.equalTo('isActive', true); // Only fetch active staff
    query.ascending('fullName');
    query.limit(USER_QUERY_LIMIT);

    const results = await query.find({ useMasterKey: true });
    return results.map(user => ({
      user_id: user.id,
      name: user.get('fullName') || user.get('username') || 'Unknown Staff',
      email: user.get('email'),
      full_name: user.get('fullName'),
      department: user.get('department') || null,
      manager_id: user.get('managerId') || null,
      supervisor_id: user.get('supervisorId') || null,
      empNo: user.get('empNo') || null,
    }));
  } catch (error) {
    console.error('Error in fetchStaff:', error);
    throw new Error('Failed to fetch staff: ' + error.message);
  }
});

Parse.Cloud.define('fetchSupervisors', async (request) => {
  try {
    const query = new Parse.Query(Parse.User);
    query.equalTo('role', 'supervisor');
    query.equalTo('isActive', true); // Only fetch active supervisors
    query.ascending('fullName');
    query.limit(USER_QUERY_LIMIT);

    const results = await query.find({ useMasterKey: true });
    return results.map(user => ({
      user_id: user.id,
      name: user.get('fullName') || user.get('username') || 'Unknown Supervisor',
      email: user.get('email'),
      full_name: user.get('fullName'),
      department: user.get('department') || null,
      manager_id: user.get('managerId') || null,
    }));
  } catch (error) {
    console.error('Error in fetchSupervisors:', error);
    throw new Error('Failed to fetch supervisors: ' + error.message);
  }
});

const mapUserWithDepartment = (user) => ({
  user_id: user.id,
  name: user.get('fullName') || user.get('username') || 'Unknown',
  email: user.get('email'),
  full_name: user.get('fullName'),
  department: user.get('department') || null,
  departments: user.get('departments') || [],
  general_manager_id: user.get('generalManagerId') || null,
  manager_id: user.get('managerId') || null,
});

const USER_QUERY_LIMIT = 1000;

Parse.Cloud.define('fetchManagers', async () => {
  try {
    const query = new Parse.Query(Parse.User);
    query.equalTo('role', 'manager');
    query.equalTo('isActive', true); // Only fetch active managers
    query.ascending('fullName');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });
    return results.map(mapUserWithDepartment);
  } catch (error) {
    console.error('Error in fetchManagers:', error);
    throw new Error('Failed to fetch managers: ' + error.message);
  }
});

Parse.Cloud.define('fetchGeneralManagers', async () => {
  try {
    const query = new Parse.Query(Parse.User);
    query.equalTo('role', 'general_manager');
    query.equalTo('isActive', true); // Only fetch active general managers
    query.ascending('fullName');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });
    return results.map(mapUserWithDepartment);
  } catch (error) {
    console.error('Error in fetchGeneralManagers:', error);
    throw new Error('Failed to fetch general managers: ' + error.message);
  }
});

Parse.Cloud.define('updateUserLeadership', async (request) => {
  const { userId, department, departments, managerId, generalManagerId } = request.params || {};

  if (!userId) {
    throw new Error('userId is required');
  }

  const executor = request.user;
  if (!executor) {
    throw new Error('Authentication required');
  }

  const executorRoleRaw =
    executor.get('role') || executor.get('userRole') || executor.get('roleName') || null;
  const executorRole =
    typeof executorRoleRaw === 'string' ? executorRoleRaw.trim().toLowerCase() : null;
  const isAuthorized = ['super_admin', 'ceo', 'general_manager', 'manager'].includes(executorRole);

  if (!isAuthorized) {
    throw new Error('Insufficient auth.');
  }

  try {
    const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
    if (!user) {
      throw new Error('User not found');
    }

    if (department !== undefined) {
      if (department === null || department === '') {
        user.unset('department');
      } else {
        user.set('department', department);
      }
    }

    if (Array.isArray(departments)) {
      user.set('departments', departments);
    } else if (departments === null) {
      user.unset('departments');
    }

    if (managerId !== undefined) {
      if (managerId) {
        user.set('managerId', managerId);
      } else {
        user.unset('managerId');
      }
    }

    if (generalManagerId !== undefined) {
      if (generalManagerId) {
        user.set('generalManagerId', generalManagerId);
      } else {
        user.unset('generalManagerId');
      }
    }

    await user.save(null, { useMasterKey: true });

    return {
      success: true,
      user_id: user.id,
      department: user.get('department') || null,
      departments: user.get('departments') || [],
      manager_id: user.get('managerId') || null,
      general_manager_id: user.get('generalManagerId') || null,
    };
  } catch (error) {
    console.error('Error in updateUserLeadership:', error);
    throw new Error('Failed to update user leadership data: ' + error.message);
  }
});

Parse.Cloud.define('deleteUser', async (request) => {
  try {
    const { userId } = request.params;

    if (!userId) {
      throw new Error('User ID is required');
    }

    const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });

    if (!user) {
      throw new Error('User not found');
    }

    await user.destroy({ useMasterKey: true });

    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('Error in deleteUser:', error);
    throw new Error('Failed to delete user: ' + error.message);
  }
});

Parse.Cloud.define('deleteLocation', async (request) => {
  try {
    const { locationId } = request.params;

    if (!locationId) {
      throw new Error('Location ID is required');
    }

    const location = await new Parse.Query('NCLocation').get(locationId, { useMasterKey: true });

    if (!location) {
      throw new Error('Location not found');
    }

    await location.destroy({ useMasterKey: true });

    return { success: true, message: 'Location deleted successfully' };
  } catch (error) {
    console.error('Error in deleteLocation:', error);
    throw new Error('Failed to delete location: ' + error.message);
  }
});

Parse.Cloud.define('getDashboardStats', async (request) => {
  try {
    // Fetch counts using master key to bypass ACL restrictions
    const [totalStaffCount, supervisorCount, pendingLeaveRequestsCount] = await Promise.all([
      new Parse.Query(Parse.User)
        .equalTo('role', 'staff')
        .count({ useMasterKey: true }),
      new Parse.Query(Parse.User)
        .equalTo('role', 'supervisor')
        .count({ useMasterKey: true }),
      new Parse.Query('LeaveRequest')
        .equalTo('status', 'pending')
        .count({ useMasterKey: true })
    ]);

    return {
      totalStaff: totalStaffCount || 0,
      supervisorCount: supervisorCount || 0,
      pendingLeaveRequestsCount: pendingLeaveRequestsCount || 0
    };
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    throw new Error('Failed to fetch dashboard stats: ' + error.message);
  }
});

Parse.Cloud.define('getStatsByRoleAndDepartment', async (request) => {
  try {
    console.log('=== getStatsByRoleAndDepartment - START ===');
    
    // Check authorization - Manager and above can access (department scoped for managers/G.Managers)
    const executor = request.user;
    console.log('Executor:', executor ? executor.id : 'null');
    
    if (!executor) {
      console.error('No executor found - Authentication required');
      throw new Error('Authentication required');
    }
    
    const rawRole = executor.get('role') || executor.get('userRole') || executor.get('roleName') || null;
    const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : null;
    console.log('Executor role:', rawRole, 'Normalized:', normalizedRole);

    const allowedRoles = ['super_admin', 'ceo', 'general_manager', 'manager'];
    if (!allowedRoles.includes(normalizedRole)) {
      console.error('Insufficient permissions. Role:', normalizedRole);
      throw new Error('Insufficient permissions. Manager or higher access required.');
    }

    const hasOrgWideAccess = ['super_admin', 'ceo'].includes(normalizedRole);
    const normalizeValue = (value) =>
      typeof value === 'string' ? value.trim() : null;

    let departmentFilter = null;
    if (hasOrgWideAccess) {
      const requestedDept =
        request?.params && typeof request.params.departmentId === 'string'
          ? request.params.departmentId.trim()
          : null;
      departmentFilter = requestedDept ? [requestedDept] : null;
    } else if (normalizedRole === 'general_manager') {
      const gmDepartments = executor.get('departments');
      const singleDepartment = executor.get('department') || executor.get('empDeptt');
      const collected = [];
      if (Array.isArray(gmDepartments)) {
        gmDepartments.forEach((dept) => {
          const normalized = normalizeValue(dept);
          if (normalized) {
            collected.push(normalized);
          }
        });
      }
      const normalizedSingle = normalizeValue(singleDepartment);
      if (normalizedSingle) {
        collected.push(normalizedSingle);
      }
      departmentFilter = Array.from(new Set(collected));
    } else if (normalizedRole === 'manager') {
      const managerDepartment = normalizeValue(executor.get('department') || executor.get('empDeptt'));
      departmentFilter = managerDepartment ? [managerDepartment] : [];
    }

    if (!hasOrgWideAccess && (!departmentFilter || departmentFilter.length === 0)) {
      console.warn('No departments assigned to executor. Returning empty stats.');
      return {
        byRole: [],
        byDepartment: [],
        byRoleAndDepartment: [],
        totalUsers: 0
      };
    }

    const departmentFilterSet = departmentFilter ? new Set(departmentFilter.map(normalizeValue)) : null;
    const userMatchesDepartment = (user) => {
      if (!departmentFilterSet) {
        return true;
      }
      const directDept = normalizeValue(user.get('department'));
      if (directDept && departmentFilterSet.has(directDept)) {
        return true;
      }
      const empDeptt = normalizeValue(user.get('empDeptt'));
      if (empDeptt && departmentFilterSet.has(empDeptt)) {
        return true;
      }
      const multiDepartments = user.get('departments');
      if (Array.isArray(multiDepartments)) {
        for (const dept of multiDepartments) {
          const normalized = normalizeValue(dept);
          if (normalized && departmentFilterSet.has(normalized)) {
            return true;
          }
        }
      }
      return false;
    };

    console.log('Authorization passed. Fetching users...');
    const query = new Parse.Query(Parse.User);
    query.equalTo('isActive', true); // Only count active users
    query.limit(10000); // Adjust based on your user count
    
    // Also try without isActive filter to see total users
    const queryAll = new Parse.Query(Parse.User);
    queryAll.limit(10000);
    const allUsers = await queryAll.find({ useMasterKey: true });
    console.log('Total users (all):', allUsers.length);
    
    const users = await query.find({ useMasterKey: true });
    console.log('Active users found:', users.length);
    const filteredUsers = users.filter(userMatchesDepartment);
    console.log('Users after department filtering:', filteredUsers.length);

    // Initialize stats structure
    const statsByRole = {};
    const statsByDepartment = {};
    const statsByRoleAndDepartment = {};

    // Process each user
    console.log('Processing users...');
    let processedCount = 0;
    filteredUsers.forEach((user, index) => {
      const role = user.get('role') || 'unknown';
      // Try multiple fields for department
      const deptFromDepartment = user.get('department');
      const deptFromEmpDeptt = user.get('empDeptt');
      const department = deptFromDepartment || deptFromEmpDeptt || 'unassigned';
      
      // Log first few users for debugging
      if (index < 5) {
        console.log(`User ${index + 1}:`, {
          id: user.id,
          email: user.get('email'),
          role: role,
          department: deptFromDepartment,
          empDeptt: deptFromEmpDeptt,
          isActive: user.get('isActive')
        });
      }
      
      // Normalize role to lowercase for consistency
      const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'unknown';
      
      // Count by role
      if (!statsByRole[normalizedRole]) {
        statsByRole[normalizedRole] = 0;
      }
      statsByRole[normalizedRole]++;

      // Count by department (normalize department value)
      const normalizedDept = typeof department === 'string' ? department.trim() : 'unassigned';
      if (!statsByDepartment[normalizedDept]) {
        statsByDepartment[normalizedDept] = 0;
      }
      statsByDepartment[normalizedDept]++;

      // Count by role and department combination
      const key = `${normalizedRole}_${normalizedDept}`;
      if (!statsByRoleAndDepartment[key]) {
        statsByRoleAndDepartment[key] = {
          role: normalizedRole,
          department: normalizedDept,
          count: 0
        };
      }
      statsByRoleAndDepartment[key].count++;
      processedCount++;
    });
    console.log('Processed users:', processedCount);

    // Convert to arrays for easier consumption
    const roleStats = Object.entries(statsByRole).map(([role, count]) => ({
      role,
      count
    }));

    const departmentStats = Object.entries(statsByDepartment).map(([department, count]) => ({
      department,
      count
    }));

    const roleDepartmentStats = Object.values(statsByRoleAndDepartment);

    const result = {
      byRole: roleStats,
      byDepartment: departmentStats,
      byRoleAndDepartment: roleDepartmentStats,
      totalUsers: filteredUsers.length
    };

    // Console log for debugging
    console.log('=== Organization Overview Stats ===');
    console.log('Total Users:', users.length);
    console.log('By Role:', roleStats);
    console.log('By Department:', departmentStats);
    console.log('By Role & Department:', roleDepartmentStats);
    console.log('Full Result:', JSON.stringify(result, null, 2));
    console.log('===================================');

    return result;
  } catch (error) {
    console.error('Error in getStatsByRoleAndDepartment:', error);
    throw new Error('Failed to fetch stats by role and department: ' + error.message);
  }
});

Parse.Cloud.define('fetchTodayAttendance', async (request) => {
  try {
    const { userId, userRole, staffIds } = request.params || {};
    const staffIdList = Array.isArray(staffIds) ? staffIds.filter(Boolean) : [];
    const normalizedRole = typeof userRole === 'string' ? userRole.toLowerCase() : null;
    const hasOrgWideAccess = ['admin', 'manager', 'general_manager', 'ceo', 'super_admin'].includes(normalizedRole);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const query = new Parse.Query('Attendance');
    query.greaterThanOrEqualTo('attendanceDate', todayStr);
    query.lessThan('attendanceDate', tomorrowStr);
    query.include(['staffId', 'supervisorId', 'ncLocationId', 'clockedInBy', 'clockedOutBy']);
    query.limit(USER_QUERY_LIMIT);
    
    // Filter by user role: leadership roles see all, others see their own records
    if (!hasOrgWideAccess && userId) {
      // For staff and supervisors, only show their own attendance records
      query.equalTo('staffId', Parse.User.createWithoutData(userId));
    } else if (staffIdList.length > 0) {
      const staffPointers = staffIdList.map(id => Parse.User.createWithoutData(id));
      query.containedIn('staffId', staffPointers);
    }
    
    query.descending('clockIn');
    const results = await query.find({ useMasterKey: true });

    // Filter out attendance records for inactive users
    const filteredResults = results.filter(record => {
      const staffIdObj = record.get('staffId');
      if (staffIdObj && typeof staffIdObj.get === 'function') {
        const isActive = staffIdObj.get('isActive');
        return isActive !== false; // Include if active or not set (default to active)
      }
      return true; // Include if we can't determine status
    });

    return filteredResults.map(record => {
      const staffIdObj = record.get('staffId');
      const supervisorIdObj = record.get('supervisorId');
      const ncLocationIdObj = record.get('ncLocationId');

      let staffId = null;
      let staffName = 'Unknown Staff';
      let supervisorId = null;
      let supervisorName = 'Unknown Supervisor';
      let nc_location_id = null;
      let nc_location_name = 'N/A';
      let staffDepartment = null;
      let supervisorDepartment = null;
      let managerId = null;
      let generalManagerId = null;

      if (staffIdObj) {
        staffId = staffIdObj.id || (typeof staffIdObj === 'string' ? staffIdObj : null);
        if (typeof staffIdObj.get === 'function') {
          const fullName = staffIdObj.get('fullName');
          const name = staffIdObj.get('name');
          const username = staffIdObj.get('username');
          staffName =
            (fullName && fullName.trim()) ||
            (name && name.trim()) ||
            (username && username.trim()) ||
            'Unknown Staff';
          staffDepartment = staffIdObj.get('department') || null;
          managerId = staffIdObj.get('managerId') || null;
          generalManagerId = staffIdObj.get('generalManagerId') || null;
        } else if (typeof staffIdObj === 'object') {
          staffName =
            (staffIdObj.fullName && staffIdObj.fullName.trim()) ||
            (staffIdObj.name && staffIdObj.name.trim()) ||
            (staffIdObj.username && staffIdObj.username.trim()) ||
            'Unknown Staff';
          staffDepartment = staffIdObj.department || null;
        }
      }

      if (supervisorIdObj) {
        supervisorId = supervisorIdObj.id || (typeof supervisorIdObj === 'string' ? supervisorIdObj : null);
        if (typeof supervisorIdObj.get === 'function') {
          const fullName = supervisorIdObj.get('fullName');
          const name = supervisorIdObj.get('name');
          const username = supervisorIdObj.get('username');
          supervisorName =
            (fullName && fullName.trim()) ||
            (name && name.trim()) ||
            (username && username.trim()) ||
            'Unknown Supervisor';
          supervisorDepartment = supervisorIdObj.get('department') || null;
          managerId = supervisorIdObj.get('managerId') || managerId;
          generalManagerId = supervisorIdObj.get('generalManagerId') || generalManagerId;
        } else if (typeof supervisorIdObj === 'object') {
          supervisorName =
            (supervisorIdObj.fullName && supervisorIdObj.fullName.trim()) ||
            (supervisorIdObj.name && supervisorIdObj.name.trim()) ||
            (supervisorIdObj.username && supervisorIdObj.username.trim()) ||
            'Unknown Supervisor';
          supervisorDepartment = supervisorIdObj.department || null;
        }
      }

      if (ncLocationIdObj) {
        nc_location_id = ncLocationIdObj.id || (typeof ncLocationIdObj === 'string' ? ncLocationIdObj : null);
        if (typeof ncLocationIdObj.get === 'function') {
          nc_location_name = ncLocationIdObj.get('name') || 'N/A';
        }
      }

      // Get clockedInBy and clockedOutBy information
      const clockedInByObj = record.get('clockedInBy');
      const clockedOutByObj = record.get('clockedOutBy');
      let clockedInByName = null;
      let clockedOutByName = null;

      if (clockedInByObj) {
        const clockedInById = clockedInByObj.id || (typeof clockedInByObj === 'string' ? clockedInByObj : null);
        if (typeof clockedInByObj.get === 'function') {
          clockedInByName = clockedInByObj.get('fullName') || clockedInByObj.get('username') || null;
        } else if (typeof clockedInByObj === 'object') {
          clockedInByName = clockedInByObj.fullName || clockedInByObj.username || null;
        }
        // Only show if different from staff member
        if (clockedInByName && clockedInById === staffId) {
          clockedInByName = null;
        }
      }

      if (clockedOutByObj) {
        const clockedOutById = clockedOutByObj.id || (typeof clockedOutByObj === 'string' ? clockedOutByObj : null);
        if (typeof clockedOutByObj.get === 'function') {
          clockedOutByName = clockedOutByObj.get('fullName') || clockedOutByObj.get('username') || null;
        } else if (typeof clockedOutByObj === 'object') {
          clockedOutByName = clockedOutByObj.fullName || clockedOutByObj.username || null;
        }
        // Only show if different from staff member
        if (clockedOutByName && clockedOutById === staffId) {
          clockedOutByName = null;
        }
      }

      return {
        id: record.id,
        staffId,
        staffName,
        supervisorId,
        supervisorName,
        nc_location_id,
        nc: nc_location_name,
        department: staffDepartment || supervisorDepartment || null,
        staff_department: staffDepartment,
        supervisor_department: supervisorDepartment,
        manager_id: managerId,
        general_manager_id: generalManagerId,
        date: record.get('attendanceDate'),
        clockIn: record.get('clockIn') ? record.get('clockIn').toISOString() : null,
        clockOut: record.get('clockOut') ? record.get('clockOut').toISOString() : null,
        status: record.get('status') || 'absent',
        approvalStatus: record.get('approvalStatus') || 'pending',
        overtime: record.get('overtime') || false,
        doubleDuty: record.get('doubleDuty') || false,
        clockedInBy: clockedInByName,
        clockedOutBy: clockedOutByName,
        isOverride: record.get('isOverride') || false,
      };
    });
  } catch (error) {
    console.error('Error in fetchTodayAttendance:', error);
    throw new Error('Failed to fetch today attendance: ' + error.message);
  }
});

Parse.Cloud.define('fetchLeadershipAttendance', async (request) => {
  try {
    const requester = request.user;
    if (!requester) {
      throw new Error('Authentication required');
    }

    // Only CEO and Super Admin can access this
    const requesterRoleRaw = requester.get('role') || requester.get('userRole') || requester.get('roleName') || null;
    const requesterRole = typeof requesterRoleRaw === 'string' ? requesterRoleRaw.trim().toLowerCase() : null;
    const isAuthorized = ['ceo', 'super_admin'].includes(requesterRole);

    if (!isAuthorized) {
      throw new Error('Unauthorized: Only CEO and Super Admin can access leadership attendance');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch all users with leadership roles (manager, general_manager, supervisor)
    const leadershipRoles = ['manager', 'general_manager', 'supervisor'];
    const leadershipQuery = new Parse.Query(Parse.User);
    leadershipQuery.containedIn('role', leadershipRoles);
    leadershipQuery.equalTo('isActive', true);
    const leadershipUsers = await leadershipQuery.find({ useMasterKey: true });

    // Fetch today's attendance for leadership users
    const attendanceQuery = new Parse.Query('Attendance');
    attendanceQuery.greaterThanOrEqualTo('attendanceDate', todayStr);
    attendanceQuery.lessThan('attendanceDate', tomorrowStr);
    attendanceQuery.include(['staffId', 'supervisorId', 'ncLocationId', 'clockedInBy', 'clockedOutBy']);
    
    const staffPointers = leadershipUsers.map(user => Parse.User.createWithoutData(user.id));
    attendanceQuery.containedIn('staffId', staffPointers);
    
    attendanceQuery.descending('clockIn');
    const attendanceRecords = await attendanceQuery.find({ useMasterKey: true });

    // Create a map of attendance by staff ID
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      const staffIdObj = record.get('staffId');
      if (staffIdObj) {
        const staffId = staffIdObj.id || (typeof staffIdObj === 'string' ? staffIdObj : null);
        if (staffId) {
          attendanceMap.set(staffId, record);
        }
      }
    });

    // Build the result array with all leadership users and their attendance status
    const result = leadershipUsers.map(user => {
      const userId = user.id;
      const attendanceRecord = attendanceMap.get(userId);
      
      const fullName = user.get('fullName') || user.get('username') || 'Unknown';
      const role = user.get('role') || 'unknown';
      const department = user.get('department') || null;

      let clockIn = null;
      let clockOut = null;
      let status = 'absent';
      let nc_location_id = null;
      let nc_location_name = 'N/A';
      let clockedInBy = null;
      let clockedOutBy = null;
      let isOverride = false;

      if (attendanceRecord) {
        clockIn = attendanceRecord.get('clockIn') ? attendanceRecord.get('clockIn').toISOString() : null;
        clockOut = attendanceRecord.get('clockOut') ? attendanceRecord.get('clockOut').toISOString() : null;
        status = attendanceRecord.get('status') || 'absent';
        
        const locationObj = attendanceRecord.get('ncLocationId');
        if (locationObj) {
          nc_location_id = locationObj.id || null;
          if (typeof locationObj.get === 'function') {
            nc_location_name = locationObj.get('name') || 'N/A';
          }
        }

        // Get clockedBy information
        const clockedInByObj = attendanceRecord.get('clockedInBy');
        if (clockedInByObj) {
          const clockedInById = clockedInByObj.id || (typeof clockedInByObj === 'string' ? clockedInByObj : null);
          if (clockedInById && clockedInById !== userId) {
            if (typeof clockedInByObj.get === 'function') {
              clockedInBy = clockedInByObj.get('fullName') || clockedInByObj.get('username') || null;
            }
          }
        }

        const clockedOutByObj = attendanceRecord.get('clockedOutBy');
        if (clockedOutByObj) {
          const clockedOutById = clockedOutByObj.id || (typeof clockedOutByObj === 'string' ? clockedOutByObj : null);
          if (clockedOutById && clockedOutById !== userId) {
            if (typeof clockedOutByObj.get === 'function') {
              clockedOutBy = clockedOutByObj.get('fullName') || clockedOutByObj.get('username') || null;
            }
          }
        }

        isOverride = attendanceRecord.get('isOverride') || false;
      }

      // Determine status if no attendance record
      if (!attendanceRecord) {
        status = 'absent';
      } else if (clockIn && !clockOut) {
        status = 'present';
      } else if (clockIn && clockOut) {
        status = 'present';
      }

      return {
        id: attendanceRecord ? attendanceRecord.id : `${userId}-${todayStr}`,
        userId,
        name: fullName,
        role,
        department,
        clockIn,
        clockOut,
        status,
        nc_location_id,
        nc_location_name,
        clockedInBy,
        clockedOutBy,
        isOverride,
      };
    });

    // Sort by role (General Manager, Manager, Supervisor) then by name
    const roleOrder = { general_manager: 1, manager: 2, supervisor: 3 };
    result.sort((a, b) => {
      const roleDiff = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
      if (roleDiff !== 0) return roleDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  } catch (error) {
    console.error('Error in fetchLeadershipAttendance:', error);
    throw new Error('Failed to fetch leadership attendance: ' + error.message);
  }
});

Parse.Cloud.define('fetchTodayLeaveRequests', async (request) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const query = new Parse.Query('LeaveRequest');
    query.equalTo('status', 'approved');
    query.lessThanOrEqualTo('startDate', todayStr);
    query.greaterThanOrEqualTo('endDate', todayStr);
    query.include('staffId');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });

    // Filter out leave requests for inactive users
    const filteredResults = results.filter(record => {
      const staffIdObj = record.get('staffId');
      if (staffIdObj && typeof staffIdObj.get === 'function') {
        const isActive = staffIdObj.get('isActive');
        return isActive !== false; // Include if active or not set (default to active)
      }
      return true; // Include if we can't determine status
    });

    return filteredResults.map(record => {
      const staffIdObj = record.get('staffId');
      return {
        id: record.id,
        staffId: staffIdObj ? staffIdObj.id : null,
        startDate: record.get('startDate'),
        endDate: record.get('endDate')
      };
    });
  } catch (error) {
    console.error('Error in fetchTodayLeaveRequests:', error);
    throw new Error('Failed to fetch today leave requests: ' + error.message);
  }
});

Parse.Cloud.define('createStaffAssignment', async (request) => {
  try {
    const { staff_id, supervisor_id, nc_location_id } = request.params;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      throw new Error('staff_id, supervisor_id, and nc_location_id are required');
    }

    // Verify that staff and supervisor exist
    const [staff, supervisor, location] = await Promise.all([
      new Parse.Query(Parse.User).get(staff_id, { useMasterKey: true }),
      new Parse.Query(Parse.User).get(supervisor_id, { useMasterKey: true }),
      new Parse.Query('NCLocation').get(nc_location_id, { useMasterKey: true })
    ]);

    if (!staff) {
      throw new Error('Staff not found');
    }
    if (!supervisor) {
      throw new Error('Supervisor not found');
    }
    if (!location) {
      throw new Error('Location not found');
    }

    // Check if assignment already exists
    const existingQuery = new Parse.Query('StaffAssignment');
    existingQuery.equalTo('staffId', staff);
    existingQuery.equalTo('supervisorId', supervisor);
    existingQuery.equalTo('ncLocationId', location);
    existingQuery.equalTo('isActive', true);
    const existing = await existingQuery.first({ useMasterKey: true });

    if (existing) {
      throw new Error('Assignment already exists');
    }

    // Create the assignment
    const Assignment = Parse.Object.extend('StaffAssignment');
    const assignment = new Assignment();
    assignment.set('staffId', staff);
    assignment.set('supervisorId', supervisor);
    assignment.set('ncLocationId', location);
    assignment.set('isActive', true);

    const saved = await assignment.save(null, { useMasterKey: true });

    return {
      id: saved.id,
      staff_id: saved.get('staffId').id,
      supervisor_id: saved.get('supervisorId').id,
      nc_location_id: saved.get('ncLocationId').id,
      is_active: saved.get('isActive'),
      created_at: saved.get('createdAt').toISOString()
    };
  } catch (error) {
    console.error('Error in createStaffAssignment:', error);
    throw new Error('Failed to create assignment: ' + error.message);
  }
});

Parse.Cloud.define('createSupervisorLocation', async (request) => {
  try {
    const { supervisor_id, nc_location_id } = request.params;

    if (!supervisor_id || !nc_location_id) {
      throw new Error('supervisor_id and nc_location_id are required');
    }

    // Verify that supervisor and location exist
    const [supervisor, location] = await Promise.all([
      new Parse.Query(Parse.User).get(supervisor_id, { useMasterKey: true }),
      new Parse.Query('NCLocation').get(nc_location_id, { useMasterKey: true })
    ]);

    if (!supervisor) {
      throw new Error('Supervisor not found');
    }
    if (!location) {
      throw new Error('Location not found');
    }

    // Check if mapping already exists
    const existingQuery = new Parse.Query('SupervisorLocation');
    existingQuery.equalTo('supervisorId', supervisor);
    existingQuery.equalTo('ncLocationId', location);
    const existing = await existingQuery.first({ useMasterKey: true });

    if (existing) {
      throw new Error('Supervisor-location mapping already exists');
    }

    // Create the mapping
    const SupervisorLocation = Parse.Object.extend('SupervisorLocation');
    const mapping = new SupervisorLocation();
    mapping.set('supervisorId', supervisor);
    mapping.set('ncLocationId', location);

    const saved = await mapping.save(null, { useMasterKey: true });

    return {
      id: saved.id,
      supervisor_id: saved.get('supervisorId').id,
      nc_location_id: saved.get('ncLocationId').id,
      created_at: saved.get('createdAt').toISOString()
    };
  } catch (error) {
    console.error('Error in createSupervisorLocation:', error);
    throw new Error('Failed to create supervisor-location mapping: ' + error.message);
  }
});

Parse.Cloud.define('fetchSupervisorLocations', async (request) => {
  try {
    const query = new Parse.Query('SupervisorLocation');
    query.include(['supervisorId', 'ncLocationId']);
    query.descending('createdAt');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });

    return results.map(obj => {
      const supervisorIdObj = obj.get('supervisorId');
      const ncLocationIdObj = obj.get('ncLocationId');

      // Extract IDs safely - handle both Parse objects and pointers
      let supervisor_id = null;
      let nc_location_id = null;

      if (supervisorIdObj) {
        supervisor_id = supervisorIdObj.id || (typeof supervisorIdObj === 'string' ? supervisorIdObj : null);
      }

      if (ncLocationIdObj) {
        nc_location_id = ncLocationIdObj.id || (typeof ncLocationIdObj === 'string' ? ncLocationIdObj : null);
      }

      return {
        id: obj.id,
        supervisor_id: supervisor_id,
        nc_location_id: nc_location_id,
        created_at: obj.get('createdAt') ? obj.get('createdAt').toISOString() : new Date().toISOString()
      };
    });
  } catch (error) {
    console.error('Error in fetchSupervisorLocations:', error);
    throw new Error('Failed to fetch supervisor locations: ' + error.message);
  }
});

Parse.Cloud.define('fetchAssignments', async (request) => {
  try {
    const query = new Parse.Query('StaffAssignment');
    query.equalTo('isActive', true);
    query.include(['staffId', 'supervisorId', 'ncLocationId']);
    query.descending('createdAt');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });

    // Filter out assignments for inactive staff
    const filteredResults = results.filter(obj => {
      const staffIdObj = obj.get('staffId');
      if (staffIdObj && typeof staffIdObj.get === 'function') {
        const isActive = staffIdObj.get('isActive');
        return isActive !== false; // Include if active or not set (default to active)
      }
      return true; // Include if we can't determine status
    });

    return filteredResults.map(obj => {
      const staffIdObj = obj.get('staffId');
      const supervisorIdObj = obj.get('supervisorId');
      const ncLocationIdObj = obj.get('ncLocationId');

      // Extract IDs safely - handle both Parse objects and pointers
      let staff_id = null;
      let supervisor_id = null;
      let nc_location_id = null;
      let staff_department = null;
      let supervisor_department = null;
      let manager_id = null;

      if (staffIdObj) {
        staff_id = staffIdObj.id || (typeof staffIdObj === 'string' ? staffIdObj : null);
        if (typeof staffIdObj.get === 'function') {
          staff_department = staffIdObj.get('department') || null;
        }
      }

      if (supervisorIdObj) {
        supervisor_id = supervisorIdObj.id || (typeof supervisorIdObj === 'string' ? supervisorIdObj : null);
        if (typeof supervisorIdObj.get === 'function') {
          supervisor_department = supervisorIdObj.get('department') || null;
          manager_id = supervisorIdObj.get('managerId') || null;
        }
      }

      if (ncLocationIdObj) {
        nc_location_id = ncLocationIdObj.id || (typeof ncLocationIdObj === 'string' ? ncLocationIdObj : null);
      }

      return {
        id: obj.id,
        staff_id: staff_id,
        supervisor_id: supervisor_id,
        nc_location_id: nc_location_id,
        staff_department,
        supervisor_department,
        manager_id,
        is_active: obj.get('isActive') || true,
        created_at: obj.get('createdAt') ? obj.get('createdAt').toISOString() : new Date().toISOString()
      };
    });
  } catch (error) {
    console.error('Error in fetchAssignments:', error);
    throw new Error('Failed to fetch assignments: ' + error.message);
  }
});

Parse.Cloud.define('fetchPendingApprovals', async (request) => {
  try {
    const query = new Parse.Query('Attendance');
    query.equalTo('approvalStatus', 'pending');
    query.include(['staffId', 'supervisorId', 'ncLocationId']);
    query.descending('attendanceDate');
    query.descending('createdAt');
    query.limit(USER_QUERY_LIMIT);
    const results = await query.find({ useMasterKey: true });

    // Helper function to extract name from Parse User object
    const extractUserName = (userObj) => {
      if (!userObj) return null;
      
      try {
        if (typeof userObj.get === 'function') {
          const fullName = userObj.get('fullName');
          const name = userObj.get('name');
          const username = userObj.get('username');
          const email = userObj.get('email');
          
          if (fullName && fullName.trim()) return fullName.trim();
          if (name && name.trim()) return name.trim();
          if (username && username.trim()) return username.trim();
          if (email && email.trim()) return email.trim();
        }
        
        if (typeof userObj === 'object') {
          if (userObj.fullName && userObj.fullName.trim()) return userObj.fullName.trim();
          if (userObj.name && userObj.name.trim()) return userObj.name.trim();
          if (userObj.username && userObj.username.trim()) return userObj.username.trim();
          if (userObj.email && userObj.email.trim()) return userObj.email.trim();
        }
      } catch (e) {
        console.error('Error extracting user name:', e);
      }
      
      return null;
    };

    return results.map(record => {
      const staffIdObj = record.get('staffId');
      const supervisorIdObj = record.get('supervisorId');
      const ncLocationIdObj = record.get('ncLocationId');

      const staffId = staffIdObj ? staffIdObj.id : null;
      const staffName = extractUserName(staffIdObj) || 'Unknown Staff';
      const supervisorId = supervisorIdObj ? supervisorIdObj.id : null;
      const supervisorName = extractUserName(supervisorIdObj) || 'Unknown Supervisor';
      const nc_location_id = ncLocationIdObj ? ncLocationIdObj.id : null;
      const nc_location_name = ncLocationIdObj ? (ncLocationIdObj.get('name') || 'Unknown Location') : 'Unknown Location';
      const nc = ncLocationIdObj ? (ncLocationIdObj.get('code') || 'N/A') : 'N/A';

      return {
        id: record.id,
        staff_id: staffId,
        staff_name: staffName,
        supervisor_id: supervisorId,
        supervisor_name: supervisorName,
        nc_location_id: nc_location_id,
        nc_location_name: nc_location_name,
        nc: nc,
        attendance_date: record.get('attendanceDate'),
        clock_in: record.get('clockIn') ? record.get('clockIn').toISOString() : null,
        clock_out: record.get('clockOut') ? record.get('clockOut').toISOString() : null,
        status: record.get('status') || 'absent',
        overtime: record.get('overtime') || false,
        double_duty: record.get('doubleDuty') || false,
        approval_status: record.get('approvalStatus') || 'pending',
        notes: record.get('notes') || null,
        clock_in_lat: record.get('clockInLat') || null,
        clock_in_lng: record.get('clockInLng') || null,
        clock_out_lat: record.get('clockOutLat') || null,
        clock_out_lng: record.get('clockOutLng') || null,
        clock_in_photo_url: record.get('clockInPhotoUrl') || null,
        clock_out_photo_url: record.get('clockOutPhotoUrl') || null
      };
    });
  } catch (error) {
    console.error('Error in fetchPendingApprovals:', error);
    throw new Error('Failed to fetch pending approvals: ' + error.message);
  }
});

Parse.Cloud.define('fetchAttendanceWithPhotos', async (request) => {
  try {
    const params = request.params || {};
    const {
      staffId,
      supervisorId,
      dateFrom,
      dateTo,
      limit
    } = params;

    const Attendance = Parse.Object.extend('Attendance');

    const queryClockIn = new Parse.Query(Attendance);
    queryClockIn.exists('clockInPhotoUrl');

    const queryClockOut = new Parse.Query(Attendance);
    queryClockOut.exists('clockOutPhotoUrl');

    const mainQuery = Parse.Query.or(queryClockIn, queryClockOut);

    if (staffId) {
      mainQuery.equalTo('staffId', Parse.User.createWithoutData(staffId));
    }

    if (supervisorId) {
      mainQuery.equalTo('supervisorId', Parse.User.createWithoutData(supervisorId));
    }

    if (dateFrom) {
      mainQuery.greaterThanOrEqualTo('attendanceDate', dateFrom);
    }

    if (dateTo) {
      mainQuery.lessThanOrEqualTo('attendanceDate', dateTo);
    }

    mainQuery.include(['staffId', 'supervisorId', 'approvedBy', 'ncLocationId']);
    mainQuery.descending('attendanceDate');
    mainQuery.addDescending('createdAt');
    mainQuery.limit(Math.min(limit || 1000, 1000));

    const extractUserName = (userObj) => {
      if (!userObj) return null;

      try {
        if (typeof userObj.get === 'function') {
          const fullName = userObj.get('fullName');
          const name = userObj.get('name');
          const username = userObj.get('username');
          const email = userObj.get('email');

          if (fullName && fullName.trim()) return fullName.trim();
          if (name && name.trim()) return name.trim();
          if (username && username.trim()) return username.trim();
          if (email && email.trim()) return email.trim();
        }

        if (typeof userObj === 'object') {
          if (userObj.fullName && userObj.fullName.trim()) return userObj.fullName.trim();
          if (userObj.name && userObj.name.trim()) return userObj.name.trim();
          if (userObj.username && userObj.username.trim()) return userObj.username.trim();
          if (userObj.email && userObj.email.trim()) return userObj.email.trim();
        }
      } catch (e) {
        console.error('Error extracting user name:', e);
      }

      return null;
    };

    const results = await mainQuery.find({ useMasterKey: true });

    return results.map(record => {
      const staffObj = record.get('staffId');
      const supervisorObj = record.get('supervisorId');
      const approvedByObj = record.get('approvedBy');
      const locationObj = record.get('ncLocationId');

      return {
        id: record.id,
        attendance_date: record.get('attendanceDate'),
        staff_id: staffObj ? staffObj.id : null,
        staff_name: extractUserName(staffObj) || 'Unknown Staff',
        supervisor_id: supervisorObj ? supervisorObj.id : null,
        supervisor_name: extractUserName(supervisorObj) || null,
        approved_by_id: approvedByObj ? approvedByObj.id : null,
        approved_by_name: extractUserName(approvedByObj) || null,
        approval_status: record.get('approvalStatus') || 'pending',
        status: record.get('status') || 'absent',
        overtime: record.get('overtime') || false,
        double_duty: record.get('doubleDuty') || false,
        clock_in: record.get('clockIn') ? record.get('clockIn').toISOString() : null,
        clock_out: record.get('clockOut') ? record.get('clockOut').toISOString() : null,
        clock_in_photo_url: record.get('clockInPhotoUrl') || null,
        clock_out_photo_url: record.get('ClockOutPhotoUrl') || record.get('clockOutPhotoUrl') || null,
        nc_location_id: locationObj ? locationObj.id : null,
        nc_location_name: locationObj ? (locationObj.get('name') || 'Unknown Location') : 'Unknown Location',
        nc: locationObj ? (locationObj.get('code') || 'N/A') : 'N/A',
        updated_at: record.get('updatedAt') ? record.get('updatedAt').toISOString() : null,
        created_at: record.get('createdAt') ? record.get('createdAt').toISOString() : null,
      };
    });
  } catch (error) {
    console.error('Error in fetchAttendanceWithPhotos:', error);
    throw new Error('Failed to fetch attendance with photos: ' + error.message);
  }
});

Parse.Cloud.define('approveAttendance', async (request) => {
  try {
    const { attendanceId, approvedById } = request.params;
    if (!attendanceId) {
      throw new Error('attendanceId is required');
    }

    const Attendance = Parse.Object.extend('Attendance');
    const attendance = await new Parse.Query(Attendance).get(attendanceId, { useMasterKey: true });
    
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    attendance.set('approvalStatus', 'approved');

    if (approvedById) {
      const approver = await new Parse.Query(Parse.User).get(approvedById, { useMasterKey: true });
      if (approver) {
        attendance.set('approvedBy', approver);
      }
    }

    const result = await attendance.save(null, { useMasterKey: true });
    
    return {
      id: result.id,
      approval_status: result.get('approvalStatus'),
      approved_by: result.get('approvedBy') ? result.get('approvedBy').id : null,
      updated_at: result.get('updatedAt') ? result.get('updatedAt').toISOString() : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in approveAttendance:', error);
    throw new Error('Failed to approve attendance: ' + error.message);
  }
});

Parse.Cloud.define('rejectAttendance', async (request) => {
  try {
    const { attendanceId, approvedById } = request.params;
    if (!attendanceId) {
      throw new Error('attendanceId is required');
    }

    const Attendance = Parse.Object.extend('Attendance');
    const attendance = await new Parse.Query(Attendance).get(attendanceId, { useMasterKey: true });
    
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    attendance.set('approvalStatus', 'rejected');
    attendance.set('status', 'absent');

    if (approvedById) {
      const approver = await new Parse.Query(Parse.User).get(approvedById, { useMasterKey: true });
      if (approver) {
        attendance.set('approvedBy', approver);
      }
    }

    const result = await attendance.save(null, { useMasterKey: true });
    
    return {
      id: result.id,
      approval_status: result.get('approvalStatus'),
      approved_by: result.get('approvedBy') ? result.get('approvedBy').id : null,
      updated_at: result.get('updatedAt') ? result.get('updatedAt').toISOString() : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in rejectAttendance:', error);
    throw new Error('Failed to reject attendance: ' + error.message);
  }
});

Parse.Cloud.define('fetchPerformanceReviews', async (request) => {
  try {
    const { staffId, supervisorId, date } = request.params;

    const query = new Parse.Query('PerformanceReview');
    query.include(['staffId', 'supervisorId', 'locationId']);
    query.descending('createdAt');

    if (staffId) {
      query.equalTo('staffId', Parse.User.createWithoutData(staffId));
    }

    if (supervisorId) {
      query.equalTo('supervisorId', Parse.User.createWithoutData(supervisorId));
    }

    if (date) {
      query.equalTo('date', date);
    }

    const results = await query.find({ useMasterKey: true });

    // Helper function to extract name from Parse User object
    const extractUserName = (userObj) => {
      if (!userObj) return null;
      
      try {
        if (typeof userObj.get === 'function') {
          const fullName = userObj.get('fullName');
          const name = userObj.get('name');
          const username = userObj.get('username');
          const email = userObj.get('email');
          
          if (fullName && fullName.trim()) return fullName.trim();
          if (name && name.trim()) return name.trim();
          if (username && username.trim()) return username.trim();
          if (email && email.trim()) return email.trim();
        }
      } catch (e) {
        console.error('Error extracting user name:', e);
      }
      
      return null;
    };

    return results.map(record => {
      const staffIdObj = record.get('staffId');
      const supervisorIdObj = record.get('supervisorId');
      const locationIdObj = record.get('locationId');

      return {
        id: record.id,
        staff_id: staffIdObj ? staffIdObj.id : null,
        staff_name: extractUserName(staffIdObj) || 'Unknown',
        supervisor_id: supervisorIdObj ? supervisorIdObj.id : null,
        supervisor_name: extractUserName(supervisorIdObj),
        location_id: locationIdObj ? locationIdObj.id : null,
        location_name: locationIdObj ? (locationIdObj.get('name') || locationIdObj.get('code') || 'Unknown') : null,
        date: record.get('date'),
        category: record.get('category'),
        description: record.get('description'),
        photo_path: record.get('photoPath') || null,
        photo2_path: record.get('photo2Path') || null,
        photo3_path: record.get('photo3Path') || null,
        photo4_path: record.get('photo4Path') || null,
        pdf_path: record.get('pdfPath') || null,
        status: record.get('status') || 'active',
        created_at: record.createdAt ? record.createdAt.toISOString() : null
      };
    });
  } catch (error) {
    console.error('Error in fetchPerformanceReviews:', error);
    throw new Error('Failed to fetch performance reviews: ' + error.message);
  }
});

Parse.Cloud.define('generatePerformancePDF', async (request) => {
  try {
    const {
      reportId,
      staffName,
      supervisorName,
      locationName,
      date,
      category,
      description,
      photoPaths,
    } = request.params;

    if (!reportId) {
      throw new Error('reportId is required');
    }

    const PerformanceReview = Parse.Object.extend('PerformanceReview');
    const report = await new Parse.Query(PerformanceReview).get(reportId, { useMasterKey: true });

    if (!report) {
      throw new Error('Performance review not found');
    }

    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const { Buffer } = require('buffer');

    const pdfDoc = await PDFDocument.create();
    const LANDSCAPE_A4 = [841.89, 595.28];
    let page = pdfDoc.addPage(LANDSCAPE_A4); // A4 landscape
    const { width, height } = page.getSize();

    const fonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };

    const marginX = 48;
    const topMargin = height - 60;
    const lineHeight = 16;
    const maxWidth = width - marginX * 2;

    let cursorY = topMargin;

    const ensureSpace = (lines = 1) => {
      const required = lines * lineHeight;
      if (cursorY - required < marginX) {
        page = pdfDoc.addPage(LANDSCAPE_A4);
        cursorY = topMargin;
      }
    };

    const drawLine = (text, size, options = {}) => {
      ensureSpace();
      const { x = marginX, font = fonts.regular, color = rgb(0, 0, 0) } = options;
      page.drawText(text, {
        x,
        y: cursorY,
        size,
        font,
        color,
      });
      cursorY -= lineHeight;
    };

    const wrapText = (text, font, size) => {
      const words = (text || '').split(/\s+/);
      const lines = [];
      let current = '';
      words.forEach(word => {
        const tentative = current ? `${current} ${word}` : word;
        const tentativeWidth = font.widthOfTextAtSize(tentative, size);
        if (tentativeWidth <= maxWidth) {
          current = tentative;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);
      return lines.length > 0 ? lines : [''];
    };

    drawLine('Performance Report', 20, { font: fonts.bold });
    cursorY -= 8;

    [
      `Staff: ${staffName || 'Unknown'}`,
      `Supervisor: ${supervisorName || 'N/A'}`,
      `Location: ${locationName || 'Unknown'}`,
      `Date: ${date}`,
      `Category: ${category || 'N/A'}`,
    ].forEach(entry => drawLine(entry, 12));

    cursorY -= 8;
    drawLine('Description', 14, { font: fonts.bold });
    cursorY -= 4;

    const descriptionText = (description || 'No description provided').replace(/\r\n/g, '\n');
    descriptionText.split('\n').forEach(paragraph => {
      const lines = wrapText(paragraph, fonts.regular, 12);
      lines.forEach(line => drawLine(line, 12));
      cursorY -= 4;
    });

    cursorY -= 4;
    const photosNote =
      photoPaths && photoPaths.length > 0
        ? `${photoPaths.length} photo attachment(s) included with this report.`
        : 'No photo attachments.';
    drawLine(photosNote, 12, { color: rgb(0.35, 0.35, 0.35) });

    cursorY -= 12;
    drawLine(`Generated on ${new Date().toLocaleString()}`, 10, { color: rgb(0.55, 0.55, 0.55) });

    const pdfBytes = await pdfDoc.save();
    const base64Content = Buffer.from(pdfBytes).toString('base64');
    const fileName = `perf_report_${reportId}_${date}_${Date.now()}.pdf`;

    const parseFile = new Parse.File(fileName, { base64: base64Content }, 'application/pdf');
    await parseFile.save(null, { useMasterKey: true });

    report.set('pdfPath', parseFile.url());
    await report.save(null, { useMasterKey: true });

    return {
      pdf_path: parseFile.url(),
      file_name: fileName,
    };
  } catch (error) {
    console.error('Error in generatePerformancePDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
});

Parse.Cloud.define('updatePerformanceReviewPDF', async (request) => {
  try {
    const { reportId, pdfPath } = request.params;

    if (!reportId || !pdfPath) {
      throw new Error('reportId and pdfPath are required');
    }

    const PerformanceReview = Parse.Object.extend('PerformanceReview');
    const report = await new Parse.Query(PerformanceReview).get(reportId, { useMasterKey: true });
    
    if (!report) {
      throw new Error('Performance review not found');
    }

    report.set('pdfPath', pdfPath);
    await report.save(null, { useMasterKey: true });

    return {
      id: report.id,
      pdf_path: pdfPath
    };
  } catch (error) {
    console.error('Error in updatePerformanceReviewPDF:', error);
    throw new Error('Failed to update PDF path: ' + error.message);
  }
});

Parse.Cloud.define('fetchLeaveRequests', async (request) => {
  try {
    const { staffId, status, dateFrom, dateTo } = request.params;

    const query = new Parse.Query('LeaveRequest');
    query.include(['staffId', 'supervisorId', 'approvedBy']);

    if (staffId) {
      query.equalTo('staffId', Parse.User.createWithoutData(staffId));
    }

    if (status && status !== 'all') {
      query.equalTo('status', status);
    }

    if (dateFrom) {
      query.greaterThanOrEqualTo('startDate', dateFrom);
    }

    if (dateTo) {
      query.lessThanOrEqualTo('endDate', dateTo);
    }

    query.descending('createdAt');
    const results = await query.find({ useMasterKey: true });

    // Filter out leave requests for inactive users
    const filteredResults = results.filter(record => {
      const staffIdObj = record.get('staffId');
      if (staffIdObj && typeof staffIdObj.get === 'function') {
        const isActive = staffIdObj.get('isActive');
        return isActive !== false; // Include if active or not set (default to active)
      }
      return true; // Include if we can't determine status
    });

    // Helper function to extract name from Parse User object
    const extractUserName = async (userObj, userId) => {
      if (!userObj && !userId) return null;
      
      try {
        // If we have the object, try to get name from it
        if (userObj) {
          // If it's a Parse User object with get method
          if (typeof userObj.get === 'function') {
            const fullName = userObj.get('fullName');
            const name = userObj.get('name');
            const username = userObj.get('username');
            const email = userObj.get('email');
            
            if (fullName && fullName.trim()) return fullName.trim();
            if (name && name.trim()) return name.trim();
            if (username && username.trim()) return username.trim();
            if (email && email.trim()) return email.trim();
          }
          
          // If it's a plain object
          if (typeof userObj === 'object') {
            if (userObj.fullName && userObj.fullName.trim()) return userObj.fullName.trim();
            if (userObj.name && userObj.name.trim()) return userObj.name.trim();
            if (userObj.username && userObj.username.trim()) return userObj.username.trim();
            if (userObj.email && userObj.email.trim()) return userObj.email.trim();
          }
        }
        
        // If object doesn't have name, fetch it separately using userId
        if (userId) {
          try {
            const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
            if (user) {
              const fullName = user.get('fullName');
              const name = user.get('name');
              const username = user.get('username');
              const email = user.get('email');
              
              if (fullName && fullName.trim()) return fullName.trim();
              if (name && name.trim()) return name.trim();
              if (username && username.trim()) return username.trim();
              if (email && email.trim()) return email.trim();
            }
          } catch (fetchError) {
            console.error('Error fetching user separately:', fetchError);
          }
        }
      } catch (e) {
        console.error('Error extracting user name:', e);
      }
      
      return null;
    };

    // Process results with async name extraction
    const processedResults = await Promise.all(filteredResults.map(async (leaveRequest) => {
      const staffIdObj = leaveRequest.get('staffId');
      const supervisorIdObj = leaveRequest.get('supervisorId');
      const approvedByObj = leaveRequest.get('approvedBy');

      const staffId = staffIdObj ? staffIdObj.id : null;
      const supervisorId = supervisorIdObj ? supervisorIdObj.id : null;
      const approvedById = approvedByObj ? approvedByObj.id : null;

      // Extract names using helper function (with fallback fetching)
      const staffName = await extractUserName(staffIdObj, staffId) || 'Unknown Staff';
      const supervisorName = await extractUserName(supervisorIdObj, supervisorId);
      const approvedByName = await extractUserName(approvedByObj, approvedById);

      return {
        id: leaveRequest.id,
        staff_id: staffId,
        staff_name: staffName,
        supervisor_id: supervisorId,
        supervisor_name: supervisorName,
        leave_type: leaveRequest.get('leaveType'),
        start_date: leaveRequest.get('startDate'),
        end_date: leaveRequest.get('endDate'),
        reason: leaveRequest.get('reason'),
        status: leaveRequest.get('status'),
        approved_by: approvedById,
        approved_by_name: approvedByName,
        created_at: leaveRequest.createdAt ? leaveRequest.createdAt.toISOString() : null,
        updated_at: leaveRequest.updatedAt ? leaveRequest.updatedAt.toISOString() : null
      };
    }));

    return processedResults;
  } catch (error) {
    console.error('Error in fetchLeaveRequests:', error);
    throw new Error('Failed to fetch leave requests: ' + error.message);
  }
});

Parse.Cloud.define('updateLeaveRequestStatus', async (request) => {
  try {
    const { requestId, status, approvedById } = request.params;

    if (!requestId || !status) {
      throw new Error('requestId and status are required');
    }

    // Get the leave request using master key
    const LeaveRequest = Parse.Object.extend('LeaveRequest');
    const leaveRequest = await new Parse.Query(LeaveRequest).get(requestId, { useMasterKey: true });

    if (!leaveRequest) {
      throw new Error('Leave request not found');
    }

    // Update the status
    leaveRequest.set('status', status);

    // Set approvedBy if provided
    if (approvedById) {
      const approver = await new Parse.Query(Parse.User).get(approvedById, { useMasterKey: true });
      if (approver) {
        leaveRequest.set('approvedBy', approver);
      }
    }

    // Save with master key
    const result = await leaveRequest.save(null, { useMasterKey: true });

    return {
      id: result.id,
      status: result.get('status'),
      approved_by: result.get('approvedBy') ? result.get('approvedBy').id : null,
      updated_at: result.get('updatedAt') ? result.get('updatedAt').toISOString() : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in updateLeaveRequestStatus:', error);
    throw new Error('Failed to update leave request status: ' + error.message);
  }
});

Parse.Cloud.define('clockIn', async (request) => {
  try {
    const { staff_id, supervisor_id, nc_location_id, overtime, double_duty, lat, lng, clock_in_photo_url, is_override, clocked_by_id } = request.params;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      throw new Error('staff_id, supervisor_id, and nc_location_id are required');
    }

    // Get the current user (person performing the action)
    const currentUser = request.user;
    if (!currentUser) {
      throw new Error('Authentication required');
    }

    // Get current user's role
    const currentUserRoleRaw = currentUser.get('role') || currentUser.get('userRole') || currentUser.get('roleName') || null;
    const currentUserRole = typeof currentUserRoleRaw === 'string' ? currentUserRoleRaw.trim().toLowerCase() : null;
    const isGeneralManager = currentUserRole === 'general_manager';
    const isManager = currentUserRole === 'manager';
    const isManagerOrGM = isManager || isGeneralManager;

    // Verify supervisor-location assignment using master key
    // First, get the actual Parse objects
    const [supervisor, location] = await Promise.all([
      new Parse.Query(Parse.User).get(supervisor_id, { useMasterKey: true }),
      new Parse.Query('NCLocation').get(nc_location_id, { useMasterKey: true })
    ]);

    if (!supervisor) {
      throw new Error('Supervisor not found');
    }
    if (!location) {
      throw new Error('Location not found');
    }

    // Check if location is an office location (by name or code containing "office")
    const locationName = (location.get('name') || '').toLowerCase();
    const locationCode = (location.get('code') || '').toLowerCase();
    const isOfficeLocation = locationName.includes('office') || locationCode.includes('office') || location.get('isOffice') === true;

    // Get staff object (use supervisor if clocking themselves)
    let staffObj = supervisor;
    const isSelfAction = staff_id === currentUser.id;
    
    if (staff_id !== supervisor_id) {
      staffObj = await new Parse.Query(Parse.User).get(staff_id, { useMasterKey: true });
      if (!staffObj) {
        throw new Error('Staff not found');
      }
    }

    // If Manager or GM is clocking themselves, they must be at office location
    if (isManagerOrGM && isSelfAction) {
      if (!isOfficeLocation) {
        throw new Error('Managers and General Managers must clock in at office location');
      }
      // Verify location with provided coordinates if available
      if (lat && lng && location.get('centerLat') && location.get('centerLng')) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat * Math.PI / 180;
        const φ2 = location.get('centerLat') * Math.PI / 180;
        const Δφ = (location.get('centerLat') - lat) * Math.PI / 180;
        const Δλ = (location.get('centerLng') - lng) * Math.PI / 180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        const radiusMeters = location.get('radiusMeters') || 100;
        
        if (distance > radiusMeters) {
          throw new Error('You must be at the office location to clock in');
        }
      }
    }

    // Override mode: Only General Manager can override for others
    const overrideMode = is_override === true && isGeneralManager && !isSelfAction;
    
    if (overrideMode) {
      // In override mode, skip supervisor-location assignment check
      // But still verify the staff/supervisor exists and is assigned somewhere
      if (staff_id !== supervisor_id) {
        // Check if the person being clocked in is a staff member or supervisor
        const staffRoleRaw = staffObj.get('role') || staffObj.get('userRole') || staffObj.get('roleName') || null;
        const staffRole = typeof staffRoleRaw === 'string' ? staffRoleRaw.trim().toLowerCase() : null;
        const isStaffMember = staffRole === 'staff';
        const isSupervisorRole = staffRole === 'supervisor';
        
        if (isStaffMember) {
          // For staff members, check StaffAssignment
          const staffAssignmentQuery = new Parse.Query('StaffAssignment');
          staffAssignmentQuery.equalTo('staffId', staffObj);
          staffAssignmentQuery.equalTo('isActive', true);
          const anyAssignment = await staffAssignmentQuery.first({ useMasterKey: true });
          
          if (!anyAssignment) {
            throw new Error('Staff member not found or not assigned');
          }
        } else if (isSupervisorRole) {
          // For supervisors, check SupervisorLocation
          const supervisorLocationQuery = new Parse.Query('SupervisorLocation');
          supervisorLocationQuery.equalTo('supervisorId', staffObj);
          supervisorLocationQuery.equalTo('ncLocationId', location);
          const supLoc = await supervisorLocationQuery.first({ useMasterKey: true });
          
          if (!supLoc) {
            throw new Error('Supervisor is not assigned to this location');
          }
        } else {
          // For other roles (Manager, GM, etc.), allow clock-in in override mode
          // No additional check needed
        }
      }
    } else {
      // Normal mode: verify supervisor-location assignment
      const supervisorLocationQuery = new Parse.Query('SupervisorLocation');
      supervisorLocationQuery.equalTo('supervisorId', supervisor);
      supervisorLocationQuery.equalTo('ncLocationId', location);
      const supLoc = await supervisorLocationQuery.first({ useMasterKey: true });

      if (!supLoc) {
        throw new Error('Supervisor is not assigned to this location');
      }

      // Check staff assignment (if not self-action)
      if (staff_id !== supervisor_id) {
        const staffAssignmentQuery = new Parse.Query('StaffAssignment');
        staffAssignmentQuery.equalTo('staffId', staffObj);
        staffAssignmentQuery.equalTo('supervisorId', supervisor);
        staffAssignmentQuery.equalTo('ncLocationId', location);
        staffAssignmentQuery.equalTo('isActive', true);
        const assignment = await staffAssignmentQuery.first({ useMasterKey: true });

        if (!assignment) {
          throw new Error('Staff is not assigned to this supervisor at this location');
        }
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Prevent duplicate clock-ins for the same staff member on the same day
    const existingAttendanceQuery = new Parse.Query('Attendance');
    existingAttendanceQuery.equalTo('staffId', staffObj);
    existingAttendanceQuery.equalTo('attendanceDate', todayStr);
    existingAttendanceQuery.descending('createdAt');
    const existingAttendance = await existingAttendanceQuery.first({ useMasterKey: true });

    if (existingAttendance && !existingAttendance.get('clockOut')) {
      const existingSupervisor = existingAttendance.get('supervisorId');
      const existingLocation = existingAttendance.get('ncLocationId');

      return {
        id: existingAttendance.id,
        staff_id: staff_id,
        supervisor_id: existingSupervisor ? existingSupervisor.id : supervisor_id,
        nc_location_id: existingLocation ? existingLocation.id : nc_location_id,
        attendance_date: existingAttendance.get('attendanceDate'),
        clock_in: existingAttendance.get('clockIn') ? existingAttendance.get('clockIn').toISOString() : null,
        status: existingAttendance.get('status'),
        overtime: existingAttendance.get('overtime'),
        double_duty: existingAttendance.get('doubleDuty'),
        clock_in_lat: existingAttendance.get('clockInLat'),
        clock_in_lng: existingAttendance.get('clockInLng'),
        clock_in_photo_url: existingAttendance.get('clockInPhotoUrl'),
        alreadyClockedIn: true
      };
    }

    // Get system configuration for grace period
    const systemConfig = await getSystemConfig();
    const gracePeriodMinutes = systemConfig.gracePeriodMinutes || 15;
    
    // Get location's shift start time
    let shiftStartHour = 9; // Default to 9:00 AM
    let shiftStartMinute = 0;
    
    const morningShiftStart = location.get('morningShiftStart');
    const nightShiftStart = location.get('nightShiftStart');
    
    // Parse shift start time (format: "HH:MM")
    const parseShiftTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const parts = timeStr.split(':');
      if (parts.length !== 2) return null;
      const hour = parseInt(parts[0], 10);
      const minute = parseInt(parts[1], 10);
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
      }
      return { hour, minute };
    };
    
    // Prefer morning shift, fallback to night shift, then default to 9:00 AM
    let shiftTime = null;
    if (morningShiftStart) {
      shiftTime = parseShiftTime(morningShiftStart);
    }
    if (!shiftTime && nightShiftStart) {
      shiftTime = parseShiftTime(nightShiftStart);
    }
    
    if (shiftTime) {
      shiftStartHour = shiftTime.hour;
      shiftStartMinute = shiftTime.minute;
    }
    
    // Check if clock-in is late based on grace period and location's shift start time
    const clockInDate = new Date(now);
    const clockInMinutes = clockInDate.getHours() * 60 + clockInDate.getMinutes();
    const workStartMinutes = shiftStartHour * 60 + shiftStartMinute;
    const isLate = clockInMinutes > (workStartMinutes + gracePeriodMinutes);
    
    // Create attendance record
    const Attendance = Parse.Object.extend('Attendance');
    const attendance = new Attendance();
    attendance.set('staffId', staffObj);
    attendance.set('supervisorId', supervisor);
    attendance.set('ncLocationId', location);
    attendance.set('attendanceDate', todayStr);
    attendance.set('clockIn', now);
    attendance.set('overtime', overtime || false);
    attendance.set('doubleDuty', double_duty || false);
    attendance.set('status', isLate ? 'Late' : 'Present');
    attendance.set('approvalStatus', 'pending');

    if (lat) attendance.set('clockInLat', lat);
    if (lng) attendance.set('clockInLng', lng);
    if (clock_in_photo_url) attendance.set('clockInPhotoUrl', clock_in_photo_url);

    // Store who performed the clock-in (if different from staff member)
    if (overrideMode || (!isSelfAction && isGeneralManager)) {
      attendance.set('clockedInBy', currentUser);
      attendance.set('isOverride', true);
    } else {
      attendance.set('clockedInBy', staffObj);
      attendance.set('isOverride', false);
    }

    const result = await attendance.save(null, { useMasterKey: true });

    // Get clockedBy name if available
    let clockedByName = null;
    const clockedByObj = result.get('clockedInBy');
    if (clockedByObj && clockedByObj.id !== staff_id) {
      try {
        const clockedByUser = await new Parse.Query(Parse.User).get(clockedByObj.id, { useMasterKey: true });
        clockedByName = clockedByUser ? (clockedByUser.get('fullName') || clockedByUser.get('username') || 'Unknown') : null;
      } catch (e) {
        console.error('Error fetching clockedBy name:', e);
      }
    }

    return {
      id: result.id,
      staff_id: staff_id,
      supervisor_id: supervisor_id,
      nc_location_id: nc_location_id,
      attendance_date: result.get('attendanceDate'),
      clock_in: result.get('clockIn') ? result.get('clockIn').toISOString() : null,
      status: result.get('status'),
      overtime: result.get('overtime'),
      double_duty: result.get('doubleDuty'),
      clock_in_lat: result.get('clockInLat'),
      clock_in_lng: result.get('clockInLng'),
      clock_in_photo_url: result.get('clockInPhotoUrl'),
      clocked_in_by: clockedByName,
      is_override: result.get('isOverride') || false,
      alreadyClockedIn: false
    };
  } catch (error) {
    console.error('Error in clockIn:', error);
    throw new Error('Failed to clock in: ' + error.message);
  }
});

Parse.Cloud.define('clockOut', async (request) => {
  try {
    const { staff_id, supervisor_id, nc_location_id, lat, lng, clock_out_photo_url, is_override, clocked_by_id } = request.params;

    if (!staff_id || !supervisor_id || !nc_location_id) {
      throw new Error('staff_id, supervisor_id, and nc_location_id are required');
    }

    // Get the current user (person performing the action)
    const currentUser = request.user;
    if (!currentUser) {
      throw new Error('Authentication required');
    }

    // Get current user's role
    const currentUserRoleRaw = currentUser.get('role') || currentUser.get('userRole') || currentUser.get('roleName') || null;
    const currentUserRole = typeof currentUserRoleRaw === 'string' ? currentUserRoleRaw.trim().toLowerCase() : null;
    const isGeneralManager = currentUserRole === 'general_manager';
    const isManager = currentUserRole === 'manager';
    const isManagerOrGM = isManager || isGeneralManager;

    // Verify supervisor-location assignment using master key
    // First, get the actual Parse objects
    const [supervisor, location, staff] = await Promise.all([
      new Parse.Query(Parse.User).get(supervisor_id, { useMasterKey: true }),
      new Parse.Query('NCLocation').get(nc_location_id, { useMasterKey: true }),
      new Parse.Query(Parse.User).get(staff_id, { useMasterKey: true })
    ]);

    if (!supervisor) {
      throw new Error('Supervisor not found');
    }
    if (!location) {
      throw new Error('Location not found');
    }
    if (!staff) {
      throw new Error('Staff not found');
    }

    // Check if location is an office location (by name or code containing "office")
    const locationName = (location.get('name') || '').toLowerCase();
    const locationCode = (location.get('code') || '').toLowerCase();
    const isOfficeLocation = locationName.includes('office') || locationCode.includes('office') || location.get('isOffice') === true;

    const isSelfAction = staff_id === currentUser.id;

    // If Manager or GM is clocking themselves out, they must be at office location
    if (isManagerOrGM && isSelfAction) {
      if (!isOfficeLocation) {
        throw new Error('Managers and General Managers must clock out at office location');
      }
      // Verify location with provided coordinates if available
      if (lat && lng && location.get('centerLat') && location.get('centerLng')) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat * Math.PI / 180;
        const φ2 = location.get('centerLat') * Math.PI / 180;
        const Δφ = (location.get('centerLat') - lat) * Math.PI / 180;
        const Δλ = (location.get('centerLng') - lng) * Math.PI / 180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        const radiusMeters = location.get('radiusMeters') || 100;
        
        if (distance > radiusMeters) {
          throw new Error('You must be at the office location to clock out');
        }
      }
    }

    // Override mode: Only General Manager can override for others
    const overrideMode = is_override === true && isGeneralManager && !isSelfAction;

    if (overrideMode) {
      // In override mode, skip supervisor-location assignment check
      // But still verify the staff/supervisor exists and is assigned somewhere
      // Check if the person being clocked out is a staff member or supervisor
      const staffRoleRaw = staff.get('role') || staff.get('userRole') || staff.get('roleName') || null;
      const staffRole = typeof staffRoleRaw === 'string' ? staffRoleRaw.trim().toLowerCase() : null;
      const isStaffMember = staffRole === 'staff';
      const isSupervisorRole = staffRole === 'supervisor';
      
      if (isStaffMember) {
        // For staff members, check StaffAssignment
        const staffAssignmentQuery = new Parse.Query('StaffAssignment');
        staffAssignmentQuery.equalTo('staffId', staff);
        staffAssignmentQuery.equalTo('isActive', true);
        const anyAssignment = await staffAssignmentQuery.first({ useMasterKey: true });
        
        if (!anyAssignment) {
          throw new Error('Staff member not found or not assigned');
        }
      } else if (isSupervisorRole) {
        // For supervisors, check SupervisorLocation
        const supervisorLocationQuery = new Parse.Query('SupervisorLocation');
        supervisorLocationQuery.equalTo('supervisorId', staff);
        supervisorLocationQuery.equalTo('ncLocationId', location);
        const supLoc = await supervisorLocationQuery.first({ useMasterKey: true });
        
        if (!supLoc) {
          throw new Error('Supervisor is not assigned to this location');
        }
      } else {
        // For other roles (Manager, GM, etc.), allow clock-out in override mode
        // No additional check needed
      }
    } else {
      // Normal mode: verify supervisor-location assignment
      const supervisorLocationQuery = new Parse.Query('SupervisorLocation');
      supervisorLocationQuery.equalTo('supervisorId', supervisor);
      supervisorLocationQuery.equalTo('ncLocationId', location);
      const supLoc = await supervisorLocationQuery.first({ useMasterKey: true });

      if (!supLoc) {
        throw new Error('Supervisor is not assigned to this location');
      }
    }

    // Find today's attendance record
    const today = new Date().toISOString().split('T')[0];
    const query = new Parse.Query('Attendance');
    query.equalTo('staffId', staff);
    query.equalTo('supervisorId', supervisor);
    query.equalTo('ncLocationId', location);
    query.equalTo('attendanceDate', today);
    const attendance = await query.first({ useMasterKey: true });

    if (!attendance) {
      throw new Error('No attendance record found for today');
    }

    if (attendance.get('clockOut')) {
      return {
        id: attendance.id,
        staff_id: staff_id,
        supervisor_id: supervisor_id,
        nc_location_id: nc_location_id,
        attendance_date: attendance.get('attendanceDate'),
        clock_in: attendance.get('clockIn') ? attendance.get('clockIn').toISOString() : null,
        clock_out: attendance.get('clockOut').toISOString(),
        clock_out_lat: attendance.get('clockOutLat'),
        clock_out_lng: attendance.get('clockOutLng'),
        clock_out_photo_url: attendance.get('clockOutPhotoUrl'),
        alreadyClockedOut: true
      };
    }

    // Get system configuration for minimum interval
    const systemConfig = await getSystemConfig();
    const minClockIntervalHours = systemConfig.minClockIntervalHours || 6;
    
    // Check minimum interval time (unless override mode)
    if (!overrideMode) {
      const clockInTime = attendance.get('clockIn');
      if (clockInTime) {
        const now = new Date();
        const clockIn = new Date(clockInTime);
        const timeDiffMs = now.getTime() - clockIn.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        
        if (timeDiffHours < minClockIntervalHours) {
          const remainingMinutes = Math.ceil((minClockIntervalHours - timeDiffHours) * 60);
          throw new Error(`Cannot clock out yet. Minimum interval is ${minClockIntervalHours} hours. Please wait ${remainingMinutes} more minute(s).`);
        }
      }
    }

    // Update clock out
    const clockOutTime = new Date();
    attendance.set('clockOut', clockOutTime);
    if (lat) attendance.set('clockOutLat', lat);
    if (lng) attendance.set('clockOutLng', lng);
    if (clock_out_photo_url) attendance.set('clockOutPhotoUrl', clock_out_photo_url);

    // Store who performed the clock-out (if different from staff member)
    if (overrideMode || (!isSelfAction && isGeneralManager)) {
      attendance.set('clockedOutBy', currentUser);
      // Update isOverride if not already set
      if (!attendance.get('isOverride')) {
        attendance.set('isOverride', true);
      }
    } else {
      attendance.set('clockedOutBy', staff);
      // Only set isOverride to false if it wasn't already true (from clock-in)
      if (!attendance.get('isOverride')) {
        attendance.set('isOverride', false);
      }
    }

    const result = await attendance.save(null, { useMasterKey: true });

    // Get clockedBy name if available
    let clockedOutByName = null;
    const clockedOutByObj = result.get('clockedOutBy');
    if (clockedOutByObj && clockedOutByObj.id !== staff_id) {
      try {
        const clockedOutByUser = await new Parse.Query(Parse.User).get(clockedOutByObj.id, { useMasterKey: true });
        clockedOutByName = clockedOutByUser ? (clockedOutByUser.get('fullName') || clockedOutByUser.get('username') || 'Unknown') : null;
      } catch (e) {
        console.error('Error fetching clockedOutBy name:', e);
      }
    }

    return {
      id: result.id,
      staff_id: staff_id,
      supervisor_id: supervisor_id,
      nc_location_id: nc_location_id,
      clock_out: result.get('clockOut') ? result.get('clockOut').toISOString() : null,
      clock_out_lat: result.get('clockOutLat'),
      clock_out_lng: result.get('clockOutLng'),
      clock_out_photo_url: result.get('clockOutPhotoUrl'),
      clocked_out_by: clockedOutByName,
      is_override: result.get('isOverride') || false,
      alreadyClockedOut: false
    };
  } catch (error) {
    console.error('Error in clockOut:', error);
    throw new Error('Failed to clock out: ' + error.message);
  }
});

// Helper function to get system configuration
async function getSystemConfig() {
  try {
    const SystemConfig = Parse.Object.extend('SystemConfig');
    const query = new Parse.Query(SystemConfig);
    query.equalTo('configKey', 'attendance_settings');
    const config = await query.first({ useMasterKey: true });
    
    if (!config) {
      // Return default values if config doesn't exist
      return {
        gracePeriodMinutes: 15, // Default 15 minutes grace period
        minClockIntervalHours: 6 // Default 6 hours minimum interval
      };
    }
    
    return {
      gracePeriodMinutes: config.get('gracePeriodMinutes') || 15,
      minClockIntervalHours: config.get('minClockIntervalHours') || 6
    };
  } catch (error) {
    console.error('Error fetching system config:', error);
    // Return defaults on error
    return {
      gracePeriodMinutes: 15,
      minClockIntervalHours: 6
    };
  }
}

// Get system configuration (read-only for all authenticated users)
Parse.Cloud.define('getSystemConfig', async (request) => {
  try {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    
    return await getSystemConfig();
  } catch (error) {
    console.error('Error in getSystemConfig:', error);
    throw new Error('Failed to get system configuration: ' + error.message);
  }
});

// Update system configuration (CEO/SuperAdmin only)
Parse.Cloud.define('updateSystemConfig', async (request) => {
  try {
    const { gracePeriodMinutes, minClockIntervalHours } = request.params;
    
    if (!request.user) {
      throw new Error('Authentication required');
    }
    
    // Check if user is CEO or SuperAdmin
    const currentUserRoleRaw = request.user.get('role') || request.user.get('userRole') || request.user.get('roleName') || null;
    const currentUserRole = typeof currentUserRoleRaw === 'string' ? currentUserRoleRaw.trim().toLowerCase() : null;
    
    if (currentUserRole !== 'ceo' && currentUserRole !== 'super_admin') {
      throw new Error('Only CEO and SuperAdmin can update system configuration');
    }
    
    // Validate inputs
    if (gracePeriodMinutes !== undefined && gracePeriodMinutes !== null) {
      const graceMinutes = parseInt(gracePeriodMinutes, 10);
      if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 1440) {
        throw new Error('Grace period must be between 0 and 1440 minutes (24 hours)');
      }
    }
    
    if (minClockIntervalHours !== undefined && minClockIntervalHours !== null) {
      const intervalHours = parseFloat(minClockIntervalHours);
      if (isNaN(intervalHours) || intervalHours < 0 || intervalHours > 24) {
        throw new Error('Minimum clock interval must be between 0 and 24 hours');
      }
    }
    
    // Get or create system config
    const SystemConfig = Parse.Object.extend('SystemConfig');
    const query = new Parse.Query(SystemConfig);
    query.equalTo('configKey', 'attendance_settings');
    let config = await query.first({ useMasterKey: true });
    
    if (!config) {
      config = new SystemConfig();
      config.set('configKey', 'attendance_settings');
    }
    
    // Update values
    if (gracePeriodMinutes !== undefined && gracePeriodMinutes !== null) {
      config.set('gracePeriodMinutes', parseInt(gracePeriodMinutes, 10));
    }
    
    if (minClockIntervalHours !== undefined && minClockIntervalHours !== null) {
      config.set('minClockIntervalHours', parseFloat(minClockIntervalHours));
    }
    
    // Save with master key
    await config.save(null, { useMasterKey: true });
    
    return {
      success: true,
      gracePeriodMinutes: config.get('gracePeriodMinutes'),
      minClockIntervalHours: config.get('minClockIntervalHours')
    };
  } catch (error) {
    console.error('Error in updateSystemConfig:', error);
    throw new Error('Failed to update system configuration: ' + error.message);
  }
});

Parse.Cloud.define('generateAttendanceReport', async (request) => {
  try {
    const { dateFrom, dateTo, supervisorId, areaId, status } = request.params || {};

    if (!dateFrom || !dateTo) {
      return [];
    }

    // Get system configuration for grace period
    const systemConfig = await getSystemConfig();
    const gracePeriodMinutes = systemConfig.gracePeriodMinutes || 15;
    const SHIFT_END_MINUTES = 17 * 60; // 05:00 PM
    
    // Helper function to parse shift time from "HH:MM" format
    const parseShiftTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const parts = timeStr.split(':');
      if (parts.length !== 2) return null;
      const hour = parseInt(parts[0], 10);
      const minute = parseInt(parts[1], 10);
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
      }
      return { hour, minute };
    };
    
    // Helper function to get shift start time in minutes from midnight for a location
    const getLocationShiftStartMinutes = (locationObj) => {
      if (!locationObj) {
        // Default to 9:00 AM if no location
        return 9 * 60;
      }
      
      let shiftTime = null;
      
      // Try to get shift time from location object
      if (typeof locationObj.get === 'function') {
        const morningShiftStart = locationObj.get('morningShiftStart');
        const nightShiftStart = locationObj.get('nightShiftStart');
        
        if (morningShiftStart) {
          shiftTime = parseShiftTime(morningShiftStart);
        }
        if (!shiftTime && nightShiftStart) {
          shiftTime = parseShiftTime(nightShiftStart);
        }
      }
      
      if (shiftTime) {
        return shiftTime.hour * 60 + shiftTime.minute;
      }
      
      // Default to 9:00 AM if no shift time is configured
      return 9 * 60;
    };

    const toDateUTC = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') {
        return null;
      }
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) {
        return null;
      }
      return new Date(Date.UTC(year, month - 1, day));
    };

    const formatDate = (dateObj) => {
      if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
        return null;
      }
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const buildDateRange = (startStr, endStr) => {
      const start = toDateUTC(startStr);
      const end = toDateUTC(endStr);
      if (!start || !end || start > end) {
        return [];
      }
      const dates = [];
      const cursor = new Date(start.getTime());
      while (cursor <= end) {
        dates.push(formatDate(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return dates;
    };

    const extractUserName = (userObj) => {
      if (!userObj) return null;
      const fields = ['fullName', 'full_name', 'name', 'username', 'email'];
      try {
        if (typeof userObj.get === 'function') {
          for (const field of fields) {
            const value = userObj.get(field);
            if (value && typeof value === 'string' && value.trim()) {
              return value.trim();
            }
          }
        } else if (typeof userObj === 'object') {
          for (const field of fields) {
            const value = userObj[field];
            if (value && typeof value === 'string' && value.trim()) {
              return value.trim();
            }
          }
        }
      } catch (nameError) {
        console.error('Error extracting user name:', nameError);
      }
      return null;
    };

    const extractEmpNo = (userObj) => {
      if (!userObj) return null;
      try {
        if (typeof userObj.get === 'function') {
          const empNo = userObj.get('empNo');
          if (empNo !== null && empNo !== undefined) {
            return String(empNo).trim();
          }
        } else if (typeof userObj === 'object') {
          const empNo = userObj.empNo || userObj.emp_no;
          if (empNo !== null && empNo !== undefined) {
            return String(empNo).trim();
          }
        }
      } catch (empNoError) {
        console.error('Error extracting empNo:', empNoError);
      }
      return null;
    };

    const extractRole = (userObj) => {
      if (!userObj) return null;
      try {
        if (typeof userObj.get === 'function') {
          return userObj.get('role') || null;
        } else if (typeof userObj === 'object') {
          return userObj.role || null;
        }
      } catch (error) {
        console.error('Error extracting role:', error);
      }
      return null;
    };

    const extractDepartment = (userObj) => {
      if (!userObj) return null;
      try {
        if (typeof userObj.get === 'function') {
          return userObj.get('empDeptt') || null;
        } else if (typeof userObj === 'object') {
          return userObj.empDeptt || null;
        }
      } catch (error) {
        console.error('Error extracting department:', error);
      }
      return null;
    };

    const extractLocationName = (locationObj) => {
      if (!locationObj) return null;
      try {
        if (typeof locationObj.get === 'function') {
          const name = locationObj.get('name');
          if (name && typeof name === 'string' && name.trim()) {
            return name.trim();
          }
        } else if (typeof locationObj === 'object') {
          const name = locationObj.name || locationObj.locationName;
          if (name && typeof name === 'string' && name.trim()) {
            return name.trim();
          }
        }
      } catch (locationError) {
        console.error('Error extracting location name:', locationError);
      }
      return null;
    };

    const minutesFromIso = (isoString) => {
      if (!isoString) return null;
      const dateObj = new Date(isoString);
      if (Number.isNaN(dateObj.getTime())) return null;
      return dateObj.getHours() * 60 + dateObj.getMinutes();
    };

    const matchesFilters = (recordSupervisorId, recordLocationId) => {
      const supervisorMatch = !supervisorId || supervisorId === 'all' || recordSupervisorId === supervisorId;
      const areaMatch = !areaId || areaId === 'all' || recordLocationId === areaId;
      return supervisorMatch && areaMatch;
    };

    const dateRange = buildDateRange(dateFrom, dateTo);
    const dateSet = new Set(dateRange);

    const Attendance = Parse.Object.extend('Attendance');
    const attendanceQuery = new Parse.Query(Attendance);
    attendanceQuery.greaterThanOrEqualTo('attendanceDate', dateFrom);
    attendanceQuery.lessThanOrEqualTo('attendanceDate', dateTo);

    if (supervisorId && supervisorId !== 'all') {
      attendanceQuery.equalTo('supervisorId', Parse.User.createWithoutData(supervisorId));
    }

    if (areaId && areaId !== 'all') {
      const Location = Parse.Object.extend('NCLocation');
      attendanceQuery.equalTo('ncLocationId', Location.createWithoutData(areaId));
    }

    attendanceQuery.include(['staffId', 'supervisorId', 'ncLocationId']);
    attendanceQuery.descending('attendanceDate');
    const attendanceResults = await attendanceQuery.find({ useMasterKey: true });

    const attendanceMap = new Map();
    const finalRecords = [];

    attendanceResults.forEach((record) => {
      const staffObj = record.get('staffId');
      const supervisorObj = record.get('supervisorId');
      const locationObj = record.get('ncLocationId');

      const staffId = staffObj ? staffObj.id : null;
      const supervisorIdValue = supervisorObj ? supervisorObj.id : null;
      const locationIdValue = locationObj ? locationObj.id : null;

      const attendanceDate = record.get('attendanceDate');

      const baseRecord = {
        id: record.id,
        staffId,
        empNo: extractEmpNo(staffObj),
        role: extractRole(staffObj),
        department: extractDepartment(staffObj),
        supervisorId: supervisorIdValue,
        locationId: locationIdValue,
        locationObj: locationObj, // Store location object for shift time lookup
        staffName: extractUserName(staffObj) || 'Unknown Staff',
        supervisorName: extractUserName(supervisorObj) || 'Unknown Supervisor',
        locationName: extractLocationName(locationObj) || 'Unknown Area',
        attendance_date: attendanceDate,
        clock_in: record.get('clockIn') ? record.get('clockIn').toISOString() : null,
        clock_out: record.get('clockOut') ? record.get('clockOut').toISOString() : null,
        status: record.get('status') || null,
        rawStatus: record.get('status') || null,
        overtime: record.get('overtime') || false,
        double_duty: record.get('doubleDuty') || false,
        approval_status: record.get('approvalStatus') || 'pending',
        notes: record.get('notes') || '',
      };

      finalRecords.push(baseRecord);
      if (staffId && attendanceDate) {
        attendanceMap.set(`${staffId}-${attendanceDate}`, baseRecord);
      }
    });

    const Assignment = Parse.Object.extend('StaffAssignment');
    const assignmentQuery = new Parse.Query(Assignment);
    assignmentQuery.equalTo('isActive', true);
    assignmentQuery.include(['staffId', 'supervisorId', 'ncLocationId']);
    const assignmentResults = await assignmentQuery.find({ useMasterKey: true });

    const allAssignmentInfo = new Map();
    const relevantAssignments = [];

    assignmentResults.forEach((assignment) => {
      const staffObj = assignment.get('staffId');
      const supervisorObj = assignment.get('supervisorId');
      const locationObj = assignment.get('ncLocationId');

      const staffId = staffObj ? staffObj.id : null;
      const supervisorIdValue = supervisorObj ? supervisorObj.id : null;
      const locationIdValue = locationObj ? locationObj.id : null;

      if (!staffId) {
        return;
      }

      const info = {
        staffId,
        empNo: extractEmpNo(staffObj),
        role: extractRole(staffObj),
        department: extractDepartment(staffObj),
        staffName: extractUserName(staffObj) || 'Unknown Staff',
        supervisorId: supervisorIdValue,
        supervisorName: extractUserName(supervisorObj) || 'Unknown Supervisor',
        locationId: locationIdValue,
        locationObj: locationObj, // Store location object for shift time lookup
        locationName: extractLocationName(locationObj) || 'Unknown Area',
      };

      allAssignmentInfo.set(staffId, info);

      if (matchesFilters(info.supervisorId, info.locationId)) {
        relevantAssignments.push(info);
      }
    });

    finalRecords.forEach((record) => {
      if (!record.staffId) return;
      const assignmentInfo = allAssignmentInfo.get(record.staffId);
      if (!assignmentInfo) return;
      if (!record.empNo) {
        record.empNo = assignmentInfo.empNo;
      }
      if (!record.role) {
        record.role = assignmentInfo.role;
      }
      if (!record.department) {
        record.department = assignmentInfo.department;
      }
      if (!record.staffName || record.staffName === 'Unknown Staff') {
        record.staffName = assignmentInfo.staffName;
      }
      if (!record.supervisorId) {
        record.supervisorId = assignmentInfo.supervisorId;
      }
      if (!record.supervisorName || record.supervisorName === 'Unknown Supervisor') {
        record.supervisorName = assignmentInfo.supervisorName;
      }
      if (!record.locationId) {
        record.locationId = assignmentInfo.locationId;
      }
      if (!record.locationName || record.locationName === 'Unknown Area') {
        record.locationName = assignmentInfo.locationName;
      }
      if (!record.locationObj && assignmentInfo.locationObj) {
        record.locationObj = assignmentInfo.locationObj;
      }
    });

    const LeaveRequest = Parse.Object.extend('LeaveRequest');
    const leaveQuery = new Parse.Query(LeaveRequest);
    leaveQuery.equalTo('status', 'approved');
    leaveQuery.lessThanOrEqualTo('startDate', dateTo);
    leaveQuery.greaterThanOrEqualTo('endDate', dateFrom);
    leaveQuery.include('staffId');
    const leaveResults = await leaveQuery.find({ useMasterKey: true });

    leaveResults.forEach((leave) => {
      const staffObj = leave.get('staffId');
      const staffId = staffObj ? staffObj.id : null;
      if (!staffId) return;

      const assignmentInfo = allAssignmentInfo.get(staffId);
      if (!assignmentInfo || !matchesFilters(assignmentInfo.supervisorId, assignmentInfo.locationId)) {
        return;
      }

      const leaveStart = leave.get('startDate');
      const leaveEnd = leave.get('endDate');
      if (!leaveStart || !leaveEnd) return;

      const rangeStart = leaveStart < dateFrom ? dateFrom : leaveStart;
      const rangeEnd = leaveEnd > dateTo ? dateTo : leaveEnd;
      const leaveDates = buildDateRange(rangeStart, rangeEnd);

      leaveDates.forEach((dateStr) => {
        if (!dateSet.has(dateStr)) return;
        const key = `${staffId}-${dateStr}`;
        if (attendanceMap.has(key)) return;

        const leaveType = leave.get('leaveType') || leave.get('type') || 'Leave';

        const leaveRecord = {
          id: `leave-${leave.id}-${dateStr}`,
          staffId,
          empNo: assignmentInfo.empNo || extractEmpNo(staffObj),
          role: assignmentInfo.role || extractRole(staffObj),
          department: assignmentInfo.department || extractDepartment(staffObj),
          staffName: assignmentInfo.staffName || extractUserName(staffObj) || 'Unknown Staff',
          supervisorId: assignmentInfo.supervisorId,
          supervisorName: assignmentInfo.supervisorName || 'Unknown Supervisor',
          locationId: assignmentInfo.locationId,
          locationName: assignmentInfo.locationName || 'Unknown Area',
          attendance_date: dateStr,
          clock_in: null,
          clock_out: null,
          status: 'on-leave',
          rawStatus: 'On Leave',
          overtime: false,
          double_duty: false,
          approval_status: 'approved',
          notes: `${leaveType} leave`,
        };

        finalRecords.push(leaveRecord);
        attendanceMap.set(key, leaveRecord);
      });
    });

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const shouldMarkAbsent = (dateStr) => {
      if (dateStr < currentDateStr) return true;
      if (dateStr === currentDateStr) {
        return currentMinutes >= SHIFT_END_MINUTES;
      }
      return false;
    };

    relevantAssignments.forEach((assignment) => {
      if (!assignment.staffId) return;
      dateRange.forEach((dateStr) => {
        const key = `${assignment.staffId}-${dateStr}`;
        if (attendanceMap.has(key)) return;
        if (!shouldMarkAbsent(dateStr)) return;

        const absentRecord = {
          id: `absent-${assignment.staffId}-${dateStr}`,
          staffId: assignment.staffId,
          empNo: assignment.empNo,
          role: assignment.role,
          department: assignment.department,
          staffName: assignment.staffName || 'Unknown Staff',
          supervisorId: assignment.supervisorId,
          supervisorName: assignment.supervisorName || 'Unknown Supervisor',
          locationId: assignment.locationId,
          locationName: assignment.locationName || 'Unknown Area',
          attendance_date: dateStr,
          clock_in: null,
          clock_out: null,
          status: 'absent',
          rawStatus: 'Absent',
          overtime: false,
          double_duty: false,
          approval_status: 'approved',
          notes: '',
        };

        finalRecords.push(absentRecord);
        attendanceMap.set(key, absentRecord);
      });
    });

    finalRecords.forEach((record) => {
      if (record.approval_status && record.approval_status.toLowerCase() === 'rejected') {
        record.status = 'absent';
        return;
      }

      if (record.status === 'on-leave') {
        record.status = 'on-leave';
        return;
      }

      const normalized = record.status
        ? record.status.toString().trim().toLowerCase().replace(/\s+/g, '-')
        : null;

      if (normalized === 'on-leave') {
        record.status = 'on-leave';
        return;
      }

      const clockMinutes = minutesFromIso(record.clock_in);
      if (clockMinutes !== null) {
        // Get location-specific shift start time
        const locationShiftStartMinutes = getLocationShiftStartMinutes(record.locationObj);
        const lateThresholdMinutes = locationShiftStartMinutes + gracePeriodMinutes;
        record.status = clockMinutes > lateThresholdMinutes ? 'late' : 'present';
        return;
      }

      if (normalized && ['present', 'late', 'absent', 'on-leave'].includes(normalized)) {
        record.status = normalized;
      } else {
        record.status = 'absent';
      }
    });

    let response = finalRecords.filter((record) => matchesFilters(record.supervisorId, record.locationId));

    if (status && status !== 'all') {
      const normalizedStatus = status.toString().trim().toLowerCase();
      response = response.filter((record) => record.status === normalizedStatus);
    }

    const result = response
      .map((record) => ({
        id: record.id,
        staff_id: record.staffId || null,
        emp_no: record.empNo || null,
        role: record.role || null,
        department: record.department || null,
        staff_name: record.staffName || 'Unknown Staff',
        supervisor_id: record.supervisorId || null,
        supervisor_name: record.supervisorName || 'Unknown Supervisor',
        area_id: record.locationId || null,
        area_name: record.locationName || 'Unknown Area',
        attendance_date: record.attendance_date,
        clock_in: record.clock_in,
        clock_out: record.clock_out,
        status: record.status,
        raw_status: record.rawStatus || null,
        overtime: !!record.overtime,
        double_duty: !!record.double_duty,
        approval_status: record.approval_status || 'pending',
        notes: record.notes || '',
      }))
      .sort((a, b) => {
        const dateComparison = b.attendance_date.localeCompare(a.attendance_date);
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return (a.staff_name || '').localeCompare(b.staff_name || '');
      });

    return result;
  } catch (error) {
    console.error('Error in generateAttendanceReport:', error);
    throw new Error('Failed to generate attendance report: ' + error.message);
  }
});

Parse.Cloud.define('fetchActiveLiveLocations', async (request) => {
  const today = new Date().toISOString().split('T')[0];

  const query = new Parse.Query('LiveTracking');
  query.equalTo('date', today);
  query.equalTo('isActive', true);
  query.include('staffId');
  query.limit(1000); // adjust if you expect >1000 records

  try {
    const results = await query.find({ useMasterKey: true });
    
    // Filter out tracking for inactive users
    const filteredResults = results.filter(tracking => {
      const staff = tracking.get('staffId');
      if (staff && typeof staff.get === 'function') {
        const isActive = staff.get('isActive');
        return isActive !== false; // Include if active or not set (default to active)
      }
      return true; // Include if we can't determine status
    });
    
    const mapped = filteredResults
      .map((tracking) => {
        const staff = tracking.get('staffId');
        const latitude = tracking.get('currentLat');
        const longitude = tracking.get('currentLng');

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return null;
        }

        const userId = staff ? staff.id : tracking.get('staffId');
        const staffName =
          (staff && typeof staff.get === 'function' && staff.get('fullName')) ||
          tracking.get('staffName') ||
          'Unknown Staff';

        return {
          id: tracking.id,
          user_id: userId,
          staffId: userId,
          name: staffName,
          staffName,
          latitude,
          longitude,
          timestamp: tracking.get('lastUpdate'),
          status: tracking.get('status') || (tracking.get('isActive') ? 'active' : 'inactive'),
          speed: tracking.get('currentSpeed'),
        };
      })
      .filter(Boolean);

    const requester = request.user;
    if (!requester) {
      return [];
    }

    const role =
      requester.get('role') ||
      requester.get('userRole') ||
      requester.get('roleName') ||
      null;

    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : null;
    const hasOrgWideVisibility = ['admin', 'manager', 'general_manager', 'ceo', 'super_admin'].includes(normalizedRole);

    if (hasOrgWideVisibility) {
      return mapped;
    }

    const requesterId = requester.id;
    return mapped.filter((item) => item.user_id === requesterId);
  } catch (error) {
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      `Failed to fetch live locations: ${error.message}`
    );
  }
});

const normalizeUserRole = (role) => {
  if (typeof role !== 'string' || !role.trim()) {
    return 'staff';
  }
  return role.trim().toLowerCase();
};

const mapRoleToHierarchy = (role) => {
  const normalized = normalizeUserRole(role);

  switch (normalized) {
    case 'admin':
    case 'administrator':
    case 'super admin':
    case 'super_admin':
    case 'root':
      return 'super_admin';

    case 'ceo':
    case 'chief executive officer':
      return 'ceo';

    case 'general manager':
    case 'general_manager':
    case 'hod':
    case 'hod_general':
      return 'general_manager';

    case 'manager':
    case 'area_manager':
      return 'manager';

    case 'supervisor':
    case 'team_lead':
      return 'supervisor';

    case 'staff':
    case 'agent':
    default:
      return 'staff';
  }
};

Parse.Cloud.define('migrateUserRoles', async (request) => {
  const params = request.params || {};
  const dryRun = params.dryRun === true;
  const batchSize = Math.min(Math.max(params.batchSize || 500, 1), 1000);

  let skip = 0;
  let updated = 0;
  let processed = 0;
  let iterations = 0;
  const changes = [];

  while (true) {
    const query = new Parse.Query(Parse.User);
    query.limit(batchSize);
    query.skip(skip);

    const users = await query.find({ useMasterKey: true });
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      processed += 1;
      const existingRole = user.get('role');
      const mappedRole = mapRoleToHierarchy(existingRole);

      if (mappedRole !== normalizeUserRole(existingRole)) {
        changes.push({
          userId: user.id,
          previousRole: existingRole || null,
          newRole: mappedRole,
        });

        if (!dryRun) {
          user.set('role', mappedRole);
          await user.save(null, { useMasterKey: true });
        }

        updated += 1;
      }
    }

    skip += users.length;
    iterations += 1;

    if (users.length < batchSize) {
      break;
    }
  }

  return {
    dryRun,
    processed,
    updated,
    iterations,
    sampleChanges: changes.slice(0, 20),
  };
});

const ensureLeadershipAccess = (user) => {
  if (!user) {
    throw new Error('Authentication required');
  }
  const rawRole = user.get('role') || user.get('userRole') || user.get('roleName') || null;
  const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : null;
  if (!['super_admin', 'ceo'].includes(normalizedRole)) {
    throw new Error('Insufficient auth.');
  }
  return normalizedRole;
};

Parse.Cloud.define('createUserWithRole', async (request) => {
  const executor = request.user;
  ensureLeadershipAccess(executor);

  const { 
    email, 
    password, 
    fullName, 
    role,
    empNo,
    empCnic,
    empFname,
    empDeptt,
    empJob,
    empGrade,
    empCell1,
    empCell2,
    empFlg,
    empMarried,
    empGender
  } = request.params || {};
  
  if (!email || !password || !role) {
    throw new Error('email, password, and role are required');
  }

  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : role;

  try {
    const user = new Parse.User();
    user.set('username', email);
    user.set('email', email);
    user.set('password', password);
    user.set('fullName', fullName || email);
    user.set('role', normalizedRole);

    // Set employee fields if provided
    if (empNo !== undefined && empNo !== null) user.set('empNo', empNo);
    if (empCnic !== undefined && empCnic !== null) user.set('empCnic', empCnic);
    if (empFname !== undefined && empFname !== null) user.set('empFname', empFname);
    if (empDeptt !== undefined && empDeptt !== null) user.set('empDeptt', empDeptt);
    if (empJob !== undefined && empJob !== null) user.set('empJob', empJob);
    if (empGrade !== undefined && empGrade !== null) user.set('empGrade', empGrade);
    if (empCell1 !== undefined && empCell1 !== null) user.set('empCell1', empCell1);
    if (empCell2 !== undefined && empCell2 !== null) user.set('empCell2', empCell2);
    if (empFlg !== undefined && empFlg !== null) user.set('empFlg', empFlg);
    if (empMarried !== undefined && empMarried !== null) user.set('empMarried', empMarried);
    if (empGender !== undefined && empGender !== null) user.set('empGender', empGender);

    // Also set department field for backward compatibility if empDeptt is provided
    if (empDeptt !== undefined && empDeptt !== null && empDeptt !== '') {
      user.set('department', empDeptt);
    }

    // Set isActive to true by default for new users
    user.set('isActive', true);

    // Create user with master key (no need to restore session - not memory-safe in server)
    const result = await user.signUp(null, { useMasterKey: true });

    return {
      success: true,
      user_id: result.id,
      email: result.get('email'),
      role: result.get('role'),
      full_name: result.get('fullName'),
      emp_no: result.get('empNo') || null,
      emp_cnic: result.get('empCnic') || null,
      emp_fname: result.get('empFname') || null,
      emp_deptt: result.get('empDeptt') || null,
      emp_job: result.get('empJob') || null,
      emp_grade: result.get('empGrade') || null,
      emp_cell1: result.get('empCell1') || null,
      emp_cell2: result.get('empCell2') || null,
      emp_flg: result.get('empFlg') || null,
      emp_married: result.get('empMarried') || null,
      emp_gender: result.get('empGender') || null,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Failed to create user');
  }
});

Parse.Cloud.define('updateUserRole', async (request) => {
  const executor = request.user;
  ensureLeadershipAccess(executor);

  const { userId, role } = request.params || {};

  if (!userId || !role) {
    throw new Error('userId and role are required');
  }

  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : role;

  try {
    const targetUser = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
    if (!targetUser) {
      throw new Error('User not found');
    }

    targetUser.set('role', normalizedRole);
    await targetUser.save(null, { useMasterKey: true });

    return {
      success: true,
      user_id: targetUser.id,
      role: targetUser.get('role'),
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error(error.message || 'Failed to update role');
  }
});

Parse.Cloud.define('updateUserInfo', async (request) => {
  const executor = request.user;
  ensureLeadershipAccess(executor);

  const { 
    userId,
    fullName,
    role,
    empNo,
    empCnic,
    empFname,
    empDeptt,
    empJob,
    empGrade,
    empCell1,
    empCell2,
    empFlg,
    empMarried,
    empGender,
    password,
    isActive
  } = request.params || {};

  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    const targetUser = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Update fields (email is excluded - cannot be changed)
    if (fullName !== undefined && fullName !== null) {
      targetUser.set('fullName', fullName);
    }

    if (role !== undefined && role !== null) {
      const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : role;
      targetUser.set('role', normalizedRole);
    }

    // Update employee fields
    if (empNo !== undefined) targetUser.set('empNo', empNo || null);
    if (empCnic !== undefined) targetUser.set('empCnic', empCnic || null);
    if (empFname !== undefined) targetUser.set('empFname', empFname || null);
    if (empDeptt !== undefined) {
      targetUser.set('empDeptt', empDeptt || null);
      // Also update department for backward compatibility
      if (empDeptt && empDeptt !== '') {
        targetUser.set('department', empDeptt);
      } else if (empDeptt === null || empDeptt === '') {
        targetUser.unset('department');
      }
    }
    if (empJob !== undefined) targetUser.set('empJob', empJob || null);
    if (empGrade !== undefined) targetUser.set('empGrade', empGrade || null);
    if (empCell1 !== undefined) targetUser.set('empCell1', empCell1 || null);
    if (empCell2 !== undefined) targetUser.set('empCell2', empCell2 || null);
    if (empFlg !== undefined) targetUser.set('empFlg', empFlg || null);
    if (empMarried !== undefined) targetUser.set('empMarried', empMarried || null);
    if (empGender !== undefined) targetUser.set('empGender', empGender || null);

    // Update password if provided
    if (password !== undefined && password !== null && password !== '') {
      targetUser.set('password', password);
    }

    // Update isActive status if provided
    if (isActive !== undefined) {
      targetUser.set('isActive', isActive === true || isActive === 'true');
    }

    await targetUser.save(null, { useMasterKey: true });

    return {
      success: true,
      user_id: targetUser.id,
      email: targetUser.get('email'), // Email cannot be changed, return existing
      role: targetUser.get('role'),
      full_name: targetUser.get('fullName'),
      emp_no: targetUser.get('empNo') || null,
      emp_cnic: targetUser.get('empCnic') || null,
      emp_fname: targetUser.get('empFname') || null,
      emp_deptt: targetUser.get('empDeptt') || null,
      emp_job: targetUser.get('empJob') || null,
      emp_grade: targetUser.get('empGrade') || null,
      emp_cell1: targetUser.get('empCell1') || null,
      emp_cell2: targetUser.get('empCell2') || null,
      emp_flg: targetUser.get('empFlg') || null,
      emp_married: targetUser.get('empMarried') || null,
      emp_gender: targetUser.get('empGender') || null,
      is_active: targetUser.get('isActive') !== false, // Default to true if not set
    };
  } catch (error) {
    console.error('Error updating user info:', error);
    throw new Error(error.message || 'Failed to update user info');
  }
});

Parse.Cloud.define('seedTestUsers', async (request) => {
  const executorRole = ensureLeadershipAccess(request.user);
  const { count = 60, role = 'staff', prefix = 'testuser', password = 'TestPass123!' } = request.params || {};

  const parsedCount = parseInt(count, 10);
  const safeCount = Math.max(1, Math.min(Number.isNaN(parsedCount) ? 60 : parsedCount, 500));
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'staff';

  const baseTimestamp = Date.now();
  let created = 0;
  const createdEmails = [];

  for (let i = 0; i < safeCount; i += 1) {
    const suffix = `${baseTimestamp + i}_${Math.floor(Math.random() * 1000)}`;
    const email = `${prefix}_${suffix}@example.com`;

    const user = new Parse.User();
    user.set('username', email);
    user.set('email', email);
    user.set('password', password);
    user.set('fullName', `Test User ${suffix}`);
    user.set('role', normalizedRole);

    try {
      await user.signUp(null, { useMasterKey: true });
      created += 1;
      createdEmails.push(email);
    } catch (error) {
      if (error && error.code === 202) {
        continue;
      }
      console.error('Failed to create test user:', error);
      throw new Error('Failed to create test users: ' + error.message);
    }
  }

  return {
    success: true,
    requested: safeCount,
    created,
    emails: createdEmails,
  };
});