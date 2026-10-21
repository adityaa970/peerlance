import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from './api';
import { router } from 'expo-router';

// Lazy-load expo-notifications to avoid crashing in Expo Go
let Notifications: typeof import('expo-notifications') | null = null;

function getNotificationsModule() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch {
      console.log('expo-notifications not available in this environment');
      return null;
    }
  }
  return Notifications;
}

// Check if we're running in Expo Go (where push notifications don't work)
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Initialize notification handler (safe for Expo Go — just skips if unavailable)
 */
export function initNotificationHandler() {
  if (isExpoGo()) return;
  const N = getNotificationsModule();
  if (!N) return;

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Register for push notifications and send the token to the backend.
 * Must be called after the user is authenticated.
 * Gracefully skips in Expo Go.
 */
export async function registerForPushNotifications(getToken: () => Promise<string | null>) {
  try {
    // Skip entirely in Expo Go
    if (isExpoGo()) {
      console.log('Push notifications are not supported in Expo Go. Use a development build.');
      return null;
    }

    const N = getNotificationsModule();
    if (!N) return null;

    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the Expo push token
    const tokenData = await N.getExpoPushTokenAsync({
      projectId: '6d1de4f2-c3de-4584-a183-55ba3f2335bd',
    });
    const pushToken = tokenData.data;

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C5CE7',
      });
    }

    // Send token to backend
    const authToken = await getToken();
    if (authToken) {
      await apiClient.post('/users/push-token', { pushToken }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }).catch((err) => {
        console.error('Failed to register push token with backend:', err);
      });
    }

    return pushToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Set up notification response listener for handling taps.
 * Returns a cleanup function to remove the listener.
 * Gracefully skips in Expo Go.
 */
export function setupNotificationListeners() {
  if (isExpoGo()) {
    return () => {}; // no-op cleanup
  }

  const N = getNotificationsModule();
  if (!N) {
    return () => {};
  }

  // When user taps on a notification, navigate to the task detail
  const responseSubscription = N.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.taskId) {
      router.push({
        pathname: '/task/[id]',
        params: { id: data.taskId as string },
      });
    }
  });

  return () => {
    responseSubscription.remove();
  };
}

/**
 * Schedule local reminders for a task deadline.
 * Triggers 48h and 24h before the deadline.
 */
export async function scheduleDeadlineReminders(taskId: string, title: string, deadline: string | Date) {
  const N = getNotificationsModule();
  if (!N || isExpoGo()) return;

  const deadlineDate = new Date(deadline);
  const now = new Date();

  const scheduleReminder = async (hoursBefore: number) => {
    const triggerDate = new Date(deadlineDate.getTime() - (hoursBefore * 60 * 60 * 1000));
    
    // Only schedule if the trigger time is in the future
    if (triggerDate > now) {
      try {
        await N.scheduleNotificationAsync({
          identifier: `deadline-${taskId}-${hoursBefore}h`,
          content: {
            title: 'Assignment Deadline approaching! ⏰',
            body: `"${title}" is due in ${hoursBefore} hours.`,
            data: { taskId },
          },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: triggerDate },
        });
      } catch (e) {
        console.log(`Failed to schedule ${hoursBefore}h reminder:`, e);
      }
    }
  };

  await scheduleReminder(48);
  await scheduleReminder(24);
}

/**
 * Cancel scheduled reminders for a specific task.
 */
export async function cancelDeadlineReminders(taskId: string) {
  const N = getNotificationsModule();
  if (!N || isExpoGo()) return;

  try {
    await N.cancelScheduledNotificationAsync(`deadline-${taskId}-48h`);
    await N.cancelScheduledNotificationAsync(`deadline-${taskId}-24h`);
  } catch (error) {
    console.error('Error cancelling reminders:', error);
  }
}
