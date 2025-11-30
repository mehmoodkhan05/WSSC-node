import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_ENABLED_STORAGE_KEY = '@wssc/push/enabled';
export const PUSH_BACKEND_DISABLED_REASON = 'push-backend-disabled';

async function setStoredEnabled(value) {
  try {
    await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('[notifications] Failed to store enabled flag', error);
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

export async function fetchPushPreference() {
  const enabled = await getStoredEnabledFlag();
  return {
    enabled,
    token: null,
    error: PUSH_BACKEND_DISABLED_REASON,
  };
}

export async function enablePushNotifications() {
  await setStoredEnabled(false);
  return { enabled: false, status: 'disabled', reason: PUSH_BACKEND_DISABLED_REASON };
}

export async function disablePushNotifications() {
  await setStoredEnabled(false);
  return { enabled: false };
}

export async function syncPushSubscription() {
  return { success: false, reason: PUSH_BACKEND_DISABLED_REASON };
}

export async function sendTestPushNotification() {
  throw new Error('Push notifications backend is currently disabled.');
}

