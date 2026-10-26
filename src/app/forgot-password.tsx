import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { AuthScreen, rise } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { CodeField } from '@/components/code-field';
import { PasswordRules, passwordMeetsRules } from '@/components/password-rules';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60 * 1000;
// Long enough for the lime ripple to read as a result rather than a flicker.
const ACCEPTED_HOLD_MS = 900;

type Stage = 'email' | 'code' | 'password' | 'done';

// Resetting a forgotten password, start to finish, without leaving the app.
//
// It used to email a link to the website's reset page, which meant leaving the app mid-task and
// coming back to log in by hand. The email now carries a 6-digit code as well, and these four
// stages spend it here: address → code → new password → done. Same six boxes as the sign-up
// code screen, because it is the same gesture.
//
// Why the code is checked on its own step rather than sent together with the new password: a
// wrong code should be answered while the boxes are still on screen, not after someone has
// chosen and typed a new password.
export default function ForgotPasswordScreen() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  // Handed over by the code step and spent on the reset. Never shown.
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const errors = useFormErrors(['email', 'password'] as const, {
    messages: { email: INVALID_EMAIL_MESSAGE }
  });

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

  // Always answers the same way, whether or not the address has an account: the screen that
  // follows says "if an account exists", and anything else here would give that away.
  const requestCode = async () => {
    errors.clearErrors();
    if (!isValidEmail(email)) {
      errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const { error, response } = await api.POST('/auth/password/forgot', { body: { email: email.trim() } });
      if (!response.ok) throw toApiError(error);
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownEndsAt(sentAt + RESEND_COOLDOWN_MS);
      setStage('code');
    } catch (err) {
      errors.showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setCodeError(null);
    try {
      const { error, response } = await api.POST('/auth/password/forgot', { body: { email: email.trim() } });
      if (!response.ok) throw toApiError(error);
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownEndsAt(sentAt + RESEND_COOLDOWN_MS);
      setCode('');
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const submitCode = async (value: string) => {
    if (submitting || value.length !== CODE_LENGTH) return;
    setSubmitting(true);
    setCodeError(null);
    try {
      const { data, error, response } = await api.POST('/auth/password/code', {
        body: { email: email.trim(), code: value }
      });
      if (!response.ok || !data) throw toApiError(error);
      setAccepted(true);
      setTimeout(() => {
        setResetToken(data.data.token);
        setStage('password');
        // Cleared here rather than in a `finally`: the ripple plays while this is still true, so
        // that the Continue button cannot be pressed twice. Forgetting it left the next screen's
        // Save password button spinning and disabled, with no way forward.
        setSubmitting(false);
      }, ACCEPTED_HOLD_MS);
    } catch (err) {
      setCodeError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const savePassword = async () => {
    if (!resetToken) return;
    errors.clearErrors();
    setSubmitting(true);
    try {
      const { error, response } = await api.POST('/auth/password/reset', {
        body: { token: resetToken, password }
      });
      if (!response.ok) throw toApiError(error);
      setStage('done');
    } catch (err) {
      errors.showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'done') {
    return (
      <AuthScreen
        title="Password changed"
        subtitle="You're signed out everywhere else, in case somebody else asked for this. Log in with your new password.">
        <Animated.View entering={rise(3)}>
          <Button title="Log in" onPress={() => router.replace('/sign-in')} />
        </Animated.View>
      </AuthScreen>
    );
  }

  if (stage === 'password') {
    return (
      <AuthScreen title="Pick a new password" subtitle="Something you haven't used here before.">
        <Animated.View entering={rise(3)} style={styles.form}>
          <TextField
            label="New password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              errors.clearFieldError('password');
            }}
            error={errors.fieldErrors.password}
            onFocus={() => setShowRules(true)}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={savePassword}
            autoFocus
          />
          {showRules ? <PasswordRules password={password} /> : null}
        </Animated.View>

        <View style={styles.grow} />

        <Animated.View entering={rise(4)} style={styles.form}>
          <Button
            title="Save password"
            onPress={savePassword}
            loading={submitting}
            disabled={!passwordMeetsRules(password)}
          />
          {errors.formError ? <FieldError message={errors.formError} /> : null}
        </Animated.View>
      </AuthScreen>
    );
  }

  if (stage === 'code') {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`If an account exists for ${email.trim()}, we've sent a 6-digit code. It expires in 1 hour.`}>
        <Animated.View entering={rise(3)} style={styles.code}>
          <CodeField
            value={code}
            onChange={(next) => {
              setCode(next);
              setCodeError(null);
            }}
            onComplete={submitCode}
            error={Boolean(codeError)}
            accepted={accepted}
            autoFocus
          />
        </Animated.View>
        {codeError ? <FieldError message={codeError} /> : null}
        <Button
          title="Continue"
          onPress={() => submitCode(code)}
          loading={submitting}
          disabled={code.length !== CODE_LENGTH}
        />

        <View style={styles.links}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: resending || secondsLeft > 0 }}
            disabled={resending || secondsLeft > 0}
            hitSlop={8}
            onPress={resend}>
            <ThemedText type={secondsLeft > 0 ? 'smallBold' : 'linkPrimary'} themeColor="textSecondary">
              {resending ? 'Sending…' : secondsLeft > 0 ? `Send a new code in ${secondsLeft}s` : 'Send a new code'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setStage('email');
              setCode('');
              setCodeError(null);
            }}>
            <ThemedText type="linkPrimary">Use a different email</ThemedText>
          </Pressable>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a 6-digit code to reset it.">
      <Animated.View entering={rise(3)}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            errors.clearFieldError('email');
          }}
          error={errors.fieldErrors.email}
          autoFocus
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={requestCode}
        />
      </Animated.View>

      <Animated.View entering={rise(4)} style={styles.form}>
        <Button title="Send code" onPress={requestCode} loading={submitting} disabled={!email.trim()} />
        {errors.formError ? <FieldError message={errors.formError} /> : null}
      </Animated.View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12
  },
  grow: {
    flex: 1,
    minHeight: 24
  },
  // 20 of the screen's row gap, plus 10, is the design's 30px above the boxes.
  code: {
    marginTop: 10
  },
  links: {
    alignItems: 'center',
    gap: 14
  }
});
