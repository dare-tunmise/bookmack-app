import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettingsRow, SettingsSection } from '@/components/settings-list';
import { ListRowSkeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth } from '@/constants/theme';
import { timeAgo } from '@/lib/time';

type Session = Schemas['Session'];

const PLATFORM_LABELS: Record<Session['platform'], string> = {
  android: 'Android',
  ios: 'iPhone or iPad',
  web: 'Web browser',
  other: 'Other device'
};

const deviceName = (session: Session) => session.deviceName ?? 'Unknown device';

type PendingSignOut = { kind: 'one'; session: Session } | { kind: 'others' };

export default function DevicesScreen() {
  const snackbar = useSnackbar();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped to load the list again (after signing a device out, or "Try again").
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<PendingSignOut | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/me/sessions')
      .then(({ data, error }) => {
        if (!data) throw toApiError(error);
        if (cancelled) return;
        setSessions(data.data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signOutPending = async () => {
    if (!pending) return;
    const target = pending;
    setPending(null);
    setSigningOut(true);
    setActionError(null);
    try {
      const { error, response } =
        target.kind === 'one'
          ? await api.DELETE('/me/sessions/{id}', { params: { path: { id: target.session.id } } })
          : await api.DELETE('/me/sessions');
      if (!response.ok) throw toApiError(error);
      snackbar.show(target.kind === 'one' ? `Signed out ${deviceName(target.session)}` : 'Signed out all other devices');
      setAttempt((count) => count + 1);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  };

  const others = sessions?.filter((session) => !session.current) ?? [];

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">
          Devices where you&apos;re logged in to BookMack. Sign out any you don&apos;t recognize.
        </ThemedText>

        {sessions === null ? (
          loadError ? (
            <View style={styles.message}>
              <FieldError message={loadError} />
              <Button title="Try again" variant="secondary" onPress={() => setAttempt((count) => count + 1)} />
            </View>
          ) : (
            <ListRowSkeleton rows={3} />
          )
        ) : (
          <SettingsSection>
            {sessions.map((session) => (
              <SettingsRow
                key={session.id}
                icon={session.platform === 'web' || session.platform === 'other' ? 'monitor' : 'smartphone'}
                label={deviceName(session)}
                value={`${PLATFORM_LABELS[session.platform]} · ${
                  session.current ? 'Active now' : `Last active ${timeAgo(session.lastUsedAt ?? session.createdAt)}`
                }`}
                accessory={
                  session.current ? (
                    <Badge label="This device" tone="brand" />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sign out ${deviceName(session)}`}
                      hitSlop={8}
                      disabled={signingOut}
                      onPress={() => setPending({ kind: 'one', session })}>
                      <ThemedText style={styles.signOut}>Sign out</ThemedText>
                    </Pressable>
                  )
                }
              />
            ))}
          </SettingsSection>
        )}

        {others.length > 0 ? (
          <Button
            title="Sign out all other devices"
            variant="dangerSecondary"
            onPress={() => setPending({ kind: 'others' })}
            loading={signingOut && pending === null}
            disabled={signingOut}
          />
        ) : null}
        {actionError ? <FieldError message={actionError} /> : null}
      </ScrollView>

      <ConfirmDialog
        visible={pending !== null}
        title={pending?.kind === 'others' ? 'Sign out all other devices?' : 'Sign out this device?'}
        message={
          pending?.kind === 'one'
            ? `"${deviceName(pending.session)}" will need to log in again.`
            : 'Every device except this one will need to log in again.'
        }
        confirmLabel="Sign out"
        destructive
        onConfirm={signOutPending}
        onCancel={() => setPending(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  message: {
    gap: 12
  },
  signOut: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger
  }
});
