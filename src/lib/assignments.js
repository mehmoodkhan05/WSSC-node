import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';

export const fetchAssignments = async () => {
  try {
    const response = await apiClient.get('/assignments');
    return response.data || [];
  } catch (error) {
    console.error('Failed to load assignments:', error);
    throw error;
  }
};

export const assignStaff = async (payload) => {
  try {
    const response = await apiClient.post('/assignments', {
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id,
      nc_location_id: payload.nc_location_id
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create assignment:', error);
    throw error;
  }
};

export const unassignStaff = async (id) => {
  try {
    await apiClient.put(`/assignments/${id}/deactivate`);
  } catch (error) {
    console.error('Failed to unassign staff:', error);
    throw error;
  }
};

export const fetchSupervisorLocations = async () => {
  try {
    const response = await apiClient.get('/assignments/supervisor-locations');
    return response.data || [];
  } catch (error) {
    console.error('Failed to load supervisor/location mappings:', error);
    throw error;
  }
};

export const assignSupervisorToLocation = async (payload) => {
  try {
    const response = await apiClient.post('/assignments/supervisor-locations', {
      supervisor_id: payload.supervisor_id,
      nc_location_id: payload.nc_location_id
    });
    return response.data;
  } catch (error) {
    console.error('Failed to assign supervisor to location:', error);
    throw error;
  }
};

export const unassignSupervisorFromLocation = async (id) => {
  try {
    await apiClient.delete(`/assignments/supervisor-locations/${id}`);
  } catch (error) {
    console.error('Failed to remove supervisor/location mapping:', error);
    throw error;
  }
};
