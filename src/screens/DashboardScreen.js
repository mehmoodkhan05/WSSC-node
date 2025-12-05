import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { PARSE_CLASSES } from '../lib/apiClient';
import { getProfile } from '../lib/auth';
import apiClient from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import {
  ROLE,
  normalizeRole,
  hasManagementPrivileges,
  hasFullControl,
  hasFieldLeadershipPrivileges,
} from '../lib/roles';

// Role-based dashboard components
import AdminDashboard from '../components/dashboard/AdminDashboard';
import SupervisorDashboard from '../components/dashboard/SupervisorDashboard';
import StaffDashboard from '../components/dashboard/StaffDashboard';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import LogoFillLoader from '../components/LogoFillLoader';
import { ALL_DEPARTMENTS_OPTION, DEPARTMENTS, getDepartmentLabel } from '../lib/departments';
import { getDashboardStats, getStatsByRoleAndDepartment, fetchTodayLeaveRequests } from '../lib/dashboard';
import { fetchStaff, fetchSupervisors, fetchProfiles } from '../lib/staff';
import { fetchLocations } from '../lib/locations';
import { fetchAssignments } from '../lib/assignments';
import { fetchTodayAttendance } from '../lib/attendance';

// Define AttendanceRecord type (simplified for JS)
/**
 * @typedef {object} AttendanceRecord
 * @property {string} id
 * @property {string} staffId
 * @property {string} staffName
 * @property {string} nc
 * @property {string} date
 * @property {string | null} clockIn
 * @property {string | null} clockOut
 * @property {'present' | 'absent' | 'late' | 'on-leave'} status
 * @property {'pending' | 'approved' | 'rejected'} approvalStatus
 * @property {boolean} overtime
 * @property {boolean} doubleDuty
 */

const DashboardScreen = () => {
  const { profile } = useAuth(); // Assuming useAuth provides basic profile
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalStaff: 0, presentCount: 0, absentCount: 0, onLeaveCount: 0,
    supervisorCount: 0, subEngineerCount: 0, locationsCount: 0, pendingApprovalsCount: 0, missingClockOutCount: 0
  });
  const [roleDepartmentStats, setRoleDepartmentStats] = useState({
    byRole: [],
    byDepartment: [],
    byRoleAndDepartment: [],
    totalUsers: 0
  });
  /** @type {AttendanceRecord[]} */
  const [allTodayRecords, setAllTodayRecords] = useState([]);
  const [userProfile, setUserProfile] = useState(null); // More detailed profile from getProfile
  const [dashboardDetails, setDashboardDetails] = useState({
    assignments: [],
    locations: [],
    onLeave: [],
    attendance: [],
    staffProfiles: [],
    dashboardDate: null,
  });
const [selectedDepartment, setSelectedDepartment] = useState(ALL_DEPARTMENTS_OPTION.id);
const [availableDepartments, setAvailableDepartments] = useState([]);
const [showDepartmentFilter, setShowDepartmentFilter] = useState(false);
const departmentEffectInitialisedRef = useRef(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      const fetchedProfile = await getProfile();
      setUserProfile(fetchedProfile);
      await loadDashboardData();

      // Real-time updates removed - using REST API instead of Parse LiveQuery
      // Dashboard will refresh when user navigates back to it or manually refreshes
      // For real-time updates, consider implementing polling or WebSocket in the future

      return () => {
        // Cleanup - no subscription to clean up
      };
    };

    initializeDashboard();
  }, []);

  useEffect(() => {
    if (!departmentEffectInitialisedRef.current) {
      departmentEffectInitialisedRef.current = true;
      return;
    }
    const roleForFilter = normalizeRole(userProfile?.role || profile?.role) || ROLE.STAFF;
    const allowRefetch =
      hasFullControl(roleForFilter) ||
      (roleForFilter === ROLE.GENERAL_MANAGER && availableDepartments.length > 1);
    if (allowRefetch) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment]);

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Start of tomorrow
      
      // Format dates as ISO strings for Parse queries (attendanceDate is stored as string)
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Get current user info for filtering
      const currentUser = await apiClient.getUser();
      const currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;
      const currentUserRoleRaw = userProfile?.role || profile?.role || null;
      const currentUserRole = normalizeRole(currentUserRoleRaw) || ROLE.STAFF;
      const hasOrgWideAccess = hasManagementPrivileges(currentUserRole) || hasFullControl(currentUserRole);
      const isSupervisorRole = currentUserRole === ROLE.SUPERVISOR;
      const hasFullVisibility = hasFullControl(currentUserRole);
      const shouldFetchOrgOverview = hasManagementPrivileges(currentUserRole);
      const departmentFilterForStats =
        hasFullVisibility &&
        selectedDepartment &&
        selectedDepartment !== ALL_DEPARTMENTS_OPTION.id
          ? selectedDepartment
          : null;
      const contextDepartments = Array.isArray(profile?.departments) ? profile.departments : [];
      const contextDepartmentSingle = profile?.department || null;
      const profileDepartments = Array.isArray(userProfile?.departments) && userProfile?.departments.length
        ? userProfile.departments
        : contextDepartments;
      const profileDepartment = userProfile?.department || contextDepartmentSingle;
      let accessibleDepartments = [];

      if (hasFullVisibility || currentUserRole === ROLE.CEO) {
        accessibleDepartments = DEPARTMENTS.map((dept) => dept.id);
      } else if (currentUserRole === ROLE.GENERAL_MANAGER) {
        accessibleDepartments =
          profileDepartments && profileDepartments.length > 0
            ? profileDepartments
            : profileDepartment
            ? [profileDepartment]
            : [];
      } else if (currentUserRole === ROLE.MANAGER) {
        accessibleDepartments = profileDepartment ? [profileDepartment] : [];
      } else if (isSupervisorRole) {
        accessibleDepartments = profileDepartment ? [profileDepartment] : [];
      } else {
        accessibleDepartments = profileDepartment ? [profileDepartment] : [];
      }

      const sanitizedDepartments = accessibleDepartments.filter(Boolean);

      setAvailableDepartments(hasFullVisibility ? DEPARTMENTS.map((dept) => dept.id) : sanitizedDepartments);
      if (hasFullVisibility) {
        setShowDepartmentFilter(true);
        setSelectedDepartment((prev) =>
          prev && prev !== '' ? prev : ALL_DEPARTMENTS_OPTION.id
        );
      } else if (currentUserRole === ROLE.GENERAL_MANAGER && sanitizedDepartments.length > 1) {
        setShowDepartmentFilter(true);
        setSelectedDepartment((prev) =>
          prev && sanitizedDepartments.includes(prev) ? prev : sanitizedDepartments[0]
        );
      } else if (currentUserRole === ROLE.GENERAL_MANAGER || currentUserRole === ROLE.MANAGER) {
        setShowDepartmentFilter(false);
        setSelectedDepartment(sanitizedDepartments[0] || null);
      } else {
        setShowDepartmentFilter(false);
      }
      

      // 1. Fetch all required data concurrently.
      // Use API functions to fetch data
      const [
        dashboardStats, staffRes, supervisorsRes, locRes,
        leaveRes, assignmentsRes, roleDeptStats
      ] = await Promise.all([
        getDashboardStats(),
        // Fetch staff (works for both admin and non-admin)
        hasOrgWideAccess || isSupervisorRole
          ? fetchStaff()
          : currentUserId 
            ? fetchProfiles().then(profiles => profiles.filter(p => p.user_id === currentUserId))
            : Promise.resolve([]),
        fetchSupervisors(),
        fetchLocations(),
        // Fetch today's leave requests
        fetchTodayLeaveRequests(),
        // Fetch assignments
        fetchAssignments(),
        // Fetch role and department stats (Manager and above)
        shouldFetchOrgOverview ? getStatsByRoleAndDepartment(departmentFilterForStats)
          .then(stats => {
            console.log('=== Organization Overview - Data Received ===');
            console.log('Stats received:', stats);
            console.log('By Role:', stats?.byRole);
            console.log('By Department:', stats?.byDepartment);
            console.log('By Role & Department:', stats?.byRoleAndDepartment);
            console.log('Total Users:', stats?.totalUsers);
            console.log('============================================');
            return stats;
          })
          .catch(error => {
            console.error('=== Organization Overview - Error ===');
            console.error('Error fetching role/department stats:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('=====================================');
            return {
              byRole: [],
              byDepartment: [],
              byRoleAndDepartment: [],
              totalUsers: 0
            };
          }) : Promise.resolve({
            byRole: [],
            byDepartment: [],
            byRoleAndDepartment: [],
            totalUsers: 0
          }),
      ]);

      // 2. Comprehensive error checking (Parse queries throw errors on failure, so we just check for data presence)
      const totalStaffCount = dashboardStats?.totalStaff || 0;
      const supervisorCount = dashboardStats?.supervisorCount || 0;
      const subEngineerCount = dashboardStats?.subEngineerCount || 0;
      const pendingApprovalsCount = dashboardStats?.pendingLeaveRequestsCount || 0;
      
      const rawAssignments = assignmentsRes || [];
      
      // Handle staff profiles - could be Parse User objects or plain objects from cloud function
      let staffProfiles = [];
      if ((hasOrgWideAccess || isSupervisorRole) && Array.isArray(staffRes)) {
        // Convert cloud function response to a format compatible with existing code
        staffProfiles = staffRes.map(s => ({
          id: s.user_id,
          department: s.department || null,
          manager_id: s.manager_id || null,
          empNo: s.empNo || null,
          get: (field) => {
            if (field === 'fullName' || field === 'name') return s.full_name || s.name || s.email || 'Unknown Staff';
            if (field === 'username') return s.name || s.email || 'Unknown Staff';
            if (field === 'email') return s.email || 'Unknown Staff';
            if (field === 'role') return 'staff';
            if (field === 'department') return s.department || null;
            if (field === 'empNo') return s.empNo || null;
            return null;
          }
        }));
      } else if (Array.isArray(staffRes)) {
        staffProfiles = staffRes;
      } else {
        staffProfiles = staffRes ? [staffRes] : [];
      }

      let supervisorProfiles = [];
      if (Array.isArray(supervisorsRes)) {
        supervisorProfiles = supervisorsRes.map(s => ({
          id: s.user_id,
          department: s.department || null,
          manager_id: s.manager_id || null,
          get: (field) => {
            if (field === 'fullName' || field === 'name') return s.full_name || s.name || s.email || 'Unknown Supervisor';
            if (field === 'username') return s.name || s.email || 'Unknown Supervisor';
            if (field === 'email') return s.email || 'Unknown Supervisor';
            if (field === 'role') return 'supervisor';
            if (field === 'department') return s.department || null;
            return null;
          }
        }));
      }

      const resolveProfileName = (profile) => {
        if (!profile) return null;
        if (typeof profile.get === 'function') {
          return (
            profile.get('fullName') ||
            profile.get('name') ||
            profile.get('username') ||
            profile.get('email') ||
            null
          );
        }
        return (
          profile.fullName ||
          profile.full_name ||
          profile.name ||
          profile.username ||
          profile.email ||
          null
        );
      };

      const staffNameMap = new Map();
      staffProfiles.forEach(profile => {
        const id = typeof profile.get === 'function' ? profile.id : profile.id || profile.user_id || null;
        if (!id) return;
        const name = resolveProfileName(profile);
        if (name) staffNameMap.set(id, name);
      });

      const supervisorNameMap = new Map();
      supervisorProfiles.forEach(profile => {
        const id = typeof profile.get === 'function' ? profile.id : profile.id || profile.user_id || null;
        if (!id) return;
        const name = resolveProfileName(profile);
        if (name) supervisorNameMap.set(id, name);
      });

      let supervisorStaffIds = [];
      if (isSupervisorRole && currentUserId) {
        supervisorStaffIds = Array.from(new Set(
          rawAssignments
            .filter(assignment => assignment.supervisor_id === currentUserId)
            .map(assignment => assignment.staff_id)
            .filter(Boolean)
        ));
      }

      let attendance = [];
      const allTodayAttendance = await fetchTodayAttendance();
      
      if (hasOrgWideAccess) {
        attendance = allTodayAttendance;
      } else if (isSupervisorRole) {
        if (supervisorStaffIds.length > 0) {
          attendance = allTodayAttendance.filter(record => supervisorStaffIds.includes(record.staffId || record.staff_id));
        } else {
          attendance = [];
        }
      } else if (currentUserId) {
        attendance = allTodayAttendance.filter(record => 
          (record.staffId === currentUserId || record.staff_id === currentUserId)
        );
      }
      
      const locations = locRes || [];
      const onLeaveData = leaveRes || [];

      const decoratedAssignments = rawAssignments.map(assignment => {
        const staffId = assignment.staff_id;
        const supervisorId = assignment.supervisor_id;
        return {
          ...assignment,
          staff_name: staffNameMap.get(staffId) || assignment.staff_name || 'Unknown Staff',
          supervisor_name: supervisorNameMap.get(supervisorId) || assignment.supervisor_name || 'Unknown Supervisor',
        };
      });

      const effectiveDepartmentIds = (() => {
        if (hasFullVisibility) {
          if (selectedDepartment && selectedDepartment !== ALL_DEPARTMENTS_OPTION.id) {
            return [selectedDepartment];
          }
          return DEPARTMENTS.map((dept) => dept.id);
        }
        return sanitizedDepartments;
      })();

      const shouldFilterByDepartment =
        effectiveDepartmentIds.length > 0 &&
        !(hasFullVisibility && selectedDepartment === ALL_DEPARTMENTS_OPTION.id);

      const allowedDepartmentSet = new Set(effectiveDepartmentIds);

      const filterByDepartment = (departmentCandidates) => {
        if (!shouldFilterByDepartment) {
          return true;
        }
        const candidates = Array.isArray(departmentCandidates)
          ? departmentCandidates
          : [departmentCandidates];
        const validCandidates = candidates.filter(Boolean);
        if (validCandidates.length === 0) {
          return true;
        }
        return validCandidates.some((dept) => allowedDepartmentSet.has(dept));
      };

      const filteredAssignments = shouldFilterByDepartment
        ? decoratedAssignments.filter((assignment) =>
            filterByDepartment([
              assignment.staff_department,
              assignment.supervisor_department,
            ])
          )
        : decoratedAssignments;

      if (shouldFilterByDepartment) {
        staffProfiles = staffProfiles.filter((profile) => {
          if (typeof profile.get === 'function') {
            const dept =
              profile.get('department') ??
              profile.department ??
              null;
            return filterByDepartment(dept);
          }
          return filterByDepartment(profile.department || null);
        });

        supervisorProfiles = supervisorProfiles.filter((profile) => {
          if (typeof profile.get === 'function') {
            const dept =
              profile.get('department') ??
              profile.department ??
              null;
            return filterByDepartment(dept);
          }
          return filterByDepartment(profile.department || null);
        });

        attendance = attendance.filter((entry) =>
          filterByDepartment([
            entry.department,
            entry.staff_department,
            entry.supervisor_department,
          ])
        );
      }

      if (isSupervisorRole && currentUserId && Array.isArray(staffProfiles)) {
        if (supervisorStaffIds.length > 0) {
          const profileMap = new Map(
            staffProfiles.map(profile => {
              const profileId =
                typeof profile.get === 'function'
                  ? profile.id
                  : profile.id || profile.user_id || null;
              return [profileId, profile];
            })
          );

          staffProfiles = supervisorStaffIds
            .map(id => {
              const profile = profileMap.get(id);
              if (profile) return profile;
              const assignment = filteredAssignments.find(a => a.staff_id === id);
              return {
                id,
                department: assignment?.staff_department || null,
                get: (field) => {
                  if (field === 'fullName' || field === 'name' || field === 'username') {
                    return assignment?.staff_name || 'Unknown Staff';
                  }
                  if (field === 'email') return 'Unknown Staff';
                  if (field === 'role') return 'staff';
                  if (field === 'department') return assignment?.staff_department || null;
                  return null;
                },
              };
            });
        }
      }

      // Debug logging
      console.log('Dashboard Data Loaded:', {
        totalStaffCount: totalStaffCount,
        staffCount: staffProfiles.length,
        supervisorCount: supervisorCount,
        locationsCount: locations.length,
        attendanceCount: attendance.length,
        onLeaveCount: onLeaveData.length,
        assignmentsCount: filteredAssignments.length,
        pendingApprovals: pendingApprovalsCount,
        today: todayStr
      });

      // 3. Prepare data maps for efficient lookup.
      const locationNameMap = new Map(locations.map(l => [l.id, l.name]));
      // decoratedAssignments is already an array of objects from cloud function
      const assignmentMap = new Map(filteredAssignments.map(a => {
        const staffId = a.staff_id;
        const locationId = a.nc_location_id;
        return [staffId, locationId];
      }));
      // attendance is already an array of objects from cloud function
      const attendanceMap = new Map((attendance || []).map(a => {
        return [a.staffId, a];
      }));
      // leaveRes is already an array of objects from cloud function
      const onLeaveMap = new Map((leaveRes || []).map(l => {
        return [l.staffId, true];
      }));

      // 4. Create records based on user role
      let records = [];
      
      if (hasOrgWideAccess) {
        // Admin sees all staff members with their attendance
        // Create a set of staff IDs that have attendance records
        const staffWithAttendance = new Set((attendance || []).map(a => a.staffId));
        
        // Map over all staff profiles
        records = staffProfiles.map(staff => {
          const staffId = staff.id;
          const attendanceRecord = attendanceMap.get(staffId);
          const isOnLeave = onLeaveMap.has(staffId);
          const locationId = assignmentMap.get(staffId);
          const staffDepartment =
            typeof staff.get === 'function'
              ? staff.get('department') ?? staff.department ?? null
              : staff.department ?? null;
          const attendanceDepartment =
            attendanceRecord?.department ||
            attendanceRecord?.staff_department ||
            attendanceRecord?.supervisor_department ||
            null;

          let status = 'absent';
          let approvalStatus = (attendanceRecord?.approvalStatus || (isOnLeave ? 'approved' : 'pending')).toLowerCase();
          if (attendanceRecord) {
            // attendanceRecord is now a plain object from cloud function
            status = (attendanceRecord.status || 'absent').toLowerCase().replace(' ', '-');
          } else if (isOnLeave) {
            status = 'on-leave';
          }
          if (approvalStatus === 'rejected') {
            status = 'absent';
          }

          // Get staff name - handle both Parse User objects and plain objects
          let staffName = 'Unknown Staff';
          let empNo = null;
          if (typeof staff.get === 'function') {
            staffName = staff.get('fullName') || 'Unknown Staff';
            empNo = staff.get('empNo') || null;
          } else if (staff.fullName) {
            staffName = staff.fullName;
            empNo = staff.empNo || null;
          } else if (staff.name) {
            staffName = staff.name;
            empNo = staff.empNo || null;
          }

          // Get empNo from attendance record if available
          if (!empNo && attendanceRecord?.empNo) {
            empNo = attendanceRecord.empNo;
          }

          return {
            id: attendanceRecord?.id || staffId,
            staffId: staffId,
            staffName: staffName,
            empNo: empNo,
            nc: locationId ? locationNameMap.get(locationId) || 'N/A' : 'N/A',
            date: todayStr,
            clockIn: attendanceRecord?.clockIn || null,
            clockOut: attendanceRecord?.clockOut || null,
            status: status,
            approvalStatus,
            overtime: !!attendanceRecord?.overtime,
            doubleDuty: !!attendanceRecord?.doubleDuty,
            department: attendanceDepartment || staffDepartment || null,
          };
        });
        
        // Also add any staff on leave that might not be in staffProfiles (edge case)
        // This ensures all on-leave staff are shown
        (onLeaveData || []).forEach(leaveRecord => {
          if (!staffWithAttendance.has(leaveRecord.staffId)) {
            // Check if this staff member is already in records
            const existingRecord = records.find(r => r.staffId === leaveRecord.staffId);
            if (!existingRecord) {
              // Find staff profile for this leave record
              const staffProfile = staffProfiles.find(s => s.id === leaveRecord.staffId);
              const locationId = assignmentMap.get(leaveRecord.staffId);
              const staffDepartment =
                typeof staffProfile?.get === 'function'
                  ? staffProfile.get('department') ?? staffProfile.department ?? null
                  : staffProfile?.department ?? null;
              
              let staffName = 'Unknown Staff';
              if (staffProfile) {
                if (typeof staffProfile.get === 'function') {
                  staffName = staffProfile.get('fullName') || 'Unknown Staff';
                } else if (staffProfile.fullName) {
                  staffName = staffProfile.fullName;
                } else if (staffProfile.name) {
                  staffName = staffProfile.name;
                }
              }
              
              const empNo = typeof staffProfile?.get === 'function' 
                ? staffProfile.get('empNo') || null
                : staffProfile?.empNo || null;

              records.push({
                id: leaveRecord.staffId,
                staffId: leaveRecord.staffId,
                staffName: staffName,
                empNo: empNo,
                nc: locationId ? locationNameMap.get(locationId) || 'N/A' : 'N/A',
                date: todayStr,
                clockIn: null,
                clockOut: null,
                status: 'on-leave',
                approvalStatus: 'approved',
                overtime: false,
                doubleDuty: false,
                department: staffDepartment || null,
              });
            }
          }
        });
      } else {
        // Staff and supervisors see only their own attendance records
        // Use the attendance records directly from the cloud function (already filtered)
        records = (attendance || []).map(attendanceRecord => {
          const staffId = attendanceRecord.staffId;
          const locationId = assignmentMap.get(staffId);
          const isOnLeave = onLeaveMap.has(staffId);
          const attendanceDepartment =
            attendanceRecord.department ||
            attendanceRecord.staff_department ||
            attendanceRecord.supervisor_department ||
            null;

          let status = 'absent';
          let approvalStatus = (attendanceRecord.approvalStatus || (isOnLeave ? 'approved' : 'pending')).toLowerCase();
          if (attendanceRecord) {
            status = (attendanceRecord.status || 'absent').toLowerCase().replace(' ', '-');
          } else if (isOnLeave) {
            status = 'on-leave';
          }
          if (approvalStatus === 'rejected') {
            status = 'absent';
          }

          // Get staff name from attendance record or staff profiles
          let staffName = attendanceRecord.staffName || 'Unknown Staff';
          let empNo = attendanceRecord.empNo || null;
          if (!staffName && staffProfiles.length > 0) {
            const staffProfile = staffProfiles.find(s => s.id === staffId);
            staffName = staffProfile?.get('fullName') || 'Unknown Staff';
            if (!empNo) {
              empNo = staffProfile?.get('empNo') || staffProfile?.empNo || null;
            }
          }

          return {
            id: attendanceRecord.id || staffId,
            staffId: staffId,
            staffName: staffName,
            empNo: empNo,
            nc: attendanceRecord.nc || (locationId ? locationNameMap.get(locationId) || 'N/A' : 'N/A'),
            date: attendanceRecord.date || todayStr,
            clockIn: attendanceRecord.clockIn || null,
            clockOut: attendanceRecord.clockOut || null,
            status: status,
            approvalStatus,
            overtime: !!attendanceRecord.overtime,
            doubleDuty: !!attendanceRecord.doubleDuty,
            department: attendanceDepartment || null,
          };
        });
        
        // If no attendance record exists but user is on leave, create a record
        if (records.length === 0 && onLeaveMap.has(currentUserId)) {
          const staffProfile = staffProfiles.length > 0 ? staffProfiles[0] : null;
          const locationId = assignmentMap.get(currentUserId);
          records.push({
            id: currentUserId,
            staffId: currentUserId,
            staffName: staffProfile?.get('fullName') || userProfile?.full_name || 'Unknown Staff',
            empNo: staffProfile?.get('empNo') || staffProfile?.empNo || null,
            nc: locationId ? locationNameMap.get(locationId) || 'N/A' : 'N/A',
            date: todayStr,
            clockIn: null,
            clockOut: null,
            status: 'on-leave',
            approvalStatus: 'approved',
            overtime: false,
            doubleDuty: false,
            department: staffProfile?.get?.('department') ?? staffProfile?.department ?? null,
          });
        }

        // Ensure supervisors see all assigned staff, even if absent
        if (isSupervisorRole && currentUserId) {
          const supervisorAssignments = filteredAssignments.filter(
            assignment => assignment.supervisor_id === currentUserId
          );

          supervisorAssignments.forEach(assignment => {
            const staffId = assignment.staff_id;
            const existingRecord = records.find(record => record.staffId === staffId);
            if (existingRecord) {
              return;
            }

            const isOnLeave = onLeaveMap.has(staffId);
            const status = isOnLeave ? 'on-leave' : 'absent';

            // Attempt to resolve staff name
            let staffName = assignment.staff_name || 'Unknown Staff';
            const staffProfile = staffProfiles.find(profile => {
              if (!profile) return false;
              if (typeof profile.get === 'function') {
                return profile.id === staffId;
              }
              return profile.id === staffId || profile.user_id === staffId;
            });
            if (staffProfile) {
              if (typeof staffProfile.get === 'function') {
                staffName = staffProfile.get('fullName') || staffProfile.get('username') || staffName;
              } else {
                staffName =
                  staffProfile.fullName ||
                  staffProfile.full_name ||
                  staffProfile.name ||
                  staffName;
              }
            }

            const locationName =
              assignment.nc_location_name ||
              locationNameMap.get(assignment.nc_location_id) ||
              'N/A';

            // Get empNo from staff profile
            let empNo = null;
            if (staffProfile) {
              if (typeof staffProfile.get === 'function') {
                empNo = staffProfile.get('empNo') || null;
              } else {
                empNo = staffProfile.empNo || null;
              }
            }

            records.push({
              id: `${staffId}-${todayStr}`,
              staffId,
              staffName,
              empNo: empNo,
              nc: locationName,
              date: todayStr,
              clockIn: null,
              clockOut: null,
              status,
              approvalStatus: isOnLeave ? 'approved' : 'pending',
              overtime: false,
              doubleDuty: false,
              department: assignment.staff_department || assignment.supervisor_department || null,
            });
          });
        }
      }

      if (shouldFilterByDepartment) {
        records = records.filter((record) =>
          filterByDepartment(record.department || null)
        );
      }

      // 5. Derive all dashboard state from the single source of truth.
      const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const onLeave = records.filter(r => r.status === 'on-leave').length;
      let absent = records.length > 0 ? (records.length - present - onLeave) : 0;
      if (isSupervisorRole) {
        const currentUserRecord = records.find(r => r.staffId === currentUserId);
        if (currentUserRecord && currentUserRecord.status === 'present') {
          absent = Math.max(0, absent - 1);
        }
      }
      const finalAbsentCount = absent >= 0 ? absent : 0;

      const effectiveTotal =
        hasOrgWideAccess
          ? totalStaffCount
          : records.filter(r => r.staffId !== currentUserId).length;

      setStats({
        totalStaff: effectiveTotal,
        supervisorCount: supervisorCount,
        subEngineerCount: subEngineerCount,
        locationsCount: locations.length,
        pendingApprovalsCount: pendingApprovalsCount,
        presentCount: present,
        onLeaveCount: onLeave,
        absentCount: finalAbsentCount,
        missingClockOutCount: records.filter(r => r.clockIn && !r.clockOut).length,
      });

      const sortedRecords = records.sort((a, b) => (a.staffName ||'').localeCompare(b.staffName ||''));
      setAllTodayRecords(sortedRecords);
      
      // Console log before setting state
      console.log('=== Setting Role Department Stats ===');
      console.log('roleDeptStats received:', roleDeptStats);
      console.log('Has Full Visibility:', hasFullVisibility);
      console.log('Current User Role:', currentUserRole);
      
      const finalStats = roleDeptStats || {
        byRole: [],
        byDepartment: [],
        byRoleAndDepartment: [],
        totalUsers: 0
      };
      console.log('Final stats being set:', finalStats);
      console.log('====================================');
      
      setRoleDepartmentStats(finalStats);
      setDashboardDetails({
        assignments: filteredAssignments,
        locations,
        onLeave: onLeaveData || [],
        attendance: attendance || [],
        staffProfiles,
        supervisorProfiles,
        dashboardDate: todayStr,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error("Dashboard Loading Error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      Toast.show({
        type: 'error',
        text1: 'Error Loading Dashboard',
        text2: message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <LogoFillLoader size={220} message="Loading your WSSCS insights..." />
      </View>
    );
  }

  const normalizedRole = normalizeRole(userProfile?.role || profile?.role) || ROLE.STAFF;
  const showManagerDashboard = hasManagementPrivileges(normalizedRole) || hasFullControl(normalizedRole);
  const showSupervisorDashboard = normalizedRole === ROLE.SUPERVISOR;
  const departmentDropdownOptions = showDepartmentFilter
    ? hasFullControl(normalizedRole)
      ? [
          { value: ALL_DEPARTMENTS_OPTION.id, label: ALL_DEPARTMENTS_OPTION.label },
          ...DEPARTMENTS.map((dept) => ({ value: dept.id, label: dept.label }))
        ]
      : availableDepartments.map((deptId) => {
          const meta = DEPARTMENTS.find((dept) => dept.id === deptId);
          return {
            label: meta ? meta.label : getDepartmentLabel(deptId),
            value: deptId,
          };
        })
    : [];
  const selectedDepartmentValue =
    selectedDepartment ?? (departmentDropdownOptions[0]?.value ?? null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Welcome, {userProfile?.full_name || 'User'}
        </Text>
        <Text style={styles.dateText}>Water & Sanitation Services - Mingora, Swat</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadDashboardData} />
        }
      >
        {showDepartmentFilter && departmentDropdownOptions.length > 0 && (
          <View style={styles.departmentFilter}>
            <Text style={styles.departmentLabel}>Department</Text>
            <SimpleDropdown
              options={departmentDropdownOptions}
              selectedValue={selectedDepartmentValue}
              onValueChange={setSelectedDepartment}
              placeholder="Select department"
              style={styles.departmentDropdown}
            />
          </View>
        )}

        {showManagerDashboard ? (
          <AdminDashboard
            stats={stats}
            records={allTodayRecords}
            roleDepartmentStats={roleDepartmentStats}
          />
        ) : showSupervisorDashboard ? (
          <SupervisorDashboard
            stats={stats}
            records={allTodayRecords}
            details={dashboardDetails}
            profile={userProfile}
          />
        ) : (
          <StaffDashboard
            stats={stats}
            records={allTodayRecords}
            details={dashboardDetails}
            profile={userProfile}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  departmentFilter: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  departmentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  departmentDropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 24,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#999',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
});

export default DashboardScreen;
