import apiClient from './apiClient';
import {
  ROLE,
  normalizeRole,
  hasManagementPrivileges,
  hasFullControl,
} from './roles';
import * as Location from 'expo-location';
import { hasActiveClockIn } from './attendance';

let locationSubscription = null;
let trackingUserId = null;

// Start live tracking for a staff member
export async function startLiveTracking(staffId) {
  try {
    const response = await apiClient.post('/live-tracking/start');
    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to start live tracking');
  } catch (error) {
    console.error('Error starting live tracking:', error);
    throw error;
  }
}

// Stop live tracking for a staff member
export async function stopLiveTracking(staffId) {
  try {
    const response = await apiClient.post('/live-tracking/stop');
    if (response.success) {
      return true;
    }
    throw new Error(response.error || 'Failed to stop live tracking');
  } catch (error) {
    console.error('Error stopping live tracking:', error);
    // Don't throw error for cleanup failures
    return false;
  }
}

// Update live tracking location
export async function updateLiveTrackingLocation(staffId, latitude, longitude) {
  try {
    const response = await apiClient.post('/live-tracking/update-location', {
      latitude,
      longitude
    });
    if (response.success) {
      return true;
    }
    // Don't throw error for location updates
    return false;
  } catch (error) {
    console.error('Error updating live tracking location:', error);
    // Don't throw error for location updates
    return false;
  }
}

export async function isLiveTrackingActive(staffId = null) {
  try {
    const currentUser = await apiClient.getUser();
    const targetId = staffId || (currentUser ? (currentUser.user_id || currentUser.id) : null);

    if (!targetId) {
      return false;
    }

    const response = await apiClient.get(`/live-tracking/status/${targetId}`);
    if (response.success && response.data) {
      return response.data.isActive === true;
    }
    return false;
  } catch (error) {
    console.error('Error checking live tracking status:', error);
    return false;
  }
}

export async function startLocationTracking(options = {}) {
  try {
    const currentUser = await apiClient.getUser();
    if (!currentUser) {
      console.warn('startLocationTracking called without authenticated user');
      return false;
    }

    const staffId = currentUser.id || currentUser.user_id;

    if (locationSubscription && trackingUserId === staffId) {
      return true;
    }

    const activeClockIn = await hasActiveClockIn(staffId);
    if (!activeClockIn) {
      console.info('Skipping startLocationTracking: no active clock-in for user', staffId);
      return false;
    }

    await startLiveTracking(staffId);

    const {
      accuracy = Location.Accuracy.High,
      distanceInterval = 25,
      timeInterval = 15000,
    } = options;

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy,
        distanceInterval,
        timeInterval,
      },
      (location) => {
        const { coords } = location || {};
        if (!coords) return;

        const { latitude, longitude } = coords;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return;
        }

        updateLiveTrackingLocation(staffId, latitude, longitude).catch((error) => {
          console.error('Error updating live tracking location from watcher:', error);
        });
      }
    );

    trackingUserId = staffId;
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    if (error?.message !== 'Not authenticated') {
      throw error;
    }
    return false;
  }
}

export async function stopLocationTracking() {
  try {
    const currentUser = await apiClient.getUser();
    const staffId = currentUser ? (currentUser.user_id || currentUser.id) : trackingUserId;

    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    trackingUserId = null;

    if (staffId) {
      await stopLiveTracking(staffId);
    }
  } catch (error) {
    console.error('Error stopping location tracking:', error);
    throw error;
  }
}

// Get live tracking data for staff
export async function getLiveTrackingData(staffId, date = null) {
  try {
    const queryParams = date ? { date } : {};
    const response = await apiClient.get(`/live-tracking/${staffId}`, queryParams);
    
    if (response.success) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error getting live tracking data:', error);
    throw error;
  }
}

// Get all active live tracking for supervisor
async function getSupervisorAssignments(supervisorId) {
  try {
    const response = await apiClient.get('/assignments', { supervisorId });
    if (response.success && Array.isArray(response.data)) {
      const staffIds = response.data
        .map(assignment => assignment.staffId || assignment.staff_id)
        .filter(Boolean)
        .map(id => String(id));
      return { staffIds };
    }
    return { staffIds: [] };
  } catch (error) {
    console.error('Error getting supervisor assignments:', error);
    return { staffIds: [] };
  }
}

export async function getActiveLiveTrackingForSupervisor(supervisorId) {
  try {
    const { staffIds } = await getSupervisorAssignments(supervisorId);

    if (staffIds.length === 0) {
      return { assignedStaffIds: [], active: [] };
    }

    // Get active tracking for all assigned staff
    const activeTrackingPromises = staffIds.map(async (staffId) => {
      try {
        const response = await apiClient.get(`/live-tracking/status/${staffId}`);
        if (response.success && response.data && response.data.isActive) {
          return {
            id: response.data.id,
            staffId: response.data.staffId,
            staffName: response.data.staffName,
            currentLat: response.data.currentLat,
            currentLng: response.data.currentLng,
            lastUpdate: response.data.lastUpdate,
            locations: response.data.locations || [],
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching tracking for staff ${staffId}:`, error);
        return null;
      }
    });

    const activeResults = await Promise.all(activeTrackingPromises);
    const active = activeResults.filter(Boolean);

    return {
      assignedStaffIds: staffIds,
      active,
    };
  } catch (error) {
    console.error('Error getting active live tracking:', error);
    throw error;
  }
}

// Fetch live locations for map display
const normalizeLiveLocation = (location) => {
  if (!location) {
    return null;
  }

  const latitude = typeof location.latitude === 'number' 
    ? location.latitude 
    : typeof location.lat === 'number' 
    ? location.lat 
    : Number(location.latitude || location.lat);
    
  const longitude = typeof location.longitude === 'number' 
    ? location.longitude 
    : typeof location.lng === 'number' 
    ? location.lng 
    : Number(location.longitude || location.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const rawTimestamp = location.timestamp ?? location.lastUpdate ?? location.last_update;
  let timestamp = null;

  if (rawTimestamp instanceof Date) {
    timestamp = rawTimestamp;
  } else if (rawTimestamp?.iso) {
    timestamp = new Date(rawTimestamp.iso);
  } else if (typeof rawTimestamp === 'string') {
    const parsed = new Date(rawTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed;
    }
  }

  const resolveRole = () => {
    const rawRole =
      location.role ||
      location.userRole ||
      location.roleName ||
      location.staffRole ||
      location.statusRole;

    return typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
  };

  const resolveSupervisorId = () => {
    const supervisor =
      location.supervisorId ||
      location.supervisor_id ||
      location.assignmentSupervisorId ||
      location.supervisorID;

    if (!supervisor) {
      return null;
    }

    if (typeof supervisor === 'string') {
      return supervisor;
    }

    if (typeof supervisor === 'object') {
      return supervisor.id || supervisor.objectId || supervisor.user_id || null;
    }

    return null;
  };

  const resolvedRole = resolveRole();
  const supervisorId = resolveSupervisorId();

  const rawUserId =
    location.user_id ||
    location.staffId ||
    location.staff_id ||
    location.userId ||
    location.id;

  const userId =
    rawUserId == null
      ? null
      : typeof rawUserId === 'string'
      ? rawUserId
      : typeof rawUserId === 'number'
      ? String(rawUserId)
      : rawUserId?.id || rawUserId?.objectId || rawUserId?.user_id || null;

  if (!userId) {
    return null;
  }

  const parseRoute = () => {
    if (!Array.isArray(location.locations)) {
      return [];
    }

    return location.locations
      .map((point) => {
        if (!point) {
          return null;
        }

        const lat =
          typeof point.latitude === 'number'
            ? point.latitude
            : typeof point.lat === 'number'
            ? point.lat
            : typeof point.latitude === 'string'
            ? Number(point.latitude)
            : typeof point.lat === 'string'
            ? Number(point.lat)
            : null;
        const lng =
          typeof point.longitude === 'number'
            ? point.longitude
            : typeof point.lng === 'number'
            ? point.lng
            : typeof point.longitude === 'string'
            ? Number(point.longitude)
            : typeof point.lng === 'string'
            ? Number(point.lng)
            : null;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        const rawPointTimestamp = point.timestamp || point.time || point.recordedAt;
        let parsedTimestamp = null;
        if (rawPointTimestamp instanceof Date) {
          parsedTimestamp = rawPointTimestamp;
        } else if (rawPointTimestamp?.iso) {
          parsedTimestamp = new Date(rawPointTimestamp.iso);
        } else if (typeof rawPointTimestamp === 'string') {
          const parsed = new Date(rawPointTimestamp);
          if (!Number.isNaN(parsed.getTime())) {
            parsedTimestamp = parsed;
          }
        }

        return {
          latitude: lat,
          longitude: lng,
          timestamp: parsedTimestamp,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const at = a.timestamp ? a.timestamp.getTime() : 0;
        const bt = b.timestamp ? b.timestamp.getTime() : 0;
        return at - bt;
      });
  };

  const route = parseRoute();

  return {
    user_id: userId,
    name: location.name || location.staffName || location.staff_name || 'Unknown Staff',
    department: location.department || null,
    departments: Array.isArray(location.departments) ? location.departments : [],
    latitude,
    longitude,
    timestamp,
    status: location.status || 'inactive',
    speed: typeof location.speed === 'number' ? location.speed : undefined,
    role: resolvedRole,
    supervisorId,
    route,
  };
};

const filterLocationsByRole = async (locations, mapResults) => {
  const currentUser = await apiClient.getUser();
  if (!currentUser) {
    return [];
  }

  const rawRole = currentUser.role || currentUser.userRole || currentUser.roleName || null;
  const role = normalizeRole(rawRole);
  const currentUserId = String(currentUser.id || currentUser.user_id || '');

  // Get current user's department info from stored user data
  // Note: department info should be available from login/auth/me endpoint
  const currentUserDepartment = currentUser.department || currentUser.department_id || null;
  const currentUserDepartments = Array.isArray(currentUser.departments) 
    ? currentUser.departments 
    : (currentUser.department ? [currentUser.department] : []);
  
  // Determine role-based visibility
  const isCEOOrAdmin = role === ROLE.CEO || role === ROLE.SUPER_ADMIN;
  const isGeneralManager = role === ROLE.GENERAL_MANAGER;
  const isManager = role === ROLE.MANAGER;
  const isSupervisorRole = role === ROLE.SUPERVISOR;

  // Helper function to normalize department values for comparison
  const normalizeDept = (dept) => {
    if (!dept) return null;
    return String(dept).trim().toLowerCase();
  };

  // Helper function to check if location's department matches current user's department(s)
  const matchesDepartment = (locationDept, locationDepts) => {
    if (isCEOOrAdmin) {
      return true; // CEO/Admin sees all
    }

    if (isGeneralManager) {
      // GM: check against their departments array
      if (currentUserDepartments.length === 0) {
        return false; // GM with no departments assigned - see nothing
      }
      const normalizedUserDepts = currentUserDepartments.map(normalizeDept).filter(Boolean);
      const normalizedLocationDept = normalizeDept(locationDept);
      const normalizedLocationDepts = Array.isArray(locationDepts) 
        ? locationDepts.map(normalizeDept).filter(Boolean)
        : [];
      
      // Check if location's department matches any of GM's departments
      if (normalizedLocationDept && normalizedUserDepts.includes(normalizedLocationDept)) {
        return true;
      }
      if (normalizedLocationDepts.length > 0) {
        return normalizedLocationDepts.some(dept => normalizedUserDepts.includes(dept));
      }
      return false;
    }

    if (isManager) {
      // Manager: check against their single department
      if (!currentUserDepartment) {
        return false; // Manager with no department - see nothing
      }
      const normalizedUserDept = normalizeDept(currentUserDepartment);
      const normalizedLocationDept = normalizeDept(locationDept);
      return normalizedLocationDept === normalizedUserDept;
    }

    return false;
  };

  // Supervisor: only see self
  if (isSupervisorRole) {
    const normalizedCurrentId = String(currentUserId);
    const selfLocations = locations.filter((location) => {
      if (!location?.user_id) {
        return false;
      }
      const normalizedId =
        typeof location.user_id === 'string'
          ? location.user_id
          : typeof location.user_id === 'number'
          ? String(location.user_id)
          : location.user_id?.id || location.user_id?.objectId || null;
      if (!normalizedId) {
        return false;
      }
      return String(normalizedId) === normalizedCurrentId;
    });

    if (selfLocations.length > 0) {
      return selfLocations;
    }

    try {
      const response = await apiClient.get(`/live-tracking/status/${currentUserId}`);
      if (response.success && response.data && response.data.isActive) {
        const latitude = response.data.currentLat;
        const longitude = response.data.currentLng;
        const timestamp = response.data.lastUpdate;

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const name = currentUser.fullName || currentUser.full_name || currentUser.name || currentUser.username || 'Me';

          return [
            {
              user_id: normalizedCurrentId,
              name,
              latitude,
              longitude,
              timestamp,
              status: response.data.isActive ? 'active' : 'inactive',
              speed: undefined,
            },
          ];
        }
      }
    } catch (error) {
      console.error('Error fetching supervisor self tracking:', error);
    }

    return [];
  }

  // Filter locations based on role and department
  return locations.filter((location) => {
    if (!location) {
      return false;
    }

    // Filter out inactive locations
    const statusValue =
      location.status ?? location.isActive ?? location.active ?? location.is_active;
    const normalizedStatus =
      typeof statusValue === 'string'
        ? statusValue.toLowerCase()
        : typeof statusValue === 'boolean'
        ? statusValue
        : statusValue == null
        ? null
        : String(statusValue).toLowerCase();

    const isActive =
      normalizedStatus === true ||
      normalizedStatus === 'true' ||
      normalizedStatus === 'active' ||
      normalizedStatus === 1 ||
      normalizedStatus === '1' ||
      normalizedStatus === 'on';

    if (normalizedStatus !== null && !isActive) {
      return false;
    }

    // Don't show self
    const rawId = location?.user_id;
    if (rawId) {
      const normalizedId =
        typeof rawId === 'string'
          ? rawId
          : typeof rawId === 'number'
          ? String(rawId)
          : rawId?.id || rawId?.objectId || null;
      if (normalizedId && String(normalizedId) === currentUserId) {
        return false;
      }
    }

    // CEO/Admin: see all (already filtered out self above)
    if (isCEOOrAdmin) {
      return true;
    }

    // Manager/GM: filter by department
    if (isManager || isGeneralManager) {
      return matchesDepartment(location.department, location.departments);
    }

    // Default: only self (shouldn't reach here for roles above supervisor)
    return false;
  });
};

export async function fetchLiveLocations() {
  const mapResults = (results) =>
    (Array.isArray(results) ? results : [])
      .map(normalizeLiveLocation)
      .filter((location) => location);

  try {
    // Use REST API endpoint for live locations
    const response = await apiClient.get('/live-tracking/active');
    if (response.success && Array.isArray(response.data)) {
      const cloudResults = response.data.map(loc => ({
        user_id: loc.staff_id,
        name: loc.staff_name,
        department: loc.department || null,
        departments: loc.departments || [],
        latitude: loc.lat,
        longitude: loc.lng,
        timestamp: loc.timestamp,
        status: 'active',
        locations: []
      }));
      return await filterLocationsByRole(mapResults(cloudResults), mapResults);
    }
    return [];
  } catch (cloudError) {
    console.error('Error fetching live locations via REST API:', cloudError);
    return [];
  }
}
