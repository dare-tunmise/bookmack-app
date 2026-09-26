import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { FieldError, TextField } from '@/components/text-field';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['email'] as const;

// Emails a password reset link. The link opens the reset page on the website; afterwards the
// person logs in here with the new password.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errors = useFormErrors(FIELDS, { messages: { email: INVALID_EMAIL_MESSAGE } });

  const submit = async () => {
    errors.clearErrors();
    if (!isValidEmail(email)) {
      errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const { error: apiError, response } = await api.POST('/auth/password/forgot', {
        body: { email: email.trim() }
      });
      if (!response.ok) throw toApiError(apiError);
      setSentTo(email.trim());
    } catch (err) {
      errors.showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`If an account exists for ${sentTo}, we've sent a link to reset your password. It expires in 1 hour.`}
        illustration={{ seed: 'bookmack-forgot', backgroundColor: '9fe870' }}>
        <Button title="Back to log in" onPress={() => router.back()} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a link to reset your password."
      illustration={{ seed: 'bookmack-forgot', backgroundColor: 'eef7e8' }}>
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
        onSubmitEditing={submit}
      />
      <Button title="Send reset link" onPress={submit} loading={submitting} disabled={!email.trim()} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </AuthScreen>
  );
}
