import apiClient from './apiClient';

// Fetch all zones (optionally filtered by location_id)
export async function fetchZones(locationId = null) {
  try {
    const params = locationId ? { location_id: locationId } : {};
    const response = await apiClient.get('/zones', { params });
    // Backend returns { success: true, data: [...] }
    const zones = response.data || [];
    return zones.map(zone => ({
      id: zone.id,
      name: zone.name,
      location_id: zone.location_id,
      location_name: zone.location_name,
      description: zone.description,
      center_lat: zone.center_lat,
      center_lng: zone.center_lng,
      radius_meters: zone.radius_meters,
      is_active: zone.is_active
    }));
  } catch (error) {
    console.error('Error fetching zones:', error);
    throw error;
  }
}

// Fetch a single zone by ID
export async function fetchZone(zoneId) {
  try {
    const response = await apiClient.get(`/zones/${zoneId}`);
    // Backend returns { success: true, data: {...} }
    const zone = response.data;
    return {
      id: zone.id,
      name: zone.name,
      location_id: zone.location_id,
      location_name: zone.location_name,
      description: zone.description,
      center_lat: zone.center_lat,
      center_lng: zone.center_lng,
      radius_meters: zone.radius_meters,
      is_active: zone.is_active
    };
  } catch (error) {
    console.error('Error fetching zone:', error);
    throw error;
  }
}

// Create a new zone
export async function createZone(zoneData) {
  try {
    console.log('Creating zone with data:', zoneData);
    const response = await apiClient.post('/zones', {
      name: zoneData.name,
      location_id: zoneData.location_id,
      description: zoneData.description || '',
      center_lat: parseFloat(zoneData.center_lat),
      center_lng: parseFloat(zoneData.center_lng),
      radius_meters: parseInt(zoneData.radius_meters, 10)
    });
    console.log('Zone creation response:', response);
    // Backend returns { success: true, data: {...} }
    if (response.success && response.data) {
      return { success: true, id: response.data.id };
    }
    throw new Error('Invalid response from server');
  } catch (error) {
    console.error('Error creating zone:', error);
    console.error('Error message:', error.message);
    throw error;
  }
}

// Update an existing zone
export async function updateZone(zoneId, zoneData) {
  try {
    const updateData = {};
    if (zoneData.name !== undefined) updateData.name = zoneData.name;
    if (zoneData.description !== undefined) updateData.description = zoneData.description;
    if (zoneData.center_lat !== undefined) updateData.center_lat = parseFloat(zoneData.center_lat);
    if (zoneData.center_lng !== undefined) updateData.center_lng = parseFloat(zoneData.center_lng);
    if (zoneData.radius_meters !== undefined) updateData.radius_meters = parseInt(zoneData.radius_meters, 10);

    await apiClient.put(`/zones/${zoneId}`, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating zone:', error);
    throw error;
  }
}

// Delete a zone
export async function deleteZone(zoneId) {
  try {
    const response = await apiClient.delete(`/zones/${zoneId}`);
    return { success: true, message: 'Zone deleted successfully' };
  } catch (error) {
    console.error('Error deleting zone:', error);
    // Check if error message contains hasAssignments info
    if (error.message && error.message.includes('active staff assignments')) {
      throw error;
    }
    throw error;
  }
}

