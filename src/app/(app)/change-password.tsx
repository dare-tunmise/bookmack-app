import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { PasswordRules, passwordMeetsRules } from '@/components/password-rules';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useFormErrors } from '@/hooks/use-form-errors';

const FIELDS = ['currentPassword', 'newPassword'] as const;

export default function ChangePasswordScreen() {
  const snackbar = useSnackbar();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: { INVALID_PASSWORD: { field: 'currentPassword', message: 'Current password is incorrect' } }
  });

  const canSave = Boolean(currentPassword) && passwordMeetsRules(newPassword);

  const save = async () => {
    if (!canSave) return;
    errors.clearErrors();
    setSaving(true);
    try {
      const { error, response } = await api.PUT('/me/password', { body: { currentPassword, newPassword } });
      if (!response.ok) throw toApiError(error);
      router.back();
      snackbar.show('Password changed');
    } catch (err) {
      errors.showError(err);
      setSaving(false);
    }
  };

  return (
    <FormScreen
      title="Change password"
      subtitle="You'll stay logged in here. Your other devices will be signed out."
      edges={['bottom', 'left', 'right']}>
      <TextField
        label="Current password"
        value={currentPassword}
        onChangeText={(text) => {
          setCurrentPassword(text);
          errors.clearFieldError('currentPassword');
        }}
        error={errors.fieldErrors.currentPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />
      <TextField
        label="New password"
        value={newPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          errors.clearFieldError('newPassword');
        }}
        error={errors.fieldErrors.newPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <PasswordRules password={newPassword} />
      <Button title="Save password" onPress={save} loading={saving} disabled={!canSave} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
      <ThemedText type="small" themeColor="textSecondary">
        Forgot your current password? Log out and use &quot;Forgot password?&quot; on the log in screen.
      </ThemedText>
    </FormScreen>
  );
}
