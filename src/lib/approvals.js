import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';

// Fetch pending approvals
export async function fetchPendingApprovals() {
  try {
    const response = await apiClient.get('/approvals/pending');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    throw error;
  }
}

// Approve attendance
export async function approveAttendance(attendanceId, approvedById = null) {
  try {
    const response = await apiClient.put(`/approvals/attendance/${attendanceId}/approve`);
    return response.data;
  } catch (error) {
    console.error('Error approving attendance:', error);
    throw error;
  }
}

// Reject attendance
export async function rejectAttendance(attendanceId, approvedById = null) {
  try {
    const response = await apiClient.put(`/approvals/attendance/${attendanceId}/reject`);
    return response.data;
  } catch (error) {
    console.error('Error rejecting attendance:', error);
    throw error;
  }
}

// Bulk approve attendance records
export async function bulkApproveAttendance(attendanceIds, approvedById) {
  try {
    const promises = attendanceIds.map(id => approveAttendance(id, approvedById));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error bulk approving attendance:', error);
    throw error;
  }
}

// Bulk reject attendance records
export async function bulkRejectAttendance(attendanceIds, approvedById) {
  try {
    const promises = attendanceIds.map(id => rejectAttendance(id, approvedById));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error bulk rejecting attendance:', error);
    throw error;
  }
}

// Mark overtime (supervisor action - needs manager approval)
export async function markOvertime(attendanceId) {
  try {
    const response = await apiClient.put(`/approvals/mark-overtime/${attendanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error marking overtime:', error);
    throw error;
  }
}

// Mark double duty (supervisor action - needs manager approval)
export async function markDoubleDuty(attendanceId) {
  try {
    const response = await apiClient.put(`/approvals/mark-double-duty/${attendanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error marking double duty:', error);
    throw error;
  }
}

// Approve overtime (manager action)
export async function approveOvertime(attendanceId) {
  try {
    const response = await apiClient.put(`/approvals/approve-overtime/${attendanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error approving overtime:', error);
    throw error;
  }
}

// Reject overtime (manager action)
export async function rejectOvertime(attendanceId, reason = null) {
  try {
    const response = await apiClient.put(`/approvals/reject-overtime/${attendanceId}`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error rejecting overtime:', error);
    throw error;
  }
}

// Approve double duty (manager action)
export async function approveDoubleDuty(attendanceId) {
  try {
    const response = await apiClient.put(`/approvals/approve-double-duty/${attendanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error approving double duty:', error);
    throw error;
  }
}

// Fetch pending overtime and double duty approvals (manager action)
export async function fetchPendingOvertimeDoubleDuty() {
  try {
    const response = await apiClient.get('/approvals/pending-overtime-doubleduty');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching pending overtime/double duty:', error);
    throw error;
  }
}

// Reject double duty (manager action)
export async function rejectDoubleDuty(attendanceId, reason = null) {
  try {
    const response = await apiClient.put(`/approvals/reject-double-duty/${attendanceId}`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error rejecting double duty:', error);
    throw error;
  }
}