import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Banner } from '@/components/banner';
import { BookCover } from '@/components/book-cover';
import { BorrowerAvatar } from '@/components/borrower-row';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { DetailsSkeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { StarRating } from '@/components/star-rating';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Typography } from '@/constants/theme';
import { useFormErrors } from '@/hooks/use-form-errors';

type Book = Schemas['Book'];
type Borrower = Schemas['Borrower'];
type Entitlements = Schemas['Entitlements'];
type Loaded = { book: Book; people: Borrower[]; entitlements: Entitlements };

const MESSAGE_MAX = 500;
const FIELDS = ['message', 'rating'] as const;
// Matches the server's cap per request.
const MAX_RECIPIENTS = 20;
const PEOPLE_LIMIT = 100;

// Matches defaultRecommendationMessage in the API's services/recommendations.mjs, which plans
// without custom messages always send.
const standardMessage = (book: Book) => `I think you'd enjoy "${book.title}" by ${book.author}. It's a great read!`;

// "Ada", "Ada and Grace", "Ada, Grace and 2 others".
const describe = (names: string[]) => {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} ${names.length === 3 ? 'other' : 'others'}`;
};

// Recommend a book to one or more borrowers by email. Opened with ?bookId=&borrowerId= from the
// book picker, which is why one person arrives already chosen; the rest are added here.
export default function RecommendScreen() {
  const { bookId, borrowerId } = useLocalSearchParams<{ bookId: string; borrowerId: string }>();
  const snackbar = useSnackbar();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by "Try again" to load everything once more.
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>(borrowerId ? [borrowerId] : []);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const errors = useFormErrors(FIELDS, {
    byCode: { MISSING_FIELDS: { field: 'message', message: 'Write a message to send with your recommendation' } }
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.GET('/books/{id}', { params: { path: { id: bookId } } }),
      api.GET('/borrowers/{id}', { params: { path: { id: borrowerId } } }),
      api.GET('/borrowers', { params: { query: { limit: PEOPLE_LIMIT } } }),
      api.GET('/me/entitlements')
    ])
      .then(([bookResult, borrowerResult, peopleResult, entitlementsResult]) => {
        if (!bookResult.data) throw toApiError(bookResult.error);
        if (!borrowerResult.data) throw toApiError(borrowerResult.error);
        if (!peopleResult.data) throw toApiError(peopleResult.error);
        if (!entitlementsResult.data) throw toApiError(entitlementsResult.error);
        if (cancelled) return;

        // The person you arrived with leads the list, and is added to it if they fell outside
        // the page that came back — otherwise they would be selected but invisible.
        const arrived = borrowerResult.data.data;
        const rest = peopleResult.data.data.filter((person) => person.id !== arrived.id);
        setLoaded({
          book: bookResult.data.data,
          people: [arrived, ...rest],
          entitlements: entitlementsResult.data.data
        });
        // Start from the rating the user already gave this book.
        setRating(bookResult.data.data.rating);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, borrowerId, attempt]);

  if (!loaded) {
    return (
      <ThemedView style={styles.centered}>
        {loadError ? (
          <View style={styles.section}>
            <FieldError message={loadError} />
            <Button title="Try again" variant="secondary" onPress={() => setAttempt((count) => count + 1)} />
          </View>
        ) : (
          <DetailsSkeleton />
        )}
      </ThemedView>
    );
  }

  const { book, people, entitlements } = loaded;
  const canWriteMessage = entitlements.features.customRecommendationMessage;
  const limit = entitlements.limits.recommendationsPerMonth;
  const used = entitlements.usage.recommendationsPerMonth;
  // Each recipient is its own email and its own recommendation, so each one counts separately.
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const overLimit = remaining !== null && selected.length > remaining;
  const chosenNames = selected
    .map((id) => people.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const toggle = (id: string) => {
    errors.clearErrors();
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id]
    );
  };

  const send = async () => {
    errors.clearErrors();
    setSending(true);
    try {
      const { data, error } = await api.POST('/recommendations', {
        body: {
          bookId: book.id,
          borrowerIds: selected,
          ...(rating > 0 && { rating }),
          ...(canWriteMessage && { message: message.trim() })
        }
      });
      if (!data) throw toApiError(error);

      router.back();
      // Say who did not get it rather than reporting a clean success: borrower mail is suppressed
      // by an unsubscribe, so someone can be missed without anything going wrong.
      const missed = data.meta.undelivered;
      snackbar.show(
        missed.length === 0
          ? `Recommended "${book.title}" to ${describe(chosenNames)}`
          : `Sent to ${data.meta.sent} of ${selected.length}. ${describe(missed.map((person) => person.name))} did not get it — they may have unsubscribed.`
      );
    } catch (err) {
      errors.showError(err);
      setSending(false);
    }
  };

  return (
    <FormScreen
      title="Send a recommendation"
      subtitle="Everyone you pick gets their own email with the book and your rating."
      edges={['bottom', 'left', 'right']}>
      <View style={styles.card}>
        <View style={styles.bookRow}>
          <BookCover title={book.title} thumbnail={book.thumbnail} size={64} />
          <View style={styles.flex}>
            <ThemedText style={styles.bookTitle} numberOfLines={2}>
              {book.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {book.author}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.replace({ pathname: '/pick-book', params: { borrowerId, for: 'recommend' } })}
              style={styles.change}>
              <ThemedText type="linkPrimary">Change book</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">
          {selected.length === 0 ? 'Who should get it?' : `Sending to ${selected.length}`}
        </ThemedText>

        <View style={styles.people}>
          {people.map((person, index) => {
            const chosen = selected.includes(person.id);
            const full = !chosen && selected.length >= MAX_RECIPIENTS;
            return (
              <Pressable
                key={person.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: chosen, disabled: full }}
                accessibilityLabel={person.name}
                disabled={full}
                onPress={() => toggle(person.id)}
                style={({ pressed }) => [
                  styles.person,
                  index > 0 && styles.personDivided,
                  pressed && styles.personPressed
                ]}>
                <BorrowerAvatar email={person.email} name={person.name} size={36} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {person.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {person.email}
                  </ThemedText>
                </View>
                <View style={[styles.tick, chosen && styles.tickOn, full && styles.tickFull]}>
                  {chosen ? <Icon name="check" color={Colors.textOnDark} size={14} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {people.length === 1 ? (
          <ThemedText style={[Typography.hint, styles.hint]}>
            Add more borrowers to recommend to several people at once.
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Your rating</ThemedText>
        <StarRating
          label="Your rating"
          value={rating}
          onChange={(value) => {
            setRating(value);
            errors.clearFieldError('rating');
          }}
        />
        {errors.fieldErrors.rating ? (
          <FieldError message={errors.fieldErrors.rating} />
        ) : (
          <ThemedText style={[Typography.hint, styles.hint]}>
            {book.rating > 0
              ? 'Filled in from your rating of this book. Tap a star to change it.'
              : 'Optional. Tap a star again to clear it.'}
          </ThemedText>
        )}
      </View>

      {canWriteMessage ? (
        <TextField
          label="Your message"
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            errors.clearFieldError('message');
          }}
          error={errors.fieldErrors.message}
          hint={`${message.length}/${MESSAGE_MAX}`}
          maxLength={MESSAGE_MAX}
          multiline
          style={styles.multiline}
        />
      ) : (
        <View style={styles.section}>
          <ThemedText type="smallBold">Message</ThemedText>
          <View style={styles.preview}>
            <ThemedText type="small" style={styles.previewText}>
              {standardMessage(book)}
            </ThemedText>
          </View>
          <Banner tone="plan">
            Personal messages are a Premium feature. Everyone gets this standard message.
          </Banner>
        </View>
      )}

      {/* Each recipient spends one of the monthly allowance, so picking four when two are left
          is refused by the server outright rather than partly sent. Better to say so here. */}
      {remaining === 0 ? (
        <Banner tone="plan">{`You've used all ${limit} recommendations this month.`}</Banner>
      ) : overLimit ? (
        <Banner tone="plan">
          {`You've picked ${selected.length} people but have ${remaining} ${remaining === 1 ? 'recommendation' : 'recommendations'} left this month. Remove ${selected.length - (remaining ?? 0)} to send.`}
        </Banner>
      ) : remaining !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`${used} of ${limit} used this month — each person counts as one`}
        </ThemedText>
      ) : null}

      <Button
        title={selected.length > 1 ? `Send to ${selected.length} people` : 'Send recommendation'}
        onPress={send}
        loading={sending}
        disabled={selected.length === 0 || overLimit || (canWriteMessage && !message.trim())}
      />
      {errors.formError ? <FieldError message={errors.formError} /> : null}
    </FormScreen>
  );
}

const TICK_SIZE = 22;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    gap: 14,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  bookRow: {
    flexDirection: 'row',
    gap: 14
  },
  bookTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text
  },
  change: {
    alignSelf: 'flex-start',
    marginTop: 6
  },
  // One block with rules between, like the figures on the stats screen: these are one list of
  // people, not a stack of separate cards.
  people: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden'
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12
  },
  personDivided: {
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  personPressed: {
    backgroundColor: Colors.background
  },
  tick: {
    width: TICK_SIZE,
    height: TICK_SIZE,
    borderRadius: TICK_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tickOn: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brand
  },
  tickFull: {
    borderColor: Colors.disabledBorder,
    backgroundColor: Colors.disabledSurface
  },
  section: {
    gap: 8
  },
  hint: {
    color: Colors.textSecondary
  },
  multiline: {
    minHeight: 120,
    paddingVertical: 16,
    textAlignVertical: 'top'
  },
  preview: {
    padding: 14,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  previewText: {
    color: Colors.textBody
  }
});
