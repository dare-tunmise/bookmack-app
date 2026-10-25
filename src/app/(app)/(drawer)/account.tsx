import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { registerForPush } from '@/notifications/push';
import { PLAN_LABELS, PlanBadge } from '@/components/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettingsRow, SettingsSection, SettingsSwitchRow } from '@/components/settings-list';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DICEBEAR_LICENSES_URL, PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { MaxContentWidth, Radius } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

type NotificationKey = keyof Schemas['Profile']['notificationSettings'];

const NOTIFICATIONS: { key: NotificationKey; label: string }[] = [
  { key: 'emailReminders', label: 'Email reminders' },
  { key: 'dueDateAlerts', label: 'Due date alerts' },
  { key: 'weeklyDigest', label: 'Weekly digest' },
  { key: 'newFeatures', label: 'New features' }
];

type PushKey = keyof Schemas['Profile']['push'];

// What arrives on the phone, as opposed to in an inbox. Each one says what actually happened, so
// each is described by the event rather than by a feature name.
const PUSH: { key: PushKey; label: string; detail: string }[] = [
  { key: 'requests', label: 'Borrow requests', detail: 'When someone asks for one of your books' },
  { key: 'shelfViews', label: 'Shelf visits', detail: 'When someone opens a shelf you shared' },
  { key: 'overdue', label: 'Overdue books', detail: 'The morning after a loan falls due' },
  { key: 'readingNudge', label: 'Evening reading reminder', detail: 'If a book has sat untouched for a few days' }
];

export default function AccountScreen() {
  const { user, updateUser, signOut } = useSession();
  const snackbar = useSnackbar();
  const [confirmMarkRead, setConfirmMarkRead] = useState(false);
  const [pushState, setPushState] = useState<'checking' | 'on' | 'off'>('checking');
  const [pushReason, setPushReason] = useState('Not set up');

  const applyPushResult = (result: Awaited<ReturnType<typeof registerForPush>>) => {
    setPushState(result.ok ? 'on' : 'off');
    if (!result.ok) {
      setPushReason(
        result.reason === 'denied'
          ? 'Notifications are turned off in Android settings'
          : result.reason === 'simulator'
            ? 'Not a physical device'
            : result.reason === 'no-project-id'
              ? 'This build has no project id'
              : (result.detail ?? 'Could not register')
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    registerForPush().then((result) => {
      if (!cancelled) applyPushResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retryPush = async () => {
    setPushState('checking');
    applyPushResult(await registerForPush());
  };

  if (!user) return null;

  // For collections built before reading was tracked: a book you rated is one you read.
  const markRatedBooksAsRead = async () => {
    setConfirmMarkRead(false);
    try {
      const { data, error } = await api.POST('/books/mark-rated-read');
      if (!data) throw toApiError(error);
      const { updated } = data.data;
      snackbar.show(
        updated === 0
          ? 'No rated books left to mark'
          : `Marked ${updated} ${updated === 1 ? 'book' : 'books'} as read`
      );
    } catch (err) {
      snackbar.show(errorMessage(err));
    }
  };

  // Switches update immediately and roll back if saving fails.
  const setNotification = async (key: NotificationKey, enabled: boolean) => {
    const previous = user;
    updateUser({ ...user, notificationSettings: { ...user.notificationSettings, [key]: enabled } });
    try {
      const { data, error } = await api.PATCH('/me', { body: { notificationSettings: { [key]: enabled } } });
      if (!data) throw toApiError(error);
      updateUser(data.data);
    } catch (err) {
      updateUser(previous);
      snackbar.show(errorMessage(err));
    }
  };

  const setPush = async (key: PushKey, enabled: boolean) => {
    const previous = user;
    updateUser({ ...user, push: { ...user.push, [key]: enabled } });
    try {
      const { data, error } = await api.PATCH('/me', { body: { push: { [key]: enabled } } });
      if (!data) throw toApiError(error);
      updateUser(data.data);
    } catch (err) {
      updateUser(previous);
      snackbar.show(errorMessage(err));
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Image
            source={dicebearUrl('notionists', user.name, '9fe870')}
            style={styles.avatar}
            accessibilityLabel={user.name}
          />
          <ThemedText type="h2" style={styles.center}>
            {user.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {user.email}
          </ThemedText>
          <PlanBadge plan={user.plan} style={styles.planBadge} />
        </View>

        <SettingsSection title="Profile">
          <SettingsRow icon="user" label="Name" value={user.name} onPress={() => router.push('/edit-name')} />
          <SettingsRow
            icon="mail"
            label="Email"
            value={user.pendingEmail ? `${user.email} · Pending: ${user.pendingEmail}` : user.email}
            onPress={() => router.push('/change-email')}
          />
        </SettingsSection>

        <SettingsSection title="Security">
          <SettingsRow icon="lock" label="Change password" onPress={() => router.push('/change-password')} />
          <SettingsRow icon="smartphone" label="Signed-in devices" onPress={() => router.push('/devices')} />
        </SettingsSection>

        <SettingsSection title="Notifications">
          {NOTIFICATIONS.map((notification) => (
            <SettingsSwitchRow
              key={notification.key}
              icon="bell"
              label={notification.label}
              value={user.notificationSettings[notification.key]}
              onValueChange={(enabled) => setNotification(notification.key, enabled)}
            />
          ))}
        </SettingsSection>

        <SettingsSection title="On your phone">
          {/* Whether this device is actually reachable. Without it a dead registration looks
              exactly like "nobody has done anything yet", which is how notifications shipped
              broken and stayed that way. */}
          <SettingsRow
            icon="bell"
            label={pushState === 'on' ? 'This device is registered' : 'This device is not registered'}
            value={
              pushState === 'on'
                ? 'Notifications can reach you here'
                : pushState === 'checking'
                  ? 'Checking…'
                  : `${pushReason} — tap to try again`
            }
            onPress={retryPush}
          />
          {PUSH.map((item) => (
            <SettingsSwitchRow
              key={item.key}
              icon="bell"
              label={item.label}
              description={item.detail}
              value={user.push[item.key]}
              onValueChange={(enabled) => setPush(item.key, enabled)}
            />
          ))}
        </SettingsSection>

        <SettingsSection title="Reading">
          <SettingsRow
            icon="check"
            label="Mark rated books as read"
            value="For books added before reading was tracked"
            onPress={() => setConfirmMarkRead(true)}
          />
        </SettingsSection>

        <SettingsSection title="Plan">
          <SettingsRow
            icon="card"
            label="Plan & limits"
            value={PLAN_LABELS[user.plan]}
            onPress={() => router.push('/plan')}
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow icon="info" label="Version" value={Constants.expoConfig?.version ?? null} />
          <SettingsRow icon="fileText" label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL)} />
          <SettingsRow icon="fileText" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <SettingsRow
            icon="image"
            label="Image credits"
            value="Illustrations by DiceBear"
            onPress={() => Linking.openURL(DICEBEAR_LICENSES_URL)}
          />
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <SettingsRow
            icon="trash"
            label="Delete account"
            tone="danger"
            onPress={() => router.push('/delete-account')}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow icon="logOut" label="Sign out" tone="danger" onPress={signOut} accessory={null} />
        </SettingsSection>
      </ScrollView>

      <ConfirmDialog
        visible={confirmMarkRead}
        title="Mark rated books as read?"
        message="Every book you've rated will be marked as read. No date is set, since we don't know when you read them, and you can change any book afterwards."
        confirmLabel="Mark as read"
        onConfirm={markRatedBooksAsRead}
        onCancel={() => setConfirmMarkRead(false)}
      />
    </ThemedView>
  );
}

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  profile: {
    alignItems: 'center',
    gap: 4
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.pill,
    marginBottom: 8
  },
  center: {
    textAlign: 'center'
  },
  planBadge: {
    alignSelf: 'center',
    marginTop: 6
  }
});
