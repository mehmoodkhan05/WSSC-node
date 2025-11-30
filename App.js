import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    async function configureAndroidChannel() {
      if (Platform.OS !== 'android') return;

      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (error) {
        console.warn('Failed to configure Android notification channel', error);
      }
    }

    configureAndroidChannel();
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
      <Toast />
    </>
  );
}
