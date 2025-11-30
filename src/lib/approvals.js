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
