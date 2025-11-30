// This file is kept for backward compatibility
// All functionality has been migrated to REST API via staff.js
// Import from staff.js instead

import { fetchSupervisors as fetchSupervisorsFromStaff } from './staff';
import apiClient from './apiClient';

export const fetchSupervisors = async () => {
  // Use the migrated version from staff.js
  return await fetchSupervisorsFromStaff();
};

export const createSupervisor = async (payload) => {
  try {
    // Create supervisor via REST API
    const response = await apiClient.post('/users', {
      email: payload.email,
      full_name: payload.name,
      role: 'supervisor',
      password: payload.password || 'TempPassword123!' // Should be changed by admin
    });
    
    return {
      user_id: response.data.user_id || response.data.id,
      name: response.data.full_name || response.data.name,
      email: response.data.email,
    };
  } catch (error) {
    console.error('Failed to create supervisor:', error);
    throw error;
  }
};
