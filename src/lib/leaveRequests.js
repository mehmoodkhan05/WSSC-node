import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';

// Fetch leave requests
export async function fetchLeaveRequests(filters = {}) {
  try {
    // Build query params, only include defined values
    const params = {};
    if (filters.staffId) params.staffId = filters.staffId;
    if (filters.status) params.status = filters.status;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    
    const response = await apiClient.get('/leave', params);

    return (response.data || []).map(request => ({
      id: request.id,
      staff_id: request.staff_id,
      staff_name: request.staff_name || 'Unknown Staff',
      staff_department: request.staff_department || null,
      staff_role: request.staff_role || null,
      staff_manager_id: request.staff_manager_id || null,
      staff_gm_id: request.staff_gm_id || null,
      supervisor_id: request.supervisor_id,
      supervisor_name: request.supervisor_name,
      supervisor_manager_id: request.supervisor_manager_id || null,
      leave_type: request.leave_type,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason,
      status: request.status,
      approved_by: request.approved_by,
      approved_by_name: request.approved_by_name,
      created_at: request.created_at ? new Date(request.created_at) : null,
      updated_at: request.updated_at ? new Date(request.updated_at) : null
    }));
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    throw error;
  }
}

// Create leave request
export async function createLeaveRequest(payload) {
  try {
    const response = await apiClient.post('/leave', {
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id || null,
      leave_type: payload.leave_type,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason || ''
    });

    return {
      id: response.data.id,
      staff_id: response.data.staff_id,
      supervisor_id: response.data.supervisor_id || null,
      leave_type: response.data.leave_type,
      start_date: response.data.start_date,
      end_date: response.data.end_date,
      reason: response.data.reason,
      status: response.data.status,
      created_at: response.data.created_at
    };
  } catch (error) {
    console.error('Error creating leave request:', error);
    throw error;
  }
}

// Update leave request status
export async function updateLeaveRequestStatus(requestId, status, approvedById = null) {
  try {
    const response = await apiClient.put(`/leave/${requestId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('Error updating leave request:', error);
    throw error;
  }
}

// Delete leave request
export async function deleteLeaveRequest(requestId) {
  try {
    // Note: Backend may not have delete endpoint, keeping for compatibility
    await apiClient.delete(`/leave/${requestId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting leave request:', error);
    throw error;
  }
}

// Get leave requests for approval (pending requests)
export async function getPendingLeaveRequests() {
  try {
    return await fetchLeaveRequests({ status: 'pending' });
  } catch (error) {
    console.error('Error getting pending leave requests:', error);
    throw error;
  }
}

// Get leave requests by staff
export async function getLeaveRequestsByStaff(staffId) {
  try {
    return await fetchLeaveRequests({ staffId });
  } catch (error) {
    console.error('Error getting leave requests by staff:', error);
    throw error;
  }
}
