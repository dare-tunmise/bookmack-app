import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { useFormErrors } from '@/hooks/use-form-errors';
import { bookExistsField } from '@/lib/new-book';

const FIELDS = ['title', 'author', 'isbn'] as const;

// Manual entry, for books the catalogs don't know. Opened with ?isbn= after a failed lookup, or
// with whatever a cover scan could read (?title=&author=&isbn=).
export default function BookFormScreen() {
  const params = useLocalSearchParams<{ isbn?: string; title?: string; author?: string }>();
  const [title, setTitle] = useState(params.title ?? '');
  const [author, setAuthor] = useState(params.author ?? '');
  const [isbn, setIsbn] = useState(params.isbn ?? '');
  const [submitting, setSubmitting] = useState(false);
  const errors = useFormErrors(FIELDS, { byCode: { BOOK_EXISTS: bookExistsField } });
  const snackbar = useSnackbar();

  const submit = async () => {
    errors.clearErrors();
    setSubmitting(true);
    try {
      const { data, error: apiError } = await api.POST('/books', {
        body: { title: title.trim(), author: author.trim(), isbn: isbn.trim() || null }
      });
      if (!data) throw toApiError(apiError);
      router.dismissTo('/');
      const bookId = data.data.id;
      snackbar.show('Added to your library', {
        label: 'Lend it',
        onPress: () => router.push({ pathname: '/lend', params: { bookId } })
      });
    } catch (err) {
      errors.showError(err);
      setSubmitting(false);
    }
  };

  return (
    <FormScreen title="Add a book" subtitle="Enter the details from the cover." edges={['bottom', 'left', 'right']}>
      <TextField
        label="Title"
        value={title}
        onChangeText={(text) => {
          setTitle(text);
          errors.clearFieldError('title');
        }}
        error={errors.fieldErrors.title}
        autoFocus
        returnKeyType="next"
      />
      <TextField
        label="Author"
        value={author}
        onChangeText={(text) => {
          setAuthor(text);
          errors.clearFieldError('author');
        }}
        error={errors.fieldErrors.author}
        autoComplete="name"
        returnKeyType="next"
      />
      <TextField
        label="ISBN (optional)"
        value={isbn}
        onChangeText={(text) => {
          setIsbn(text);
          errors.clearFieldError('isbn');
        }}
        error={errors.fieldErrors.isbn}
        autoCapitalize="characters"
        hint="The 10 or 13 digit number above the barcode."
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Button
        title="Add to library"
        onPress={submit}
        loading={submitting}
        disabled={!title.trim() || !author.trim()}
      />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}
