import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GOOGLE_SIGN_IN_AVAILABLE, GOOGLE_SIGN_IN_UNAVAILABLE } from '@/auth/google';
import { useSession } from '@/auth/session';
import { AuthScreen, rise } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { AuthDivider, GoogleButton } from '@/components/google-button';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['email', 'password'] as const;

export default function SignInScreen() {
  const { signIn, signInWithGoogle } = useSession();
  const snackbar = useSnackbar();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: { INVALID_CREDENTIALS: { field: 'password', message: 'Incorrect email or password' } },
    messages: { email: INVALID_EMAIL_MESSAGE }
  });

  const checkEmail = () => {
    if (email.trim() && !isValidEmail(email)) errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
  };

  const continueWithGoogle = async () => {
    if (!GOOGLE_SIGN_IN_AVAILABLE) {
      snackbar.show(GOOGLE_SIGN_IN_UNAVAILABLE);
      return;
    }

    errors.clearErrors();
    setGoogleBusy(true);
    try {
      // True means the session changed and the navigator is already moving; false means the person
      // dismissed Google's sheet, which needs no message at all. Only the busy flag has to be let
      // go, and only in the second case — in the first this screen is being unmounted.
      if (!(await signInWithGoogle())) setGoogleBusy(false);
    } catch (err) {
      errors.showError(err);
      setGoogleBusy(false);
    }
  };

  const submit = async () => {
    errors.clearErrors();
    if (!isValidEmail(email)) {
      errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      // On success the session changes and the navigator moves to the library.
      await signIn(email.trim(), password);
    } catch (err) {
      errors.showError(err);
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Pick up where you left off.">
      {/* Google first here too. Whoever signed up with it has to find it in the same place. */}
      <Animated.View entering={rise(3)}>
        <GoogleButton onPress={continueWithGoogle} loading={googleBusy} disabled={submitting} />
      </Animated.View>
      <Animated.View entering={rise(4)}>
        <AuthDivider />
      </Animated.View>

      <Animated.View entering={rise(5)} style={styles.form}>
      <TextField
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          errors.clearFieldError('email');
        }}
        onBlur={checkEmail}
        error={errors.fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          errors.clearFieldError('password');
        }}
        error={errors.fieldErrors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => router.push('/forgot-password')}
        style={styles.forgot}>
        <ThemedText type="linkPrimary">Forgot password?</ThemedText>
      </Pressable>
      </Animated.View>

      <View style={styles.grow} />

      <Animated.View entering={rise(6)} style={styles.submit}>
        <Button title="Log in" onPress={submit} loading={submitting} disabled={googleBusy || !email.trim() || !password} />
        {errors.formError ? <FieldError message={errors.formError} /> : null}
      </Animated.View>

      <Animated.View entering={rise(7)}>
        <Link href="/sign-up" replace style={styles.switch}>
          <ThemedText themeColor="textSecondary">New here? </ThemedText>
          <ThemedText type="linkPrimary">Create an account</ThemedText>
        </Link>
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
  submit: {
    gap: 12
  },
  forgot: {
    alignSelf: 'flex-end'
  },
  switch: {
    textAlign: 'center'
  }
});
