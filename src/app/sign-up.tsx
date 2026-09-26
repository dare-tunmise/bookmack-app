import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { useSession } from '@/auth/session';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { PasswordRules, passwordMeetsRules } from '@/components/password-rules';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['name', 'email', 'password'] as const;

export default function SignUpScreen() {
  const { signUp } = useSession();
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
      subtitle="Keep track of your books and who has them."
      illustration={{ seed: 'bookmack-signup', backgroundColor: '9fe870' }}>
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
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <PasswordRules password={password} />
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
      <Link href="/sign-in" replace style={styles.center}>
        <ThemedText themeColor="textSecondary">Already have an account? </ThemedText>
        <ThemedText type="linkPrimary">Log in</ThemedText>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center'
  }
});
