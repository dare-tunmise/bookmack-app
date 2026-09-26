import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { CodeInput } from '@/components/code-input';
import { FormScreen } from '@/components/form-screen';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['newEmail', 'password'] as const;
const CODE_LENGTH = 6;

// Two steps: send a code to the new address (password required), then enter that code. If a change
// is already pending, it opens on the code step.
export default function ChangeEmailScreen() {
  const { user, updateUser } = useSession();
  const snackbar = useSnackbar();
  const [step, setStep] = useState<'form' | 'code'>(user?.pendingEmail ? 'code' : 'form');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: {
      EMAIL_TAKEN: { field: 'newEmail', message: 'That email address is already in use' },
      EMAIL_UNCHANGED: { field: 'newEmail', message: 'That is already your email address' },
      INVALID_PASSWORD: { field: 'password', message: 'Password is incorrect' }
    },
    messages: { newEmail: INVALID_EMAIL_MESSAGE }
  });
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  if (!user) return null;

  const checkEmail = () => {
    if (newEmail.trim() && !isValidEmail(newEmail)) errors.setFieldError('newEmail', INVALID_EMAIL_MESSAGE);
  };

  const sendCode = async () => {
    errors.clearErrors();
    if (!isValidEmail(newEmail)) {
      errors.setFieldError('newEmail', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await api.POST('/me/email', { body: { newEmail: newEmail.trim(), password } });
      if (!data) throw toApiError(error);
      updateUser({ ...user, pendingEmail: data.data.pendingEmail });
      setPassword('');
      setCode('');
      setCodeError(null);
      setStep('code');
    } catch (err) {
      errors.showError(err);
    } finally {
      setSending(false);
    }
  };

  const confirm = async (value: string) => {
    if (confirming || value.length !== CODE_LENGTH) return;
    setConfirming(true);
    setCodeError(null);
    try {
      const { data, error } = await api.POST('/me/email/confirm', { body: { code: value } });
      if (!data) throw toApiError(error);
      updateUser(data.data);
      router.back();
      snackbar.show(`Your email is now ${data.data.email}`);
    } catch (err) {
      setCodeError(errorMessage(err));
      setConfirming(false);
    }
  };

  if (step === 'code') {
    return (
      <FormScreen
        title="Check your new email"
        subtitle={`Enter the 6-digit code we sent to ${user.pendingEmail ?? newEmail}. Your other devices will be signed out.`}
        edges={['bottom', 'left', 'right']}>
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setCodeError(null);
          }}
          onComplete={confirm}
          length={CODE_LENGTH}
          error={Boolean(codeError)}
          autoFocus
        />
        {codeError ? <FieldError message={codeError} /> : null}
        <Button
          title="Confirm"
          onPress={() => confirm(code)}
          loading={confirming}
          disabled={code.length !== CODE_LENGTH}
        />
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setStep('form')} style={styles.link}>
          <ThemedText type="linkPrimary">Use a different email</ThemedText>
        </Pressable>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Change email"
      subtitle={`Your email is ${user.email}. We'll send a code to the new address to confirm it.`}
      edges={['bottom', 'left', 'right']}>
      <TextField
        label="New email"
        value={newEmail}
        onChangeText={(text) => {
          setNewEmail(text);
          errors.clearFieldError('newEmail');
        }}
        onBlur={checkEmail}
        error={errors.fieldErrors.newEmail}
        autoFocus
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Current password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          errors.clearFieldError('password');
        }}
        error={errors.fieldErrors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="send"
        onSubmitEditing={sendCode}
      />
      <Button title="Send code" onPress={sendCode} loading={sending} disabled={!newEmail.trim() || !password} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center'
  }
});
