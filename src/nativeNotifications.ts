import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const NOTIFICATION_TOPIC = 'og_elite';
const CHANNEL_ID = 'og_elite_updates';

export async function initializeNativeNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') {
      const requested = await FirebaseMessaging.requestPermissions();
      if (requested.receive !== 'granted') return;
    }

    await FirebaseMessaging.createChannel({
      id: CHANNEL_ID,
      name: 'OG ELITE Updates',
      description: 'Match updates, content drops and team announcements.',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });

    await FirebaseMessaging.subscribeToTopic({ topic: NOTIFICATION_TOPIC });

    await FirebaseMessaging.addListener('notificationReceived', () => {
      // Native Android displays background push notifications automatically.
      // This listener is intentionally kept for foreground delivery.
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', event => {
      const url = event.notification?.data?.url;
      if (typeof url === 'string' && url.length > 0) {
        window.location.href = url;
      }
    });
  } catch (error) {
    console.warn('Native notifications are not configured yet.', error);
  }
}
