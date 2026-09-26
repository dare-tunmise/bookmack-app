import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { useFormErrors } from '@/hooks/use-form-errors';

const FIELDS = ['name'] as const;

export default function EditNameScreen() {
  const { user, updateUser } = useSession();
  const snackbar = useSnackbar();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const errors = useFormErrors(FIELDS);

  const unchanged = name.trim() === user?.name;

  const save = async () => {
    errors.clearErrors();
    setSaving(true);
    try {
      const { data, error } = await api.PATCH('/me', { body: { name: name.trim() } });
      if (!data) throw toApiError(error);
      updateUser(data.data);
      router.back();
      snackbar.show('Name updated');
    } catch (err) {
      errors.showError(err);
      setSaving(false);
    }
  };

  return (
    <FormScreen
      title="Your name"
      subtitle="Borrowers see this name in the emails BookMack sends them."
      edges={['bottom', 'left', 'right']}>
      <TextField
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          errors.clearFieldError('name');
        }}
        error={errors.fieldErrors.name}
        autoFocus
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (name.trim() && !unchanged) save();
        }}
      />
      <Button title="Save" onPress={save} loading={saving} disabled={!name.trim() || unchanged} />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}
