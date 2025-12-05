import apiClient from './apiClient';

/**
 * Get all holidays
 */
export async function fetchHolidays() {
  try {
    const response = await apiClient.get('/holidays');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching holidays:', error);
    throw error;
  }
}

/**
 * Create a new holiday
 */
export async function createHoliday(holidayData) {
  try {
    const response = await apiClient.post('/holidays', {
      date: holidayData.date,
      name: holidayData.name,
      description: holidayData.description || ''
    });
    return response.data;
  } catch (error) {
    console.error('Error creating holiday:', error);
    throw error;
  }
}

/**
 * Update a holiday
 */
export async function updateHoliday(holidayId, holidayData) {
  try {
    const response = await apiClient.put(`/holidays/${holidayId}`, {
      name: holidayData.name,
      description: holidayData.description
    });
    return response.data;
  } catch (error) {
    console.error('Error updating holiday:', error);
    throw error;
  }
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(holidayId) {
  try {
    const response = await apiClient.delete(`/holidays/${holidayId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting holiday:', error);
    throw error;
  }
}

/**
 * Check if a specific date is a holiday
 */
export async function checkHoliday(date) {
  try {
    const response = await apiClient.get(`/holidays/check/${date}`);
    return response.data;
  } catch (error) {
    console.error('Error checking holiday:', error);
    throw error;
  }
}

