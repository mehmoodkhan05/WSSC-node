import apiClient from './apiClient';

/**
 * Get system configuration (grace period and clock interval settings)
 * @returns {Promise<{gracePeriodMinutes: number, minClockIntervalHours: number}>}
 */
export async function getSystemConfig() {
  try {
    const response = await apiClient.get('/system/config');
    return response.data;
  } catch (error) {
    console.error('Error fetching system config:', error);
    throw error;
  }
}

/**
 * Update system configuration (CEO/SuperAdmin only)
 * @param {Object} config - Configuration object
 * @param {number} config.gracePeriodMinutes - Grace period in minutes (0-1440)
 * @param {number} config.minClockIntervalHours - Minimum clock interval in hours (0-24)
 * @returns {Promise<{success: boolean, gracePeriodMinutes: number, minClockIntervalHours: number}>}
 */
export async function updateSystemConfig(config) {
  try {
    const { gracePeriodMinutes, minClockIntervalHours } = config;
    
    if (gracePeriodMinutes !== undefined && gracePeriodMinutes !== null) {
      const minutes = parseInt(gracePeriodMinutes, 10);
      if (isNaN(minutes) || minutes < 0 || minutes > 1440) {
        throw new Error('Grace period must be between 0 and 1440 minutes (24 hours)');
      }
    }
    
    if (minClockIntervalHours !== undefined && minClockIntervalHours !== null) {
      const hours = parseFloat(minClockIntervalHours);
      if (isNaN(hours) || hours < 0 || hours > 24) {
        throw new Error('Minimum clock interval must be between 0 and 24 hours');
      }
    }
    
    const response = await apiClient.put('/system/config', {
      gracePeriodMinutes,
      minClockIntervalHours
    });
    
    return response.data;
  } catch (error) {
    console.error('Error updating system config:', error);
    throw error;
  }
}

