import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const NOTIFICATION_TOPIC = 'og_elite';
const CHANNEL_ID = 'og_elite_updates';

export type NotificationDiagnostic = {
  supported: boolean;
  permission: string;
  token: string;
  topicSubscribed: boolean;
  channelCreated: boolean;
  error: string;
};

let lastDiagnostic: NotificationDiagnostic = {
  supported: false,
  permission: 'unknown',
  token: '',
  topicSubscribed: false,
  channelCreated: false,
  error: '',
};

export function getNotificationDiagnostic() {
  return lastDiagnostic;
}

export async function initializeNativeNotifications() {
  if (!Capacitor.isNativePlatform()) return lastDiagnostic;

  try {
    const supportedResult = await FirebaseMessaging.isSupported();
    lastDiagnostic = {
      ...lastDiagnostic,
      supported: supportedResult.isSupported,
      error: '',
    };

    const permission = await FirebaseMessaging.checkPermissions();
    let receive = permission.receive;

    if (receive !== 'granted') {
      const requested = await FirebaseMessaging.requestPermissions();
      receive = requested.receive;
    }

    lastDiagnostic = { ...lastDiagnostic, permission: receive };

    if (receive !== 'granted') {
      lastDiagnostic = {
        ...lastDiagnostic,
        error: 'Notification permission was not granted.',
      };
      console.warn('[FCM diagnostic]', lastDiagnostic);
      return lastDiagnostic;
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

    lastDiagnostic = { ...lastDiagnostic, channelCreated: true };

    const tokenResult = await FirebaseMessaging.getToken();
    const token = tokenResult.token || '';

    lastDiagnostic = { ...lastDiagnostic, token };

    console.info('[FCM diagnostic] registration token:', token || '(empty)');
    console.info('[FCM diagnostic] permission:', receive);
    console.info('[FCM diagnostic] supported:', supportedResult.isSupported);

    await FirebaseMessaging.subscribeToTopic({ topic: NOTIFICATION_TOPIC });

    lastDiagnostic = {
      ...lastDiagnostic,
      topicSubscribed: true,
      error: '',
    };

    console.info('[FCM diagnostic] subscribed to topic:', NOTIFICATION_TOPIC);
    console.info('[FCM diagnostic] ready:', lastDiagnostic);

    await FirebaseMessaging.addListener('tokenReceived', event => {
      lastDiagnostic = { ...lastDiagnostic, token: event.token, error: '' };
      console.info('[FCM diagnostic] token refreshed:', event.token);
    });

    await FirebaseMessaging.addListener('notificationReceived', event => {
      console.info('[FCM diagnostic] notification received:', event.notification);
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', event => {
      console.info('[FCM diagnostic] notification tapped:', event.notification);
      const data = event.notification?.data as Record<string, unknown> | undefined;
      const url = data?.url;
      if (typeof url === 'string' && url.length > 0) {
        const target = url.startsWith('http')
          ? url
          : (import.meta.env.VITE_API_URL || 'https://team-elite-stats.vercel.app').replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        window.location.href = target;
      }
    });

    return lastDiagnostic;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastDiagnostic = { ...lastDiagnostic, error: message };
    console.error('[FCM diagnostic] initialization failed:', message, error);
    return lastDiagnostic;
  }
}
