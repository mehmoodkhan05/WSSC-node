import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';

// Clock in function
export async function clockIn(payload) {
  try {
    const response = await apiClient.post('/attendance/clock-in', {
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id,
      nc_location_id: payload.nc_location_id,
      overtime: payload.overtime || false,
      double_duty: payload.double_duty || false,
      lat: payload.lat,
      lng: payload.lng,
      clock_in_photo_url: payload.clock_in_photo_url,
      is_override: payload.is_override || false,
      clocked_by_id: payload.clocked_by_id || null
    });
    return response.data;
  } catch (error) {
    console.error('Error clocking in:', error);
    throw error;
  }
}

// Clock out function
export async function clockOut(payload) {
  try {
    const response = await apiClient.post('/attendance/clock-out', {
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id,
      nc_location_id: payload.nc_location_id,
      lat: payload.lat,
      lng: payload.lng,
      clock_out_photo_url: payload.clock_out_photo_url,
      is_override: payload.is_override || false,
      clocked_by_id: payload.clocked_by_id || null
    });
    return response.data;
  } catch (error) {
    console.error('Error clocking out:', error);
    throw error;
  }
}

// Fetch attendance report
export async function fetchAttendanceReport(filters = {}) {
  try {
    const dateFromStr = filters.dateFrom instanceof Date
      ? filters.dateFrom.toISOString().split('T')[0]
      : filters.dateFrom || null;

    const dateToStr = filters.dateTo instanceof Date
      ? filters.dateTo.toISOString().split('T')[0]
      : filters.dateTo || null;

    if (!dateFromStr || !dateToStr) {
      return [];
    }

    const response = await apiClient.get('/attendance/report', {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      supervisorId: filters.supervisorId || null,
      areaId: filters.areaId || null,
      status: filters.status || 'all',
    });

    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    throw error;
  }
}

// Fetch today's attendance for dashboard
export async function fetchTodayAttendance() {
  try {
    const response = await apiClient.get('/attendance/today');
    return (response.data || []).map(record => ({
      id: record.id,
      staffId: record.staffId,
      staffName: record.staffName || 'Unknown Staff',
      supervisorId: record.supervisorId,
      supervisorName: record.supervisorName || 'Unknown Supervisor',
      nc_location_id: record.nc_location_id,
      nc: record.nc || 'N/A',
      date: record.date,
      clockIn: record.clockIn,
      clockOut: record.clockOut,
      status: record.status ? record.status.toLowerCase().replace(' ', '-') : 'absent',
      approvalStatus: record.approvalStatus || 'pending',
      overtime: record.overtime || false,
      doubleDuty: record.doubleDuty || false,
      clockedInBy: record.clockedInBy || null,
      clockedOutBy: record.clockedOutBy || null,
      isOverride: record.isOverride || false
    }));
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    throw error;
  }
}

export async function fetchAttendanceWithPhotos(params = {}) {
  try {
    const response = await apiClient.get('/approvals/attendance-with-photos', params);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching attendance with photos:', error);
    throw error;
  }
}

export async function hasActiveClockIn(staffId = null) {
  try {
    const user = await apiClient.getUser();
    const targetId = staffId || (user ? user.user_id || user.id : null);

    if (!targetId) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const response = await apiClient.get('/attendance/today');
    
    if (response.data && Array.isArray(response.data)) {
      const activeAttendance = response.data.find(record => 
        (record.staffId === targetId || record.staff_id === targetId) &&
        record.date === today &&
        !record.clockOut
      );
      return !!activeAttendance;
    }

    return false;
  } catch (error) {
    console.error('Error checking active clock-in:', error);
    return false;
  }
}

// Fetch leadership attendance (Managers, General Managers, Supervisors)
export async function fetchLeadershipAttendance() {
  try {
    // Use today's attendance filtered by role on frontend or add backend endpoint
    const response = await apiClient.get('/attendance/today');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching leadership attendance:', error);
    throw error;
  }
}