import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Check if user is within geofence
export function isWithinGeofence(userLat, userLng, centerLat, centerLng, radiusMeters) {
  const distance = calculateDistance(userLat, userLng, centerLat, centerLng);
  return distance <= radiusMeters;
}

// Check if a location is an office location
export function isOfficeLocation(location) {
  if (!location) return false;
  const name = (location.name || '').toLowerCase();
  const code = (location.code || '').toLowerCase();
  return name.includes('office') || code.includes('office') || location.isOffice === true;
}

// Fetch all locations
export async function fetchLocations() {
  try {
    const response = await apiClient.get('/locations');
    return (response.data || []).map(location => ({
      id: location.id,
      name: location.name,
      code: location.code,
      description: location.description,
      center_lat: location.center_lat,
      center_lng: location.center_lng,
      radius_meters: location.radius_meters,
      morning_shift_start: location.morning_shift_start,
      morning_shift_end: location.morning_shift_end,
      night_shift_start: location.night_shift_start,
      night_shift_end: location.night_shift_end
    }));
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
}

// Create a new location
export async function createLocation(locationData) {
  try {
    const response = await apiClient.post('/locations', {
      name: locationData.name,
      code: locationData.code,
      description: locationData.description,
      centerLat: parseFloat(locationData.center_lat),
      centerLng: parseFloat(locationData.center_lng),
      radiusMeters: parseInt(locationData.radius_meters, 10),
      morningShiftStart: locationData.morning_shift_start,
      morningShiftEnd: locationData.morning_shift_end,
      nightShiftStart: locationData.night_shift_start,
      nightShiftEnd: locationData.night_shift_end
    });
    return { success: true, id: response.data.id };
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
}

// Update an existing location
export async function updateLocation(locationId, locationData) {
  try {
    await apiClient.put(`/locations/${locationId}`, {
      name: locationData.name,
      code: locationData.code,
      description: locationData.description,
      centerLat: parseFloat(locationData.center_lat),
      centerLng: parseFloat(locationData.center_lng),
      radiusMeters: parseInt(locationData.radius_meters, 10),
      morningShiftStart: locationData.morning_shift_start,
      morningShiftEnd: locationData.morning_shift_end,
      nightShiftStart: locationData.night_shift_start,
      nightShiftEnd: locationData.night_shift_end
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

// Delete a location
export async function deleteLocation(locationId) {
  try {
    console.log('Attempting to delete location with id:', locationId);
    await apiClient.delete(`/locations/${locationId}`);
    console.log('Location deleted successfully');
    return { success: true, message: 'Location deleted successfully' };
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
}

// Fetch assignments for current user
export async function fetchAssignments() {
  try {
    const response = await apiClient.get('/assignments');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching assignments:', error);
    throw error;
  }
}

// Fetch supervisor locations
export async function fetchSupervisorLocations() {
  try {
    const response = await apiClient.get('/assignments/supervisor-locations');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching supervisor locations:', error);
    throw error;
  }
}

// Update location shift times
export async function updateLocationShiftTimes(locationId, shiftTimes) {
  try {
    await apiClient.put(`/locations/${locationId}`, {
      morningShiftStart: shiftTimes.morning_shift_start,
      morningShiftEnd: shiftTimes.morning_shift_end,
      nightShiftStart: shiftTimes.night_shift_start,
      nightShiftEnd: shiftTimes.night_shift_end
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating location shift times:', error);
    throw error;
  }
}

// Fetch shift times for a location
export async function fetchLocationShiftTimes(locationId) {
  try {
    const response = await apiClient.get('/locations');
    const location = (response.data || []).find(loc => loc.id === locationId);
    if (!location) return null;

    return {
      morning_shift_start: location.morning_shift_start,
      morning_shift_end: location.morning_shift_end,
      night_shift_start: location.night_shift_start,
      night_shift_end: location.night_shift_end
    };
  } catch (error) {
    console.error('Error fetching location shift times:', error);
    throw error;
  }
}
