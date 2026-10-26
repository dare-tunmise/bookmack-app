import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GOOGLE_SIGN_IN_UNAVAILABLE } from '@/auth/google';
import { useSession } from '@/auth/session';
import { AuthScreen, rise } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { AuthDivider, GoogleButton } from '@/components/google-button';
import { PasswordRules, passwordMeetsRules } from '@/components/password-rules';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['name', 'email', 'password'] as const;

export default function SignUpScreen() {
  const { signUp } = useSession();
  const snackbar = useSnackbar();
  const [showRules, setShowRules] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: { EMAIL_TAKEN: { field: 'email', message: 'An account with this email already exists' } },
    messages: { email: INVALID_EMAIL_MESSAGE }
  });

  const canSubmit = Boolean(name.trim() && email.trim()) && passwordMeetsRules(password);

  const checkEmail = () => {
    if (email.trim() && !isValidEmail(email)) errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
  };

  const submit = async () => {
    if (!canSubmit) return;
    errors.clearErrors();
    if (!isValidEmail(email)) {
      errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      // On success the account is unverified, so the navigator moves to email verification.
      await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      errors.showError(err);
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Free for your first 50 books.">
      {/* Google above the form, on both screens. It is the fastest way in for most people and it
          skips the code step entirely — putting it under a form nobody filled in is burying it. */}
      <Animated.View entering={rise(3)}>
        <GoogleButton onPress={() => snackbar.show(GOOGLE_SIGN_IN_UNAVAILABLE)} disabled={submitting} />
      </Animated.View>
      <Animated.View entering={rise(4)}>
        <AuthDivider />
      </Animated.View>

      <Animated.View entering={rise(5)} style={styles.form}>
      <TextField
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          errors.clearFieldError('name');
        }}
        error={errors.fieldErrors.name}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
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
        onFocus={() => setShowRules(true)}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {/* The rules appear once the password is reached, not before: five greyed-out demands over
          an empty field read as a list of obstacles. */}
      {showRules ? <PasswordRules password={password} /> : null}
      </Animated.View>

      <View style={styles.grow} />

      <Animated.View entering={rise(6)} style={styles.submit}>
      <Button title="Create account" onPress={submit} loading={submitting} disabled={!canSubmit} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {'By continuing you agree to the '}
        <ThemedText type="linkPrimary" accessibilityRole="link" onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </ThemedText>
        {' and '}
        <ThemedText type="linkPrimary" accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </ThemedText>
        .
      </ThemedText>
      </Animated.View>

      <Animated.View entering={rise(7)}>
        <Link href="/sign-in" replace style={styles.center}>
          <ThemedText themeColor="textSecondary">Already have an account? </ThemedText>
          <ThemedText type="linkPrimary">Log in</ThemedText>
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
  center: {
    textAlign: 'center'
  }
});
