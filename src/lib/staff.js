import apiClient from './apiClient';
import { PARSE_CLASSES, USER_ROLES } from './apiClient';

// Fetch all staff members
export async function fetchStaff() {
  try {
    const response = await apiClient.get('/users/staff');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching staff:', error);
    throw error;
  }
}

// Fetch all supervisors
export async function fetchSupervisors() {
  try {
    const response = await apiClient.get('/users/supervisors');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    throw error;
  }
}

export async function fetchManagers() {
  try {
    const response = await apiClient.get('/users/managers');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching managers:', error);
    throw error;
  }
}

export async function fetchGeneralManagers() {
  try {
    const response = await apiClient.get('/users/general-managers');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching general managers:', error);
    throw error;
  }
}

export async function fetchExecutives() {
  try {
    const response = await apiClient.get('/users/executives');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching executives:', error);
    throw error;
  }
}

// Fetch all profiles (admin function)
export async function fetchProfiles(includeInactive = false) {
  try {
    const response = await apiClient.get('/users', {
      includeInactive: includeInactive
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching profiles:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(userId, updates) {
  try {
    const sanitize = (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    };

    const payload = {
      full_name: updates.full_name,
      role: updates.role,
      profile_photo_url: sanitize(updates.profile_photo_url),
      empFname: sanitize(updates.empFname),
      empDeptt: sanitize(updates.empDeptt),
      empJob: sanitize(updates.empJob),
      empGrade: sanitize(updates.empGrade),
      empCell1: sanitize(updates.empCell1),
      empCell2: sanitize(updates.empCell2),
      empFlg: sanitize(updates.empFlg),
      empMarried: sanitize(updates.empMarried),
      empGender: sanitize(updates.empGender),
      empNo: sanitize(updates.empNo),
      empCnic: sanitize(updates.empCnic),
      shiftDays:
        updates.shiftDays !== undefined
          ? Number(updates.shiftDays)
          : undefined,
      shiftTime: sanitize(updates.shiftTime),
      shiftStartTime: sanitize(updates.shiftStartTime),
      shiftEndTime: sanitize(updates.shiftEndTime),
      is_active:
        typeof updates.is_active === 'boolean'
          ? updates.is_active
          : updates.isActive,
    };

    if (updates.password && updates.password.trim() !== '') {
      payload.password = updates.password;
    }

    const response = await apiClient.put(`/users/${userId}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Update current user's profile (name, password, and profile photo)
export async function updateCurrentUserProfile(updates) {
  try {
    const user = await apiClient.getUser();
    if (!user || !user.user_id) {
      throw new Error('No user logged in');
    }

    const userId = user.user_id || user.id;
    const response = await apiClient.put(`/users/${userId}`, {
      full_name: updates.full_name,
      password: updates.password,
      profile_photo_url: updates.profile_photo_url
    });
    
    // Update stored user data
    if (response.success && response.data) {
      await apiClient.setUser({ ...user, ...response.data });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating current user profile:', error);
    throw error;
  }
}

// Check if user can be deleted (no child data)
export async function checkUserCanDelete(userId) {
  try {
    const response = await apiClient.get(`/users/${userId}/can-delete`);
    return {
      canDelete: response.canDelete,
      hasStaffAssignments: response.hasStaffAssignments,
      hasAttendance: response.hasAttendance,
      hasSupervisorMappings: response.hasSupervisorMappings,
      hasLeaveRequests: response.hasLeaveRequests,
      reason: response.reason
    };
  } catch (error) {
    console.error('Error checking user deletability:', error);
    // Default to not allowing delete on error
    return { canDelete: false, reason: 'Unable to verify deletion status' };
  }
}

// Delete user
export async function deleteUser(userId) {
  try {
    await apiClient.delete(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    // Check if error is due to having children
    if (error.response?.data?.hasChildren) {
      throw new Error(error.response.data.error || 'Cannot delete user with associated data');
    }
    throw new Error(error.message || 'Failed to delete user');
  }
}

export async function updateUserLeadership(userId, payload) {
  try {
    const response = await apiClient.put(`/users/${userId}/leadership`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating user leadership information:', error);
    throw new Error(error.message || 'Failed to update leadership data');
  }
}

// Fetch assigned supervisors for a staff member
export async function fetchAssignedSupervisors(staffId) {
  try {
    const response = await apiClient.get('/assignments');
    const assignments = response.data || [];
    const staffAssignments = assignments.filter(ass => 
      ass.staff_id === staffId && ass.is_active
    );
    
    return staffAssignments.map(assignment => ({
      supervisor_id: assignment.supervisor_id,
      full_name: assignment.supervisor_name,
      email: null // Email not returned in assignments endpoint
    }));
  } catch (error) {
    console.error('Error fetching assigned supervisors:', error);
    throw error;
  }
}

// Fetch areas (NC Locations)
export async function fetchAreas() {
  try {
    const response = await apiClient.get('/locations');
    return (response.data || []).map(location => ({
      id: location.id,
      name: location.name,
      center_lat: location.center_lat,
      center_lng: location.center_lng,
      radius_meters: location.radius_meters,
      morning_shift_start: location.morning_shift_start,
      morning_shift_end: location.morning_shift_end,
      night_shift_start: location.night_shift_start,
      night_shift_end: location.night_shift_end
    }));
  } catch (error) {
    console.error('Error fetching areas:', error);
    throw error;
  }
}
