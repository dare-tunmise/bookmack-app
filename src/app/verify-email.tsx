import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { CodeInput } from '@/components/code-input';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60 * 1000;

export default function VerifyEmailScreen() {
  const { user, verifyEmail, resendVerification, signOut } = useSession();
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
      // On success the navigator moves to the library.
      await verifyEmail(value);
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

  return (
    <AuthScreen
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${user?.email ?? 'your email address'}.`}
      illustration={{ seed: 'bookmack-verify', backgroundColor: 'eef7e8' }}>
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(null);
        }}
        // Verify as soon as the last digit is typed or the code is pasted.
        onComplete={submit}
        length={CODE_LENGTH}
        error={Boolean(error)}
        autoFocus
      />
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
  links: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8
  },
  sent: {
    color: Colors.brand
  }
});
