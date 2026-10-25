import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import type { Schemas } from '@/api/client';
import { useSession } from '@/auth/session';
import { AuthScreen, rise } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { SHELF_HEIGHT } from '@/components/auth-shelf';
import { CodeField } from '@/components/code-field';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

import { useShelfCelebrate } from './shelf-step';
import { Colors, Fonts } from '@/constants/theme';

const CODE_LENGTH = 6;
type Profile = Schemas['Profile'];

const RESEND_COOLDOWN_MS = 60 * 1000;
// Long enough for the ripple to read as a result rather than a flicker.
const ACCEPTED_HOLD_MS = 1100;

export default function VerifyEmailScreen() {
  const { user, verifyEmail, adoptVerified, resendVerification, signOut } = useSession();
  // Held between the server agreeing and the app switching, so the moment it worked is visible.
  const [accepted, setAccepted] = useState(false);
  // The verified profile, held until the reader taps through from the done screen.
  const [done, setDone] = useState<Profile | null>(null);
  const celebrate = useShelfCelebrate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Resend code" waits a minute after each resend.
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldownEndsAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownEndsAt) setCooldownEndsAt(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownEndsAt]);

  const secondsLeft = cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000)) : 0;

  const submit = async (value: string) => {
    if (submitting || value.length !== CODE_LENGTH) return;
    setSubmitting(true);
    setError(null);
    try {
      const verified = await verifyEmail(value);
      // Ripple the boxes, then show the shelf coming home. Adopting the session swaps this whole
      // stack out, so everything worth seeing has to happen before it.
      setAccepted(true);
      setTimeout(() => {
        setDone(verified);
        celebrate(true);
      }, ACCEPTED_HOLD_MS);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setError(null);
    setCodeSent(false);
    try {
      await resendVerification();
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownEndsAt(sentAt + RESEND_COOLDOWN_MS);
      setCodeSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const resendLabel = resending ? 'Sending…' : secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code';

  if (done) {
    return (
      <SafeAreaView style={styles.flex}>
        <View style={styles.doneContent}>
          {/* Clears the shelf, which has come back to full size above this. */}
          <View style={{ height: SHELF_HEIGHT + 128 }} />
          <Animated.View entering={rise(2)}>
            <ThemedText style={styles.doneTitle}>Your shelf is ready.</ThemedText>
          </Animated.View>
          <Animated.View entering={rise(3)}>
            <ThemedText style={styles.doneSub}>
              Scan your first book and it&apos;ll stand right there.
            </ThemedText>
          </Animated.View>
          <View style={styles.grow} />
          <Animated.View entering={rise(4)}>
            <Button title="Add my first book" onPress={() => adoptVerified(done)} />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthScreen
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${user?.email ?? 'your email address'}.`}>
      <Animated.View entering={rise(3)} style={styles.code}>
        <CodeField
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          // Verify as soon as the last digit is typed or the code is pasted.
          onComplete={submit}
          error={Boolean(error)}
          accepted={accepted}
          autoFocus
        />
      </Animated.View>
      {error ? <FieldError message={error} /> : null}
      <Button
        title="Verify"
        onPress={() => submit(code)}
        loading={submitting}
        disabled={code.length !== CODE_LENGTH}
      />

      <View style={styles.links}>
        {codeSent ? (
          <ThemedText type="smallBold" style={styles.sent}>
            Code sent
          </ThemedText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: resending || secondsLeft > 0 }}
          disabled={resending || secondsLeft > 0}
          hitSlop={8}
          onPress={resend}>
          <ThemedText type={secondsLeft > 0 ? 'smallBold' : 'linkPrimary'} themeColor="textSecondary">
            {resendLabel}
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={signOut}>
          <ThemedText type="linkPrimary">Use a different account</ThemedText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  doneContent: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 30
  },
  doneTitle: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 41,
    letterSpacing: -1.1,
    color: Colors.text
  },
  doneSub: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: 14,
    maxWidth: 320
  },
  grow: {
    flex: 1
  },
  code: {
    marginTop: 30,
    marginBottom: 12
  },
  links: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8
  },
  sent: {
    color: Colors.brand
  }
});
