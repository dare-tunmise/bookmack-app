import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useSession } from '@/auth/session';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['email', 'password'] as const;

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: { INVALID_CREDENTIALS: { field: 'password', message: 'Incorrect email or password' } },
    messages: { email: INVALID_EMAIL_MESSAGE }
  });

  const checkEmail = () => {
    if (email.trim() && !isValidEmail(email)) errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
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
      subtitle="Log in to your BookMack library."
      illustration={{ seed: 'bookmack-login', backgroundColor: 'eef7e8' }}>
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
      <Button title="Log in" onPress={submit} loading={submitting} disabled={!email.trim() || !password} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
      <Link href="/sign-up" replace style={styles.switch}>
        <ThemedText themeColor="textSecondary">New here? </ThemedText>
        <ThemedText type="linkPrimary">Create an account</ThemedText>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgot: {
    alignSelf: 'flex-end'
  },
  switch: {
    textAlign: 'center',
    marginTop: 8
  }
});
