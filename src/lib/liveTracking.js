import { PARSE_CLASSES, USER_ROLES } from './apiClient';
import apiClient from './apiClient';

// NOTE: This file still uses Parse for some operations because the backend
// needs additional endpoints for full live tracking functionality.
// TODO: Migrate to REST API when backend endpoints are available:
// - POST /api/live-tracking/start
// - POST /api/live-tracking/stop
// - POST /api/live-tracking/update-location
// - GET /api/live-tracking/:staffId
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

function ensureTrackingAcl(tracking, staffId) {
  if (!tracking || !staffId) {
    return;
  }

  const owner = Parse.User.createWithoutData(staffId);
  const existingAcl = tracking.getACL?.();

  if (existingAcl) {
    let updated = false;

    if (!existingAcl.getPublicReadAccess()) {
      existingAcl.setPublicReadAccess(true);
      updated = true;
    }

    if (!existingAcl.getWriteAccess(staffId)) {
      existingAcl.setWriteAccess(staffId, true);
      updated = true;
    }

    if (!existingAcl.getReadAccess(staffId)) {
      existingAcl.setReadAccess(staffId, true);
      updated = true;
    }

    if (updated) {
      tracking.setACL(existingAcl);
    }
    return;
  }

  const acl = new Parse.ACL(owner);
  acl.setPublicReadAccess(true);
  tracking.setACL(acl);
}

// Start live tracking for a staff member
export async function startLiveTracking(staffId) {
  try {
    // Check if tracking already exists for today
    const today = new Date().toISOString().split('T')[0];
    const existingQuery = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    existingQuery.equalTo('staffId', Parse.User.createWithoutData(staffId));
    existingQuery.equalTo('date', today);
    existingQuery.equalTo('isActive', true);

    const existing = await existingQuery.first();
    if (existing) {
      ensureTrackingAcl(existing, staffId);
      // Update existing tracking
      existing.set('lastUpdate', new Date());
      await existing.save();
      return existing;
    }

    // Create new tracking record
    const LiveTracking = Parse.Object.extend(PARSE_CLASSES.LIVE_TRACKING);
    const tracking = new LiveTracking();

    tracking.set('staffId', Parse.User.createWithoutData(staffId));
    tracking.set('date', today);
    tracking.set('isActive', true);
    tracking.set('startTime', new Date());
    tracking.set('lastUpdate', new Date());
    tracking.set('locations', []);
    ensureTrackingAcl(tracking, staffId);

    const result = await tracking.save();
    return result;
  } catch (error) {
    console.error('Error starting live tracking:', error);
    throw error;
  }
}

// Stop live tracking for a staff member
export async function stopLiveTracking(staffId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    query.equalTo('staffId', Parse.User.createWithoutData(staffId));
    query.equalTo('date', today);
    query.equalTo('isActive', true);

    const tracking = await query.first();
    if (tracking) {
      tracking.set('isActive', false);
      tracking.set('endTime', new Date());
      await tracking.save();
    }
  } catch (error) {
    console.error('Error stopping live tracking:', error);
    // Don't throw error for cleanup failures
  }
}

// Update live tracking location
export async function updateLiveTrackingLocation(staffId, latitude, longitude) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    query.equalTo('staffId', Parse.User.createWithoutData(staffId));
    query.equalTo('date', today);
    query.equalTo('isActive', true);

    const tracking = await query.first();
    if (tracking) {
      const locations = tracking.get('locations') || [];
      locations.push({
        latitude,
        longitude,
        timestamp: new Date()
      });

      tracking.set('locations', locations);
      tracking.set('lastUpdate', new Date());
      tracking.set('currentLat', latitude);
      tracking.set('currentLng', longitude);

      await tracking.save();
    }
  } catch (error) {
    console.error('Error updating live tracking location:', error);
    // Don't throw error for location updates
  }
}

export async function isLiveTrackingActive(staffId = null) {
  try {
    const currentUser = await apiClient.getUser();
    const targetId = staffId || (currentUser ? (currentUser.user_id || currentUser.id) : null);

    if (!targetId) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    query.equalTo('staffId', Parse.User.createWithoutData(targetId));
    query.equalTo('date', today);
    query.equalTo('isActive', true);

    const tracking = await query.first();
    return !!tracking;
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

    const staffId = currentUser.id;

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
    const queryDate = date || new Date().toISOString().split('T')[0];
    const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    query.equalTo('staffId', Parse.User.createWithoutData(staffId));
    query.equalTo('date', queryDate);
    query.include('staffId');

    const tracking = await query.first();
    if (!tracking) return null;

    return {
      id: tracking.id,
      staffId: tracking.get('staffId').id,
      staffName: tracking.get('staffId').get('fullName'),
      date: tracking.get('date'),
      isActive: tracking.get('isActive'),
      startTime: tracking.get('startTime'),
      endTime: tracking.get('endTime'),
      lastUpdate: tracking.get('lastUpdate'),
      currentLat: tracking.get('currentLat'),
      currentLng: tracking.get('currentLng'),
      locations: tracking.get('locations') || []
    };
  } catch (error) {
    console.error('Error getting live tracking data:', error);
    throw error;
  }
}

// Get all active live tracking for supervisor
async function getSupervisorAssignments(supervisorId) {
  const assignmentQuery = new Parse.Query(PARSE_CLASSES.STAFF_ASSIGNMENT);
  assignmentQuery.equalTo('isActive', true);
  assignmentQuery.equalTo('supervisorId', Parse.User.createWithoutData(supervisorId));

  let assignments = await assignmentQuery.find();

  if (!assignments || assignments.length === 0) {
    const stringQuery = new Parse.Query(PARSE_CLASSES.STAFF_ASSIGNMENT);
    stringQuery.equalTo('isActive', true);
    stringQuery.equalTo('supervisorId', supervisorId);
    assignments = await stringQuery.find();
  }
  const staffPointers = [];
  const staffIds = [];

  assignments.forEach((assignment) => {
    const staffPtr = assignment.get('staffId');
    if (!staffPtr) {
      return;
    }

    try {
      let staffId = null;

      if (typeof staffPtr === 'string') {
        staffId = staffPtr;
      } else if (staffPtr?.id) {
        staffId = staffPtr.id;
      } else if (staffPtr?.objectId) {
        staffId = staffPtr.objectId;
      } else if (typeof staffPtr?.get === 'function') {
        staffId = staffPtr.get('objectId') || staffPtr.get('id');
      }

      if (!staffId) {
        return;
      }

      staffPointers.push(Parse.User.createWithoutData(staffId));
      staffIds.push(String(staffId));
    } catch (error) {
      console.warn('Invalid staff assignment pointer', error);
    }
  });

  return { staffPointers, staffIds };
}

export async function getActiveLiveTrackingForSupervisor(supervisorId) {
  try {
    const { staffPointers, staffIds } = await getSupervisorAssignments(supervisorId);

    if (staffPointers.length === 0) {
      return { assignedStaffIds: [], active: [] };
    }

    const today = new Date().toISOString().split('T')[0];
    const trackingQuery = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    trackingQuery.containedIn('staffId', staffPointers.length > 0 ? staffPointers : staffIds);
    trackingQuery.equalTo('date', today);
    trackingQuery.equalTo('isActive', true);
    trackingQuery.include('staffId');

    const results = await trackingQuery.find();
    const active = results
      .map((tracking) => {
        const staff = tracking.get('staffId');
        const staffId = staff?.id || staff?.get?.('objectId');

        if (!staffId) {
          return null;
        }

        const staffName =
          (typeof staff?.get === 'function' && staff.get('fullName')) ||
          tracking.get('staffName') ||
          'Unknown Staff';

        return {
          id: tracking.id,
          staffId,
          staffName,
          currentLat: tracking.get('currentLat'),
          currentLng: tracking.get('currentLng'),
          lastUpdate: tracking.get('lastUpdate'),
          locations: tracking.get('locations') || [],
        };
      })
      .filter(Boolean);

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

  const latitude = typeof location.latitude === 'number' ? location.latitude : Number(location.latitude);
  const longitude = typeof location.longitude === 'number' ? location.longitude : Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const rawTimestamp = location.timestamp ?? location.lastUpdate;
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
      location.statusRole ||
      (typeof location.get === 'function' ? location.get('role') : null);

    return typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
  };

  const resolveSupervisorId = () => {
    const supervisor =
      location.supervisorId ||
      location.supervisor_id ||
      location.assignmentSupervisorId ||
      location.supervisorID ||
      (typeof location.get === 'function' ? location.get('supervisorId') : null);

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
    location.userId ||
    location.id ||
    (typeof location.get === 'function' ? location.get('userId') : null);

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
            : typeof point.latitude === 'string'
            ? Number(point.latitude)
            : null;
        const lng =
          typeof point.longitude === 'number'
            ? point.longitude
            : typeof point.longitude === 'string'
            ? Number(point.longitude)
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
    name: location.name || location.staffName || 'Unknown Staff',
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
  const currentUser = Parse.User.current();
  if (!currentUser) {
    return [];
  }

  const rawRole =
    currentUser.get('role') ||
    currentUser.get('userRole') ||
    currentUser.get('roleName') ||
    null;

  const role = normalizeRole(rawRole);
  const currentUserId = currentUser.id;

  const hasOrgWideVisibility = hasManagementPrivileges(role) || hasFullControl(role);
  const isSupervisorRole = role === ROLE.SUPERVISOR;

  if (hasOrgWideVisibility) {
    return locations.filter((location) => {
      if (!location) {
        return false;
      }

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

      const rawId = location?.user_id;
      if (!rawId) {
        return true;
      }

      const normalizedId =
        typeof rawId === 'string'
          ? rawId
          : typeof rawId === 'number'
          ? String(rawId)
          : rawId?.id || rawId?.objectId || null;

      if (!normalizedId) {
        return true;
      }

      return normalizedId !== currentUserId;
    });
  }

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
      const today = new Date().toISOString().split('T')[0];
      const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
      query.equalTo('staffId', Parse.User.createWithoutData(currentUserId));
      query.equalTo('date', today);
      query.equalTo('isActive', true);
      query.include('staffId');
      query.limit(1);

      const tracking = await query.first();
      if (tracking) {
        const latitude = tracking.get('currentLat');
        const longitude = tracking.get('currentLng');
        const timestamp = tracking.get('lastUpdate');

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const staff = tracking.get('staffId');
          const name =
            (staff && typeof staff.get === 'function' && staff.get('fullName')) ||
            currentUser.get('fullName') ||
            currentUser.get('name') ||
            currentUser.get('username') ||
            'Me';

          return [
            {
              user_id: normalizedCurrentId,
              name,
              latitude,
              longitude,
              timestamp,
              status: tracking.get('isActive') ? 'active' : 'inactive',
              speed: tracking.get('currentSpeed'),
            },
          ];
        }
      }
    } catch (error) {
      console.error('Error fetching supervisor self tracking:', error);
    }

    return [];
  }

  return locations.filter((location) => location.user_id === currentUserId);
};

export async function fetchLiveLocations() {
  const mapResults = (results) =>
    (Array.isArray(results) ? results : [])
      .map(normalizeLiveLocation)
      .filter((location) => location);

  try {
    // Use REST API endpoint for live locations
    const response = await apiClient.get('/live-tracking/active');
    const cloudResults = response.data || [];
    return await filterLocationsByRole(mapResults(cloudResults), mapResults);
  } catch (cloudError) {
    console.error('Error fetching live locations via cloud function:', cloudError);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const query = new Parse.Query(PARSE_CLASSES.LIVE_TRACKING);
    query.equalTo('date', today);
    query.equalTo('isActive', true);
    query.include('staffId');

    const results = await query.find();
    const normalized = results.map((tracking) => {
      const staff = tracking.get('staffId');
      const staffId =
        staff?.id ||
        tracking.get('staffId')?.id ||
        tracking.get('staffId')?.objectId ||
        tracking.get('staffId');

      return {
        user_id: staffId,
        name:
          (staff && typeof staff.get === 'function' && staff.get('fullName')) ||
          tracking.get('staffName') ||
          'Unknown Staff',
        latitude: tracking.get('currentLat'),
        longitude: tracking.get('currentLng'),
        timestamp: tracking.get('lastUpdate'),
        status: tracking.get('status') || (tracking.get('isActive') ? 'active' : 'inactive'),
        speed: tracking.get('currentSpeed'),
        locations: tracking.get('locations') || [],
      };
    });

    return await filterLocationsByRole(mapResults(normalized), mapResults);
  } catch (fallbackError) {
    console.error('Error fetching live locations via direct query:', fallbackError);
    return [];
  }
}
