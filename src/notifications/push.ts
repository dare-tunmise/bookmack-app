import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api/client';

// Registering this device for notifications, and tearing that down on the way out.
//
// Permission is asked for at sign-in rather than at launch, because by then the person has an
// account and the things we would notify them about — somebody opening their shelf, somebody
// asking for a book — are real rather than hypothetical. A prompt before any of that exists is a
// prompt people deny, and Android only asks once.

// Shown while the app is open. A notification that arrives while you are looking at the app is
// still worth seeing — you may be on a different screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

// Android needs a channel before anything will show. Created once, at startup, because a
// notification arriving before the channel exists is silently dropped.
export const prepareChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'BookMack',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: '#9FE870'
  }).catch(() => {});
};

// Set by EAS at build time. Without it getExpoPushTokenAsync cannot say which project the token
// belongs to, and throws rather than handing back one that would never be delivered to.
const projectId = () => Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

/**
 * Ask for permission if it has not been asked, then tell the server where to reach this device.
 *
 * Returns false when there is nothing to register — a simulator, a refusal, a missing project id
 * — and never throws: notifications failing to set up must not stop anybody using the app.
 */
export const registerForPush = async (): Promise<boolean> => {
  try {
    // An emulator has no push service to register with, and asking produces a confusing error
    // rather than a token.
    if (!Device.isDevice) return false;

    await prepareChannel();

    const existing = await Notifications.getPermissionsAsync();
    const status =
      existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
    if (status.status !== 'granted') return false;

    const id = projectId();
    if (!id) return false;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!token) return false;

    await api.PUT('/me/push-token', {
      body: {
        token,
        // The device's own zone, so the evening reminder arrives in the evening wherever the
        // reader is rather than wherever the server is.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Stop notifications reaching this device.
 *
 * Called before the session is revoked, while the request can still authenticate. Failing is
 * tolerable — revoking the session clears the token server-side anyway — but doing it here means
 * the phone goes quiet the moment someone signs out rather than when their session expires.
 */
export const unregisterPush = async () => {
  try {
    await api.PUT('/me/push-token', { body: { token: null } });
  } catch {
    // Signing out must not fail because a cleanup call did.
  }
};
