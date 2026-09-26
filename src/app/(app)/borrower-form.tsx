import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { DetailsSkeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedView } from '@/components/themed-view';
import { useFormErrors } from '@/hooks/use-form-errors';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

const FIELDS = ['name', 'email', 'phone'] as const;
type Field = (typeof FIELDS)[number];

const EXISTS_MESSAGE = 'You already have a borrower with this email';
const EMPTY_FORM: Record<Field, string> = { name: '', email: '', phone: '' };

// Adds a borrower, or edits one when opened with ?id=.
export default function BorrowerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const snackbar = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loaded, setLoaded] = useState(!editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by "Try again" to load the borrower once more.
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: {
      BORROWER_EXISTS: { field: 'email', message: EXISTS_MESSAGE },
      DUPLICATE: { field: 'email', message: EXISTS_MESSAGE }
    },
    messages: { email: INVALID_EMAIL_MESSAGE }
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .GET('/borrowers/{id}', { params: { path: { id } } })
      .then(({ data, error }) => {
        if (!data) throw toApiError(error);
        if (cancelled) return;
        setForm({ name: data.data.name, email: data.data.email, phone: data.data.phone ?? '' });
        setLoaded(true);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const change = (field: Field) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    errors.clearFieldError(field);
  };

  const checkEmail = () => {
    if (form.email.trim() && !isValidEmail(form.email)) errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
  };

  const save = async () => {
    errors.clearErrors();
    if (!isValidEmail(form.email)) {
      errors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSaving(true);
    const body = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null };
    try {
      if (id) {
        const { data, error } = await api.PATCH('/borrowers/{id}', { params: { path: { id } }, body });
        if (!data) throw toApiError(error);
        router.back();
        snackbar.show('Borrower updated');
      } else {
        const { data, error } = await api.POST('/borrowers', { body });
        if (!data) throw toApiError(error);
        router.back();
        snackbar.show(`Added ${data.data.name}`);
      }
    } catch (err) {
      errors.showError(err);
      setSaving(false);
    }
  };

  const screenOptions = <Stack.Screen options={{ title: editing ? 'Edit borrower' : 'Add borrower' }} />;

  if (!loaded) {
    return (
      <ThemedView style={styles.centered}>
        {screenOptions}
        {loadError ? (
          <View style={styles.message}>
            <FieldError message={loadError} />
            <Button title="Try again" variant="secondary" onPress={() => setAttempt((count) => count + 1)} />
          </View>
        ) : (
          <DetailsSkeleton />
        )}
      </ThemedView>
    );
  }

  return (
    <FormScreen
      title={editing ? 'Edit borrower' : 'Add a borrower'}
      subtitle="They'll get an email when you lend them a book, and any reminders you send."
      edges={['bottom', 'left', 'right']}>
      {screenOptions}
      <TextField
        label="Name"
        value={form.name}
        onChangeText={change('name')}
        error={errors.fieldErrors.name}
        autoFocus={!editing}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
      />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={change('email')}
        onBlur={checkEmail}
        error={errors.fieldErrors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
      />
      <TextField
        label="Phone (optional)"
        value={form.phone}
        onChangeText={change('phone')}
        error={errors.fieldErrors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Button
        title={editing ? 'Save changes' : 'Save borrower'}
        onPress={save}
        loading={saving}
        disabled={!form.name.trim() || !form.email.trim()}
      />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  message: {
    gap: 16
  }
});
