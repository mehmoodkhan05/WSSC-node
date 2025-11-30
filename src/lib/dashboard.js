import apiClient from './apiClient';

// Get dashboard stats
export async function getDashboardStats() {
  try {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// Get stats by role and department
export async function getStatsByRoleAndDepartment(departmentId = null) {
  try {
    const params = departmentId ? { departmentId } : {};
    const response = await apiClient.get('/dashboard/stats-by-role-dept', params);
    return response.data;
  } catch (error) {
    console.error('Error fetching stats by role and department:', error);
    throw error;
  }
}

// Fetch today's leave requests
export async function fetchTodayLeaveRequests() {
  try {
    const response = await apiClient.get('/leave/today');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching today leave requests:', error);
    throw error;
  }
}

