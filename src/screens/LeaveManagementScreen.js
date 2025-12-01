import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getProfile } from '../lib/auth';
import { fetchStaff, fetchSupervisors, fetchManagers, fetchGeneralManagers } from '../lib/staff';
import { fetchAssignments } from '../lib/assignments';
import { fetchLeaveRequests, createLeaveRequest, updateLeaveRequestStatus } from '../lib/leaveRequests';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import {
  ROLE,
  normalizeRole,
  hasManagementPrivileges,
  hasFullControl,
  hasExecutivePrivileges,
} from '../lib/roles';
import { LEAVE_TYPES, getLeaveTypeLabel, getLeaveTypeLimit } from '../lib/leaveTypes';

const LeaveManagementScreen = () => {
  const { profile } = useAuth();
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [leaveFor, setLeaveFor] = useState('staff'); // 'supervisor' or 'staff'
  const [staff, setStaff] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [managers, setManagers] = useState([]);
  const [generalManagers, setGeneralManagers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('staff');
  const [currentUserDepartment, setCurrentUserDepartment] = useState(null);
  const [currentUserDepartments, setCurrentUserDepartments] = useState([]); // For GMs with multiple departments
  const normalizedRole = normalizeRole(currentUserRole) || ROLE.STAFF;
  const canApproveLeave = hasManagementPrivileges(normalizedRole) || hasFullControl(normalizedRole);
  const isSupervisorRole = normalizedRole === ROLE.SUPERVISOR;
  const isStaffRole = normalizedRole === ROLE.STAFF;
  const isManagerRole = normalizedRole === ROLE.MANAGER;
  const isGeneralManagerRole = normalizedRole === ROLE.GENERAL_MANAGER;
  const isCEORole = normalizedRole === ROLE.CEO;
  const isSuperAdminRole = normalizedRole === ROLE.SUPER_ADMIN;
  // Allow submission for staff, supervisors, managers, and general managers
  const showSubmissionForm = !canApproveLeave || isManagerRole || isGeneralManagerRole;
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState({ start: false, end: false });
  const [tempDate, setTempDate] = useState(new Date());
  const [pickingDateType, setPickingDateType] = useState(null); // 'start' or 'end'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel, but handle individual errors
      const [stfResult, supsResult, mgrsResult, gMgrsResult, asgsResult, userProfileResult, requestsResult] = await Promise.allSettled([
        fetchStaff(),
        fetchSupervisors(),
        fetchManagers(),
        fetchGeneralManagers(),
        fetchAssignments(),
        getProfile(),
        fetchLeaveRequests(),
      ]);
      
      // Extract data from settled promises (use empty arrays as fallbacks)
      const stf = stfResult.status === 'fulfilled' ? stfResult.value : [];
      const sups = supsResult.status === 'fulfilled' ? supsResult.value : [];
      const mgrs = mgrsResult.status === 'fulfilled' ? mgrsResult.value : [];
      const gMgrs = gMgrsResult.status === 'fulfilled' ? gMgrsResult.value : [];
      const asgs = asgsResult.status === 'fulfilled' ? asgsResult.value : [];
      const userProfile = userProfileResult.status === 'fulfilled' ? userProfileResult.value : null;
      const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : [];
      
      // Log any errors for debugging
      if (stfResult.status === 'rejected') console.warn('Failed to load staff:', stfResult.reason);
      if (supsResult.status === 'rejected') console.warn('Failed to load supervisors:', supsResult.reason);
      if (mgrsResult.status === 'rejected') console.warn('Failed to load managers:', mgrsResult.reason);
      if (gMgrsResult.status === 'rejected') console.warn('Failed to load general managers:', gMgrsResult.reason);
      if (asgsResult.status === 'rejected') console.warn('Failed to load assignments:', asgsResult.reason);
      if (userProfileResult.status === 'rejected') console.warn('Failed to load user profile:', userProfileResult.reason);
      if (requestsResult.status === 'rejected') console.warn('Failed to load leave requests:', requestsResult.reason);
      
      setStaff(stf || []);
      setSupervisors(sups || []);
      setManagers(mgrs || []);
      setGeneralManagers(gMgrs || []);
      setAssignments(asgs || []);
      setLeaveRequests(requests || []);
      
      const role = userProfile?.role;
      const userId = userProfile?.user_id;
      const normalizedRole = normalizeRole(role) || ROLE.STAFF;

      setCurrentUserId(userId || '');
      setCurrentUserRole(normalizedRole);
      // Get current user's department (single and array for GMs)
      const userDept = userProfile?.department || null;
      const userDepts = userProfile?.departments || [];
      setCurrentUserDepartment(userDept);
      setCurrentUserDepartments(userDepts);
      
      if (normalizedRole === ROLE.STAFF) {
        setLeaveFor('staff');
        if (userId) {
          setSelectedStaff(userId);
          const assignment = (asgs || []).find(a => a.staff_id === userId && a.is_active);
          if (assignment) {
            setSelectedSupervisor(assignment.supervisor_id);
          }
        }
      } else if (normalizedRole === ROLE.SUPERVISOR) {
        // Supervisors can submit leave for their assigned staff
        setLeaveFor('staff');
        if (userId) {
          setSelectedSupervisor(userId);
          // Auto-select first assigned staff if available
          const assignedStaffIds = (asgs || [])
            .filter(a => a.supervisor_id === userId && a.is_active)
            .map(a => a.staff_id);
          if (assignedStaffIds.length > 0) {
            setSelectedStaff(assignedStaffIds[0]);
          }
        }
      } else if (normalizedRole === ROLE.MANAGER) {
        // Managers can submit leave for themselves
        setLeaveFor('staff');
        if (userId) {
          setSelectedStaff(userId);
          // Find a General Manager to be the approver
          if (gMgrs && gMgrs.length > 0) {
            setSelectedSupervisor(gMgrs[0].user_id);
          }
        }
      } else if (normalizedRole === ROLE.GENERAL_MANAGER) {
        // General Managers can submit leave for themselves
        setLeaveFor('staff');
        if (userId) {
          setSelectedStaff(userId);
          // Find a CEO or Super Admin to be the approver
          const allStaff = stf || [];
          const ceoOrSuperAdmin = allStaff.find(s => 
            normalizeRole(s.role) === ROLE.CEO || normalizeRole(s.role) === ROLE.SUPER_ADMIN
          );
          if (ceoOrSuperAdmin) {
            setSelectedSupervisor(ceoOrSuperAdmin.user_id);
          }
        }
      } else if (hasFullControl(normalizedRole)) {
        // CEO/Super Admin - can approve but not submit for themselves in this context
        setLeaveFor('staff');
        if (sups && sups.length > 0) {
          setSelectedSupervisor(sups[0].user_id);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkLeave = async () => {
    // For managers and GMs submitting for themselves, use current user as staff
    let staffIdForRequest;
    let supervisorIdForRequest;

    if (isManagerRole || isGeneralManagerRole) {
      // Managers and GMs submit for themselves
      staffIdForRequest = currentUserId;
      if (isManagerRole) {
        // Manager's leave needs GM approval
        if (generalManagers && generalManagers.length > 0) {
          supervisorIdForRequest = generalManagers[0].user_id;
        } else {
          Alert.alert('Error', 'No General Manager found to approve your leave request.');
          return;
        }
      } else if (isGeneralManagerRole) {
        // GM's leave needs CEO/SuperAdmin approval
        const allStaff = staff || [];
        const ceoOrSuperAdmin = allStaff.find(s => {
          const role = normalizeRole(s.role);
          return role === ROLE.CEO || role === ROLE.SUPER_ADMIN;
        });
        if (ceoOrSuperAdmin) {
          supervisorIdForRequest = ceoOrSuperAdmin.user_id;
        } else {
          Alert.alert('Error', 'No CEO or Super Admin found to approve your leave request.');
          return;
        }
      }
    } else if (isSupervisorRole && leaveFor === 'supervisor') {
      // Supervisor submitting leave for themselves
      staffIdForRequest = currentUserId; // The supervisor is the one requesting leave
      
      // Find a manager to approve the supervisor's leave
      if (managers && managers.length > 0) {
        // Try to find a manager in the same department
        const supervisorUser = supervisors.find(s => s.user_id === currentUserId);
        const supervisorDept = supervisorUser?.department;
        const deptManager = managers.find(m => m.department === supervisorDept);
        supervisorIdForRequest = deptManager ? deptManager.user_id : managers[0].user_id;
      } else if (generalManagers && generalManagers.length > 0) {
        supervisorIdForRequest = generalManagers[0].user_id;
      } else {
        Alert.alert('Error', 'No Manager or General Manager found to approve your leave request.');
        return;
      }
    } else {
      // For staff members or supervisors submitting for their assigned staff
      if (leaveFor === 'supervisor' && !selectedSupervisor) {
        Alert.alert('Error', 'Please select a supervisor');
        return;
      }

      staffIdForRequest = isStaffRole ? currentUserId : selectedStaff;
      if (leaveFor === 'staff' && !staffIdForRequest) {
        Alert.alert('Error', 'Please select a staff member');
        return;
      }

      const effectiveSupervisorForStaff = leaveFor === 'staff' && isSupervisorRole 
        ? currentUserId 
        : selectedSupervisor;
      
      supervisorIdForRequest = leaveFor === 'supervisor' ? selectedSupervisor : effectiveSupervisorForStaff;
    }
    
    if (!selectedLeaveType) {
      Alert.alert('Error', 'Please select a leave type');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select start and end dates');
      return;
    }

    if (!staffIdForRequest || !supervisorIdForRequest) {
      Alert.alert('Error', 'Could not determine staff or supervisor for the request.');
      return;
    }

    try {
      await createLeaveRequest({
        staff_id: staffIdForRequest,
        supervisor_id: supervisorIdForRequest,
        leave_type: selectedLeaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      });
      
      Alert.alert('Success', 'Leave request submitted successfully');
      
      // Refresh leave requests
      const requests = await fetchLeaveRequests();
      setLeaveRequests(requests || []);
      
      // Reset form
      if (!isStaffRole && !isManagerRole && !isGeneralManagerRole) {
        setSelectedStaff('');
      }
      setSelectedLeaveType('');
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit leave request');
      console.error('Error creating leave request:', error);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await updateLeaveRequestStatus(requestId, 'approved', currentUserId);
      Alert.alert('Success', 'Leave request approved');
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve leave request');
      console.error(error);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await updateLeaveRequestStatus(requestId, 'rejected', currentUserId);
      Alert.alert('Success', 'Leave request rejected');
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject leave request');
      console.error(error);
    }
  };

  const loggedInStaffUser = staff.find(s => s.user_id === currentUserId) || 
    supervisors.find(s => s.user_id === currentUserId) ||
    managers.find(s => s.user_id === currentUserId) ||
    generalManagers.find(s => s.user_id === currentUserId);
  const assignedSupervisor = supervisors.find(s => s.user_id === selectedSupervisor);

  // Helper function to get the role of a user by their ID (fallback to user lists)
  const getUserRole = (userId, requestRole = null) => {
    // If role is provided directly from request, use it
    if (requestRole) return normalizeRole(requestRole);
    
    const user = staff.find(s => s.user_id === userId) ||
      supervisors.find(s => s.user_id === userId) ||
      managers.find(s => s.user_id === userId) ||
      generalManagers.find(s => s.user_id === userId);
    return user ? normalizeRole(user.role) : null;
  };

  // Helper function to get the department of a user by their ID (fallback to user lists)
  const getUserDepartment = (userId, requestDept = null) => {
    // If department is provided directly from request, use it
    if (requestDept) return requestDept;
    
    const user = staff.find(s => s.user_id === userId) ||
      supervisors.find(s => s.user_id === userId) ||
      managers.find(s => s.user_id === userId) ||
      generalManagers.find(s => s.user_id === userId);
    return user ? (user.department || null) : null;
  };

  // Helper function to check if a user's department matches the current user's department(s)
  const isSameDepartment = (userId, requestDept = null) => {
    const userDept = getUserDepartment(userId, requestDept);
    if (!userDept) return true; // If target user has no department, show it (can't filter)
    
    // For GMs with multiple departments, check against the departments array
    if (isGeneralManagerRole && currentUserDepartments && currentUserDepartments.length > 0) {
      const normalizedUserDept = userDept.toLowerCase().trim();
      return currentUserDepartments.some(dept => 
        dept && dept.toLowerCase().trim() === normalizedUserDept
      );
    }
    
    // For single department users (managers, etc.)
    if (!currentUserDepartment) return true; // If current user has no department, show all
    // Normalize department values for comparison (case-insensitive)
    return userDept.toLowerCase().trim() === currentUserDepartment.toLowerCase().trim();
  };

  // Filter leave requests based on user role and assignments
  const getFilteredLeaveRequests = () => {
    let filtered = [];
    
    // Debug logging
    console.log('=== Leave Request Filtering Debug ===');
    console.log('Current User Role:', currentUserRole, '| Normalized:', normalizedRole);
    console.log('Current User ID:', currentUserId);
    console.log('Current User Department:', currentUserDepartment);
    console.log('Current User Departments (array):', currentUserDepartments);
    console.log('Total Leave Requests:', leaveRequests.length);
    console.log('Role Flags - isManager:', isManagerRole, '| isGM:', isGeneralManagerRole, '| isCEO:', isCEORole, '| isSuperAdmin:', isSuperAdminRole);
    
    // If still loading or no user ID, return all requests to avoid filtering issues
    if (!currentUserId || loading) {
      console.log('Data not ready yet, returning empty array');
      return [];
    }
    
    if (isManagerRole) {
      // Managers can see:
      // 1. Their own requests (all statuses) - approved by GM
      // 2. Requests from their direct reports (supervisors/staff who report to them)
      filtered = leaveRequests.filter(request => {
        const requestStaffRole = getUserRole(request.staff_id, request.staff_role);
        const isOwnRequest = request.staff_id === currentUserId;
        
        if (isOwnRequest) return true;
        
        // Check if this is from someone in manager's team
        const isStaffOrSupervisorRequest = !requestStaffRole || 
          requestStaffRole === ROLE.STAFF || 
          requestStaffRole === ROLE.SUPERVISOR;
        
        if (!isStaffOrSupervisorRequest) return false;
        
        // Check if staff/supervisor reports to this manager
        const reportsToMe = request.staff_manager_id === currentUserId || 
                           request.supervisor_manager_id === currentUserId;
        
        // Debug each request
        console.log(`Request ${request.id}: staff_role=${request.staff_role}, staff_manager_id=${request.staff_manager_id}, supervisor_manager_id=${request.supervisor_manager_id}, reportsToMe=${reportsToMe}`);
        
        return reportsToMe;
      });
    } else if (isGeneralManagerRole) {
      // General Managers can see:
      // 1. Their own requests (all statuses) - approved by CEO/Super Admin
      // 2. ALL requests from their assigned department(s) - staff, supervisors, managers
      filtered = leaveRequests.filter(request => {
        const requestStaffRole = getUserRole(request.staff_id, request.staff_role);
        const isOwnRequest = request.staff_id === currentUserId;
        
        if (isOwnRequest) return true;
        
        // Exclude other GMs and higher
        if (requestStaffRole === ROLE.GENERAL_MANAGER || 
            requestStaffRole === ROLE.CEO || 
            requestStaffRole === ROLE.SUPER_ADMIN) {
          return false;
        }
        
        // GM sees all requests from their assigned department(s)
        const isInMyDepartments = isSameDepartment(request.staff_id, request.staff_department);
        
        console.log(`GM Filter - Request ${request.id}: dept=${request.staff_department}, isInMyDepartments=${isInMyDepartments}`);
        
        return isInMyDepartments;
      });
    } else if (isCEORole || isSuperAdminRole) {
      // CEO/Super Admin can see all requests - can approve GM requests and all others
      filtered = leaveRequests;
    } else if (isStaffRole) {
      // Staff can only see their own requests
      filtered = leaveRequests.filter(request => request.staff_id === currentUserId);
    } else if (isSupervisorRole) {
      // Supervisors see:
      // 1. Their own requests (all statuses) - approved by Manager
      // 2. Their assigned staff's requests (all statuses for visibility, but can't approve)
      const assignedStaffIds = assignments
        .filter(a => a.supervisor_id === currentUserId && a.is_active)
        .map(a => a.staff_id);
      
      filtered = leaveRequests.filter(request => {
        const isOwnRequest = request.staff_id === currentUserId;
        const isAssignedStaffRequest = assignedStaffIds.includes(request.staff_id);
        return isOwnRequest || isAssignedStaffRequest;
      });
    } else {
      // Fallback: if role is not recognized, show own requests at minimum
      console.log('Role not recognized, showing own requests only');
      filtered = leaveRequests.filter(request => request.staff_id === currentUserId);
    }
    
    console.log('Filtered Results:', filtered.length);
    console.log('=====================================');
    
    // Sort: pending requests first, then by date
    return filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      // If both have same pending status, sort by date (newest first)
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  };

  const filteredLeaveRequests = getFilteredLeaveRequests();

  // Determine if current user can approve a specific request based on reporting chain
  const canApproveRequest = (request) => {
    if (request.status !== 'pending') return false;
    
    // Can't approve your own request
    if (request.staff_id === currentUserId) return false;
    
    const requestStaffRole = getUserRole(request.staff_id, request.staff_role);
    
    if (isManagerRole) {
      // Managers can only approve requests from their direct reports:
      // 1. Supervisors who report to this manager (supervisor.managerId === currentUserId)
      // 2. Staff who are under supervisors reporting to this manager
      
      if (requestStaffRole === ROLE.SUPERVISOR) {
        // Check if this supervisor reports to current manager
        return request.staff_manager_id === currentUserId;
      } else if (requestStaffRole === ROLE.STAFF || !requestStaffRole) {
        // Check if staff's manager is current user, or staff's supervisor reports to current manager
        if (request.staff_manager_id === currentUserId) {
          return true;
        }
        // Check if the supervisor who submitted the request reports to current manager
        if (request.supervisor_manager_id === currentUserId) {
          return true;
        }
        return false;
      }
      return false;
    } else if (isGeneralManagerRole) {
      // General Managers can approve ALL requests from their assigned department(s)
      // (staff, supervisors, managers - anyone below GM level in their departments)
      
      // Exclude other GMs and higher - can't approve
      if (requestStaffRole === ROLE.GENERAL_MANAGER || 
          requestStaffRole === ROLE.CEO || 
          requestStaffRole === ROLE.SUPER_ADMIN) {
        return false;
      }
      
      // Can approve anyone in their department(s)
      return isSameDepartment(request.staff_id, request.staff_department);
    } else if (isCEORole || isSuperAdminRole) {
      // CEO/Super Admin can approve all requests including GM requests
      return true;
    }
    
    return false;
  };

  // Get who should approve a request (for display purposes)
  const getApprovalAuthority = (request) => {
    const requestStaffRole = getUserRole(request.staff_id, request.staff_role);
    
    if (requestStaffRole === ROLE.GENERAL_MANAGER) {
      return 'CEO / Super Admin';
    } else if (requestStaffRole === ROLE.MANAGER) {
      return 'General Manager';
    } else if (requestStaffRole === ROLE.SUPERVISOR || requestStaffRole === ROLE.STAFF) {
      return 'Manager / General Manager';
    }
    return 'Management';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  // Only management roles can approve/reject leave requests (general check)
  // Use canApproveRequest(request) for per-request checks

  // Get assigned staff for selected supervisor
  const getAssignedStaff = () => {
    const effectiveSupervisorId = isSupervisorRole 
      ? currentUserId 
      : selectedSupervisor;
    
    const assignedStaff = staff.filter((s) => 
      assignments.some((a) => 
        a.staff_id === s.user_id && 
        a.supervisor_id === effectiveSupervisorId && 
        a.is_active
      )
    );
    
    return assignedStaff.length > 0 ? assignedStaff : (canApproveLeave ? staff : []);
  };

  const assignedStaff = getAssignedStaff();

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const openDatePicker = (type) => {
    setPickingDateType(type);
    const currentDate = type === 'start' && startDate 
      ? new Date(startDate) 
      : type === 'end' && endDate 
      ? new Date(endDate) 
      : new Date();
    setTempDate(currentDate);
    setShowDatePicker({ ...showDatePicker, [type]: true });
  };

  const closeDatePicker = () => {
    setShowDatePicker({ start: false, end: false });
    setPickingDateType(null);
  };

  const selectDate = (date) => {
    if (!date) return;
    const dateStr = formatDate(date);
    
    if (pickingDateType === 'start') {
      setStartDate(dateStr);
      // If end date is before new start date, clear it
      if (endDate && new Date(endDate) < date) {
        setEndDate('');
      }
    } else if (pickingDateType === 'end') {
      // Validate that end date is not before start date
      if (startDate && new Date(dateStr) < new Date(startDate)) {
        Alert.alert('Error', 'End date cannot be before start date');
        return;
      }
      setEndDate(dateStr);
    }
    closeDatePicker();
  };

  const changeMonth = (direction) => {
    const newDate = new Date(tempDate);
    newDate.setMonth(tempDate.getMonth() + direction);
    setTempDate(newDate);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const CalendarModal = ({ visible, onClose, onSelectDate, currentDate, minDate }) => {
    const days = getDaysInMonth(tempDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavButton}>
                <Text style={styles.monthNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calendarMonthText}>
                {monthNames[tempDate.getMonth()]} {tempDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavButton}>
                <Text style={styles.monthNavText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekDays}>
              {dayNames.map(day => (
                <Text key={day} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {days.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.calendarDay} />;
                }
                
                const dateStr = formatDate(date);
                const isToday = formatDate(today) === dateStr;
                const isSelected = (pickingDateType === 'start' && startDate === dateStr) ||
                                  (pickingDateType === 'end' && endDate === dateStr);
                
                // For start date: disable past dates (before today)
                // For end date: disable dates before start date (or today if no start date)
                let isDisabled = false;
                if (pickingDateType === 'start') {
                  isDisabled = date < today;
                } else if (pickingDateType === 'end') {
                  const minEndDate = startDate ? new Date(startDate) : today;
                  minEndDate.setHours(0, 0, 0, 0);
                  isDisabled = date < minEndDate;
                }

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.calendarDay,
                      isToday && styles.calendarDayToday,
                      isSelected && styles.calendarDaySelected,
                      isDisabled && styles.calendarDayDisabled,
                    ]}
                    onPress={() => !isDisabled && selectDate(date)}
                    disabled={isDisabled}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isToday && styles.calendarDayTextToday,
                      isSelected && styles.calendarDayTextSelected,
                      isDisabled && styles.calendarDayTextDisabled,
                    ]}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarFooter}>
              <TouchableOpacity onPress={onClose} style={styles.calendarCloseButton}>
                <Text style={styles.calendarCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* <View style={styles.header}>
        <Text style={styles.title}>Leave Management</Text>
        <Text style={styles.subtitle}>
          {canApproveLeave ? 'View and manage leave requests' : 'Mark staff leave for today'}
        </Text>
      </View> */}

      {showSubmissionForm && (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Mark Leave</CardTitle>
            <CardDescription>
              {isManagerRole || isGeneralManagerRole 
                ? 'Submit your leave request' 
                : 'Select staff and leave type'}
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
          {/* For managers and GMs, show info that they're submitting for themselves */}
          {(isManagerRole || isGeneralManagerRole) && (
            <View style={styles.inputGroup}>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {(() => {
                    if (!loggedInStaffUser) return 'You';
                    const name = loggedInStaffUser.name || loggedInStaffUser.email || 'You';
                    const empNo = loggedInStaffUser.empNo ? ` (ID: ${loggedInStaffUser.empNo})` : '';
                    return `${name}${empNo}`;
                  })()}
                </Text>
                <Text style={styles.infoSubtext}>
                  {isManagerRole 
                    ? 'Your leave request will be reviewed by a General Manager'
                    : 'Your leave request will be reviewed by CEO or Super Admin'}
                </Text>
              </View>
            </View>
          )}

          {/* Show "Leave For" options only for supervisors and management roles (not managers/GMs submitting for themselves) */}
          {!isManagerRole && !isGeneralManagerRole && (canApproveLeave || isSupervisorRole) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Leave For</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioOption, leaveFor === 'supervisor' && styles.radioOptionSelected]}
                  onPress={() => {
                    setLeaveFor('supervisor');
                    setSelectedStaff('');
                    if (isSupervisorRole) {
                      setSelectedSupervisor(currentUserId);
                    } else {
                      setSelectedSupervisor(supervisors.length > 0 ? supervisors[0].user_id : '');
                    }
                  }}
                >
                  <View style={[styles.radioCircle, leaveFor === 'supervisor' && styles.radioCircleSelected]} />
                  <Text style={styles.radioLabel}>Supervisor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioOption, leaveFor === 'staff' && styles.radioOptionSelected]}
                  onPress={() => {
                    setLeaveFor('staff');
                    setSelectedStaff('');
                    if (isSupervisorRole) {
                      setSelectedSupervisor(currentUserId);
                      // Auto-select first assigned staff if available
                      const assignedStaffIds = assignments
                        .filter(a => a.supervisor_id === currentUserId && a.is_active)
                        .map(a => a.staff_id);
                      if (assignedStaffIds.length > 0) {
                        setSelectedStaff(assignedStaffIds[0]);
                      }
                    } else {
                      setSelectedSupervisor(supervisors.length > 0 ? supervisors[0].user_id : '');
                    }
                  }}
                >
                  <View style={[styles.radioCircle, leaveFor === 'staff' && styles.radioCircleSelected]} />
                  <Text style={styles.radioLabel}>Staff Member</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {leaveFor === 'supervisor' && !isManagerRole && !isGeneralManagerRole && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Supervisor</Text>
              {canApproveLeave ? (
                <SimpleDropdown
                  options={[
                    { label: 'Select supervisor', value: '' },
                    ...supervisors.map((s) => ({ label: s.name, value: s.user_id }))
                  ]}
                  selectedValue={selectedSupervisor}
                  onValueChange={setSelectedSupervisor}
                  placeholder="Select supervisor"
                  style={styles.dropdown}
                />
              ) : isSupervisorRole ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    {supervisors.find(s => s.user_id === currentUserId)?.name || 'You'}
                  </Text>
                  <Text style={styles.infoSubtext}>Leave will be marked for you (automatically selected)</Text>
                </View>
              ) : null}
            </View>
          )}

          {leaveFor === 'staff' && !isManagerRole && !isGeneralManagerRole && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Supervisor</Text>
                {canApproveLeave ? (
                  <SimpleDropdown
                    options={[
                      { label: 'Select supervisor', value: '' },
                      ...supervisors.map((s) => ({ label: s.name, value: s.user_id }))
                    ]}
                    selectedValue={selectedSupervisor}
                    onValueChange={setSelectedSupervisor}
                    placeholder="Select supervisor"
                    style={styles.dropdown}
                  />
                ) : currentUserRole === 'supervisor' ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      {supervisors.find(s => s.user_id === currentUserId)?.name || 'You'}
                    </Text>
                    <Text style={styles.infoSubtext}>Viewing your assigned staff (automatically selected)</Text>
                  </View>
                ) : (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      {assignedSupervisor?.name || 'Unassigned'}
                    </Text>
                    <Text style={styles.infoSubtext}>Your assigned supervisor</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Staff Member</Text>
                {currentUserRole === 'staff' ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      {(() => {
                        if (!loggedInStaffUser) return 'You';
                        const name = loggedInStaffUser.name || loggedInStaffUser.email || 'You';
                        const empNo = loggedInStaffUser.empNo ? ` (ID: ${loggedInStaffUser.empNo})` : '';
                        return `${name}${empNo}`;
                      })()}
                    </Text>
                    <Text style={styles.infoSubtext}>Leave will be marked for you</Text>
                  </View>
                ) : (
                  <SearchableDropdown
                    options={[
                      { label: 'Select staff member', value: '' },
                      ...assignedStaff.map((s) => ({ 
                        label: `${s.name || s.email}${s.empNo ? ` (ID: ${s.empNo})` : ''}`, 
                        value: s.user_id,
                        empNo: s.empNo || null,
                        name: s.name || s.email,
                      }))
                    ]}
                    selectedValue={selectedStaff}
                    onValueChange={setSelectedStaff}
                    placeholder={assignedStaff.length === 0 ? 'No staff assigned to this supervisor' : 'Select staff member'}
                    style={styles.dropdown}
                    searchPlaceholder="Search by name or employee ID..."
                    getSearchText={(option) => {
                      if (!option || option.value === '') return '';
                      const name = option.name || option.label || '';
                      const empNo = option.empNo ? String(option.empNo) : '';
                      return `${name} ${empNo}`.toLowerCase();
                    }}
                  />
                )}
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Leave Type</Text>
            <SimpleDropdown
              options={[
                { label: 'Select leave type', value: '' },
                ...LEAVE_TYPES.filter(lt => lt.leaveTypeId !== 0).map((type) => ({ 
                  label: `${type.label} (Limit: ${type.limit} days)`, 
                  value: type.id 
                }))
              ]}
              selectedValue={selectedLeaveType}
              onValueChange={setSelectedLeaveType}
              placeholder="Select leave type"
              style={styles.dropdown}
            />
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateInputGroup}>
              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => openDatePicker('start')}
              >
                <Text style={[styles.dateInputText, !startDate && styles.dateInputPlaceholder]}>
                  {startDate || 'YYYY-MM-DD'}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputGroup}>
              <Text style={styles.label}>End Date</Text>
              <TouchableOpacity
                style={[styles.dateInput, !startDate && styles.dateInputDisabled]}
                onPress={() => startDate && openDatePicker('end')}
                disabled={!startDate}
              >
                <Text style={[styles.dateInputText, !endDate && styles.dateInputPlaceholder]}>
                  {endDate || 'YYYY-MM-DD'}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
            </View>
          </View>

          <CalendarModal
            visible={showDatePicker.start || showDatePicker.end}
            onClose={closeDatePicker}
            onSelectDate={selectDate}
            currentDate={tempDate}
            minDate={null}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reason (Optional)</Text>
            <TextInput
              style={styles.textArea}
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason for leave..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleMarkLeave}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>Mark Leave</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>
      )}

      {/* Leave Requests List */}
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>
            {canApproveLeave ? 'Leave Requests' : 'My Leave Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent style={styles.cardContent}>
          {filteredLeaveRequests.length === 0 ? (
            <Text style={styles.emptyText}>No leave requests found</Text>
          ) : (
            filteredLeaveRequests.map(request => (
              <View key={request.id} style={styles.requestItem}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderLeft}>
                    <Text style={styles.staffName}>{request.staff_name || 'Unknown Staff'}</Text>
                    {request.staff_department && (
                      <Text style={styles.departmentName}>Dept: {request.staff_department}</Text>
                    )}
                    {request.supervisor_name && (
                      <Text style={styles.supervisorName}>Supervisor: {request.supervisor_name}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{request.status?.toUpperCase() || 'PENDING'}</Text>
                  </View>
                </View>

                <Text style={styles.leaveType}>
                  {getLeaveTypeLabel(request.leave_type)}
                </Text>

                <Text style={styles.dates}>
                  {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                </Text>

                {request.reason && (
                  <Text style={styles.reason}>{request.reason}</Text>
                )}

                {request.approved_by_name && (
                  <Text style={styles.approvedBy}>
                    {request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Rejected' : 'Processed'} by: {request.approved_by_name}
                  </Text>
                )}

                {request.status === 'pending' && !canApproveRequest(request) && (
                  <Text style={styles.pendingApproval}>
                    ⏳ Awaiting approval from: {getApprovalAuthority(request)}
                  </Text>
                )}

                {request.staff_id === currentUserId && request.status === 'pending' && (
                  <Text style={styles.ownRequestNote}>
                    📝 This is your leave request
                  </Text>
                )}

                {canApproveRequest(request) && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request.id)}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(request.id)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    flex: 1,
  },
  radioOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateInputDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  calendarIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthNavButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  monthNavText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarDayToday: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  calendarDaySelected: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333',
  },
  calendarDayTextToday: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  calendarDayTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  calendarDayTextDisabled: {
    color: '#ccc',
  },
  calendarFooter: {
    alignItems: 'center',
  },
  calendarCloseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  calendarCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  requestItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  departmentName: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 2,
    fontWeight: '500',
  },
  supervisorName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  leaveType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dates: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  reason: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  approvedBy: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  pendingApproval: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 4,
    fontStyle: 'italic',
  },
  ownRequestNote: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LeaveManagementScreen;
