// This file is kept for backward compatibility
// All functionality has been migrated to REST API via leaveRequests.js
// Import from leaveRequests.js instead

import * as leaveRequests from './leaveRequests';

// Re-export all functions from leaveRequests.js
export const fetchLeaveRequests = leaveRequests.fetchLeaveRequests;
export const createLeaveRequest = leaveRequests.createLeaveRequest;
export const updateLeaveRequestStatus = leaveRequests.updateLeaveRequestStatus;
export const deleteLeaveRequest = leaveRequests.deleteLeaveRequest;
export const getPendingLeaveRequests = leaveRequests.getPendingLeaveRequests;
export const getLeaveRequestsByStaff = leaveRequests.getLeaveRequestsByStaff;
export const submitLeaveRequest = leaveRequests.createLeaveRequest;
export const approveLeaveRequest = leaveRequests.approveLeaveRequest;
export const rejectLeaveRequest = leaveRequests.rejectLeaveRequest;
