import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

const PUSH_ENABLED_STORAGE_KEY = '@wssc/push/enabled';
const PUSH_TOKEN_STORAGE_KEY = '@wssc/push/token';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function setStoredEnabled(value) {
  try {
    await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('[notifications] Failed to store enabled flag', error);
  }
}

async function setStoredToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[notifications] Failed to store token', error);
  }
}

export async function getStoredEnabledFlag() {
  try {
    const value = await AsyncStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
    return value === 'true';
  } catch (error) {
    console.warn('[notifications] Failed to read enabled flag', error);
    return false;
  }
}

async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('[notifications] Failed to read token', error);
    return null;
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[notifications] Must use physical device for Push Notifications');
    return { token: null, status: 'unsupported', reason: 'not-physical-device' };
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission not granted');
    return { token: null, status: finalStatus, reason: 'permission-denied' };
  }

  // Get push token
  try {
    // Get project ID from app config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('[notifications] No project ID found in app config');
      return { token: null, status: 'error', reason: 'no-project-id' };
    }
    
    console.log('[notifications] Using project ID:', projectId);
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[notifications] Push token:', token);
  } catch (error) {
    console.error('[notifications] Error getting push token:', error);
    return { token: null, status: 'error', reason: error.message };
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return { token, status: 'granted' };
}

export async function fetchPushPreference() {
  try {
    const response = await apiClient.get('/notifications/status');
    const enabled = response.data?.enabled || false;
    const hasToken = response.data?.hasToken || false;
    
    // Sync local storage
    await setStoredEnabled(enabled);
    
    return {
      enabled,
      hasToken,
      error: null,
    };
  } catch (error) {
    console.warn('[notifications] Failed to fetch preference from server:', error);
    // Fall back to local storage
    const enabled = await getStoredEnabledFlag();
    return {
      enabled,
      hasToken: false,
      error: error.message,
    };
  }
}

export async function enablePushNotifications(options = {}) {
  try {
    const { requestPermission = true } = options;

    // Check if we're on a physical device
    if (!Device.isDevice) {
      return { 
        enabled: false, 
        status: 'unsupported', 
        reason: 'not-physical-device' 
      };
    }

    // Register for push notifications
    const result = await registerForPushNotificationsAsync();
    
    if (!result.token) {
      return { 
        enabled: false, 
        status: result.status, 
        reason: result.reason 
      };
    }

    // Send token to backend
    try {
      await apiClient.post('/notifications/register-token', { token: result.token });
      console.log('[notifications] Token registered with backend');
    } catch (error) {
      console.error('[notifications] Failed to register token with backend:', error);
      return { 
        enabled: false, 
        status: 'error', 
        reason: 'backend-registration-failed' 
      };
    }

    // Store locally
    await setStoredEnabled(true);
    await setStoredToken(result.token);

    return { 
      enabled: true, 
      status: 'granted', 
      token: result.token 
    };
  } catch (error) {
    console.error('[notifications] Error enabling push notifications:', error);
    return { 
      enabled: false, 
      status: 'error', 
      reason: error.message 
    };
  }
}

export async function disablePushNotifications() {
  try {
    // Unregister from backend
    try {
      await apiClient.post('/notifications/unregister');
      console.log('[notifications] Unregistered from backend');
    } catch (error) {
      console.warn('[notifications] Failed to unregister from backend:', error);
      // Continue anyway to clear local state
    }

    // Clear local storage
    await setStoredEnabled(false);
    await setStoredToken(null);

    return { enabled: false };
  } catch (error) {
    console.error('[notifications] Error disabling push notifications:', error);
    return { enabled: false, error: error.message };
  }
}

export async function syncPushSubscription() {
  try {
    const enabled = await getStoredEnabledFlag();
    
    if (!enabled) {
      return { success: true, reason: 'notifications-disabled' };
    }

    // Re-register if enabled
    const result = await enablePushNotifications({ requestPermission: false });
    return { 
      success: result.enabled, 
      reason: result.reason || 'synced' 
    };
  } catch (error) {
    console.error('[notifications] Error syncing subscription:', error);
    return { success: false, reason: error.message };
  }
}

// Add notification listeners
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Get last notification response (for handling notifications that opened the app)
export async function getLastNotificationResponse() {
  return await Notifications.getLastNotificationResponseAsync();
}

// Schedule a local notification (for testing)
export async function scheduleLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Immediate
  });
}

// For backward compatibility
export const PUSH_BACKEND_DISABLED_REASON = 'push-backend-disabled';
