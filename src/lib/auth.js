import apiClient from './apiClient';
import { USER_ROLES } from './apiClient';

// Sign up with email and password
export async function signUpWithEmail(email, password, role = USER_ROLES.STAFF, fullName = '') {
  try {
    const response = await apiClient.post('/auth/register', {
      email,
      password,
      fullName,
      role
    });

    if (response.success && response.token) {
      await apiClient.setToken(response.token);
      await apiClient.setUser(response.user);
      return { user: response.user, error: null };
    }
    return { user: null, error: response.error || 'Registration failed' };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

// Sign in with email and password
export async function signInWithEmail(email, password) {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password
    });

    if (response.success && response.token) {
      await apiClient.setToken(response.token);
      await apiClient.setUser(response.user);
      return { user: response.user, error: null };
    }
    return { user: null, error: response.error || 'Login failed' };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

// Sign out
export async function signOut() {
  try {
    await apiClient.clearAuth();
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Get current session
export async function getSession() {
  try {
    const user = await apiClient.getUser();
    const token = await apiClient.getToken();
    return token && user ? { session: user, error: null } : { session: null, error: null };
  } catch (error) {
    return { session: null, error: error.message };
  }
}

// Get current user profile
export async function getProfile() {
  try {
    const response = await apiClient.get('/auth/me');
    
    if (response.success && response.user) {
      await apiClient.setUser(response.user);
      return {
        user_id: response.user.user_id,
        email: response.user.email,
        full_name: response.user.full_name,
        role: response.user.role,
        username: response.user.username,
        profile_photo_url: response.user.profile_photo_url || null,
        department: response.user.department || null,
        departments: response.user.departments || [],
        manager_id: response.user.manager_id || null,
        general_manager_id: response.user.general_manager_id || null,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
}

// Simple auth guard utility
export async function requireSession() {
  try {
    const token = await apiClient.getToken();
    return !!token;
  } catch (error) {
    return false;
  }
}

// Check if user has specific role
export async function hasRole(requiredRole) {
  try {
    const profile = await getProfile();
    return profile && profile.role === requiredRole;
  } catch (error) {
    return false;
  }
}

// Admin functions
export async function adminCreateUser(
  email, 
  password, 
  fullName = '', 
  role = USER_ROLES.STAFF,
  employeeFields = {}
) {
  try {
    const response = await apiClient.post('/users', {
      email,
      password,
      fullName,
      role,
      empFname: employeeFields.empFname || null,
      empDeptt: employeeFields.empDeptt || null,
      empJob: employeeFields.empJob || null,
      empGrade: employeeFields.empGrade || null,
      empCell1: employeeFields.empCell1 || null,
      empCell2: employeeFields.empCell2 || null,
      empFlg: employeeFields.empFlg || null,
      empMarried: employeeFields.empMarried || null,
      empGender: employeeFields.empGender || null,
    });
    return { user: response.data, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

export async function updateUserRole(userId, role) {
  try {
    const response = await apiClient.put(`/users/${userId}`, { role });
    return { success: true, result: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteUser(userId) {
  try {
    await apiClient.delete(`/users/${userId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
