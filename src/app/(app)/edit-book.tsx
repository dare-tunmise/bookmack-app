import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import type { paths } from '@/api/schema';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { DetailsSkeleton } from '@/components/skeleton';
import { SegmentedControl } from '@/components/segmented-control';
import { TagInput } from '@/components/tag-input';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFormErrors } from '@/hooks/use-form-errors';
import { bookExistsField } from '@/lib/new-book';

type Book = Schemas['Book'];
type BookUpdate = paths['/books/{id}']['patch']['requestBody']['content']['application/json'];

const FIELDS = [
  'title', 'author', 'isbn', 'category', 'publisher', 'publishedDate', 'pageCount', 'description',
  'location', 'notes'
] as const;

const STATUS_OPTIONS = [
  { key: 'Available', label: 'Available' },
  { key: 'Lost', label: 'Lost' }
] as const;

const SHARING_OPTIONS = [
  { key: 'shown', label: 'Shown' },
  { key: 'hidden', label: 'Hidden' }
] as const;

type Field = (typeof FIELDS)[number];
type Form = Record<Field, string> & { status: Book['status']; tags: string[]; hiddenWhenShared: boolean };

// Fields that can show an error: the text fields plus tags.
const ERROR_FIELDS = [...FIELDS, 'tags'] as const;

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; form: Form };

const formFromBook = (book: Book): Form => ({
  title: book.title,
  author: book.author,
  isbn: book.isbn ?? '',
  category: book.category ?? '',
  publisher: book.publisher ?? '',
  publishedDate: book.publishedDate ?? '',
  pageCount: book.pageCount ? String(book.pageCount) : '',
  description: book.description ?? '',
  location: book.location ?? '',
  notes: book.notes ?? '',
  status: book.status,
  tags: book.tags,
  hiddenWhenShared: book.hiddenWhenShared
});

const orNull = (value: string) => value.trim() || null;

const updateFromForm = (form: Form): BookUpdate => ({
  title: form.title.trim(),
  author: form.author.trim(),
  isbn: orNull(form.isbn),
  category: orNull(form.category),
  publisher: orNull(form.publisher),
  publishedDate: orNull(form.publishedDate),
  pageCount: form.pageCount ? Number(form.pageCount) : null,
  description: orNull(form.description),
  location: orNull(form.location),
  notes: orNull(form.notes),
  tags: form.tags,
  hiddenWhenShared: form.hiddenWhenShared,
  // Loaned is set by lending and cleared by returning, so it isn't edited here.
  ...(form.status !== 'Loaned' && { status: form.status })
});

// Opened with ?id= from a book's details.
export default function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Try again" to load the book once more.
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const errors = useFormErrors(ERROR_FIELDS, { byCode: { BOOK_EXISTS: bookExistsField } });
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books/facets')
      .then(({ data }) => {
        if (!cancelled && data) setTagSuggestions(data.data.tags.map((tag) => tag.name));
      })
      // Suggestions are optional; tags can still be typed in.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books/{id}', { params: { path: { id } } })
      .then(({ data, error: apiError }) => {
        if (!data) throw toApiError(apiError);
        if (!cancelled) setState({ status: 'ready', form: formFromBook(data.data) });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state.status !== 'ready') {
    return (
      <ThemedView style={styles.centered}>
        {state.status === 'loading' ? (
          <DetailsSkeleton />
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {state.message}
            </ThemedText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setState({ status: 'loading' });
                setAttempt((count) => count + 1);
              }}
            />
          </>
        )}
      </ThemedView>
    );
  }

  const { form } = state;
  const update = (changes: Partial<Form>) => setState({ status: 'ready', form: { ...form, ...changes } });

  // Props for a text field bound to one form field; typing clears that field's error.
  const bind = (field: Field, clean: (text: string) => string = (text) => text) => ({
    value: form[field],
    onChangeText: (text: string) => {
      update({ [field]: clean(text) } as Partial<Form>);
      errors.clearFieldError(field);
    },
    error: errors.fieldErrors[field]
  });

  const save = async () => {
    errors.clearErrors();
    setSaving(true);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id } },
        body: updateFromForm(form)
      });
      if (!data) throw toApiError(apiError);
      router.back();
    } catch (err) {
      errors.showError(err);
      setSaving(false);
    }
  };

  return (
    <FormScreen title="Book details" edges={['bottom', 'left', 'right']}>
      <TextField label="Title" {...bind('title')} />
      <TextField label="Author" {...bind('author')} />
      <TextField
        label="ISBN"
        {...bind('isbn')}
        autoCapitalize="characters"
        hint="The 10 or 13 digit number above the barcode."
      />
      <TextField label="Category" {...bind('category')} />
      <TagInput
        tags={form.tags}
        suggestions={tagSuggestions}
        error={errors.fieldErrors.tags}
        onChange={(tags) => {
          update({ tags });
          errors.clearFieldError('tags');
        }}
      />
      <TextField label="Publisher" {...bind('publisher')} />
      <TextField
        label="Published"
        {...bind('publishedDate')}
        keyboardType="numbers-and-punctuation"
        hint="A year, or a date like 1990-09-01."
      />
      <TextField label="Pages" {...bind('pageCount', (text) => text.replace(/\D/g, ''))} keyboardType="number-pad" />
      <TextField label="Description" {...bind('description')} multiline style={styles.multiline} />
      <TextField label="Where it is" {...bind('location')} hint="Study, shelf 3. However you'd describe it." />

      {form.status === 'Loaned' ? (
        <ThemedText type="small" themeColor="textSecondary">
          This book is on loan. Mark it returned from its details to change its status.
        </ThemedText>
      ) : (
        <View style={styles.field}>
          <ThemedText type="smallBold">Status</ThemedText>
          <SegmentedControl
            accessibilityLabel="Status"
            options={STATUS_OPTIONS}
            value={form.status === 'Lost' ? 'Lost' : 'Available'}
            onChange={(status) => update({ status })}
          />
        </View>
      )}

      <View style={styles.field}>
        <ThemedText type="smallBold">On shared shelves</ThemedText>
        <SegmentedControl
          accessibilityLabel="Show on shared shelves"
          options={SHARING_OPTIONS}
          value={form.hiddenWhenShared ? 'hidden' : 'shown'}
          onChange={(choice) => update({ hiddenWhenShared: choice === 'hidden' })}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Hidden books never appear on a shelf you share, and can&apos;t be asked for.
        </ThemedText>
      </View>

      <TextField
        label="Notes"
        {...bind('notes')}
        multiline
        style={styles.multiline}
        hint="Only you ever see these. They stay off shared shelves, even for books you share."
      />

      <Button
        title="Save changes"
        onPress={save}
        loading={saving}
        disabled={!form.title.trim() || !form.author.trim()}
      />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four
  },
  center: {
    textAlign: 'center'
  },
  multiline: {
    minHeight: 120,
    paddingVertical: Spacing.three,
    textAlignVertical: 'top'
  },
  field: {
    gap: 6
  }
});
