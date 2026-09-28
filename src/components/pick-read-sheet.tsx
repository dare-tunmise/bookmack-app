import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { ApiError, errorMessage, toApiError } from '@/api/errors';
import { Banner } from '@/components/banner';
import { BookCover } from '@/components/book-cover';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { usePlanLimit } from '@/components/plan-limit-sheet';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];
type Match = Schemas['AskResult']['matches'][number];
type Mood = 'surprise' | 'short' | 'long' | 'waiting' | 'new' | 'favourite';

// Each mood is a fact about the books, not a guess about how they read.
const MOODS: { key: Mood; label: string; why: string }[] = [
  { key: 'surprise', label: 'Surprise me', why: 'Picked at random from your unread books' },
  { key: 'short', label: 'Something short', why: '250 pages or fewer' },
  { key: 'long', label: 'Something long', why: '500 pages or more' },
  { key: 'waiting', label: "It's been waiting", why: "On your shelf for over 90 days and still unread" },
  { key: 'new', label: 'Just arrived', why: 'Added in the last 30 days' },
  { key: 'favourite', label: 'An author you rated', why: 'By someone whose book you gave 4 stars or more' }
];

type PickReadSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The suggested book was started, so the shelf and reading strip can refresh.
  onStarted: (book: Book) => void;
};

// "What should I read?" — picks one unread book you actually have to hand.
export function PickReadSheet({ visible, onClose, onStarted }: PickReadSheetProps) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [needsPremium, setNeedsPremium] = useState(false);
  const { show: showPlanLimit } = usePlanLimit();

  // Asks the shelf a question in your own words. Premium only, so a free account is told why
  // rather than shown a failure.
  const ask = async () => {
    const asked = question.trim();
    if (!asked || asking) return;

    setAsking(true);
    setMood(null);
    setBook(null);
    setMatches(null);
    setWhy(null);
    setMessage(null);
    setNeedsPremium(false);
    try {
      const { data, error } = await api.POST('/books/ask', { body: { question: asked, limit: 5 } });
      if (!data) throw toApiError(error);
      setMatches(data.data.matches);
      if (data.data.matches.length === 0) setMessage('Nothing on your shelf matches that.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FEATURE_NOT_IN_PLAN') setNeedsPremium(true);
      else if (!showPlanLimit(err)) setMessage(errorMessage(err));
    } finally {
      setAsking(false);
    }
  };

  const close = () => {
    onClose();
    // Start fresh next time, rather than reopening on an old suggestion.
    setMood(null);
    setBook(null);
    setMessage(null);
    setQuestion('');
    setMatches(null);
    setWhy(null);
    setNeedsPremium(false);
  };

  const pick = async (next: Mood) => {
    setMood(next);
    setLoading(true);
    setBook(null);
    setMatches(null);
    setWhy(null);
    setNeedsPremium(false);
    setMessage(null);
    try {
      const { data, error } = await api.GET('/books/suggestion', { params: { query: { mood: next } } });
      if (!data) throw toApiError(error);
      setBook(data.data);
    } catch (err) {
      // "Nothing matches" is an ordinary answer here, not a failure.
      setMessage(err instanceof ApiError && err.code === 'NO_MATCH' ? err.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const startReading = async () => {
    if (!book) return;
    setStarting(true);
    setMessage(null);
    try {
      const { data, error } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: { readingStatus: 'reading' }
      });
      if (!data) throw toApiError(error);
      onStarted(data.data);
      close();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const chosen = MOODS.find((option) => option.key === mood);

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={styles.header}>
        <Icon name="ask" color={Colors.brand} size={22} />
        <ThemedText type="h2" accessibilityRole="header">
          What should I read?
        </ThemedText>
      </View>

      <TextField
        label="Ask for something"
        value={question}
        onChangeText={setQuestion}
        onSubmitEditing={ask}
        returnKeyType="search"
        autoCapitalize="none"
        hint='For example: "a book about Nigerian history"'
      />
      {question.trim() ? <Button title="Ask" onPress={ask} loading={asking} /> : null}

      {needsPremium ? (
        <View style={styles.result}>
          <Banner tone="plan">Asking your library in your own words is a Premium feature.</Banner>
          <Button
            title="See plans"
            variant="secondary"
            onPress={() => {
              close();
              router.push('/plan');
            }}
          />
        </View>
      ) : null}

      {matches && matches.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.matches} contentContainerStyle={styles.matchesContent} nestedScrollEnabled>
          {matches.map((match) => (
            <Pressable
              key={match.book.id}
              accessibilityRole="button"
              onPress={() => {
                setBook(match.book);
                setWhy(match.reason);
                setMatches(null);
              }}
              style={({ pressed }) => [styles.match, pressed && styles.matchPressed]}>
              <BookCover title={match.book.title} thumbnail={match.book.thumbnail} size={40} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {match.book.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {match.reason || match.book.author}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.moods}>
        {MOODS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={option.key === mood}
            onPress={() => pick(option.key)}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brand} />
        </View>
      ) : null}

      {book ? (
        <View style={styles.result}>
          <View style={styles.bookRow}>
            <BookCover title={book.title} thumbnail={book.thumbnail} size={64} />
            <View style={styles.flex}>
              <ThemedText style={styles.title} numberOfLines={2}>
                {book.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {book.author}
              </ThemedText>
              {book.pageCount ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {`${book.pageCount.toLocaleString()} pages`}
                </ThemedText>
              ) : null}
            </View>
          </View>
          {why ?? chosen?.why ? <ThemedText style={styles.why}>{why ?? chosen?.why}</ThemedText> : null}
          <Button title="Start reading it" onPress={startReading} loading={starting} />
          <Button title="Pick another" variant="secondary" onPress={() => mood && pick(mood)} disabled={starting} />
        </View>
      ) : null}

      {message ? <FieldError message={message} /> : null}

      {!book && !loading && !message ? (
        <ThemedText type="small" themeColor="textSecondary">
          Choose a mood and BookMack picks one book you own, haven&apos;t read, and haven&apos;t lent out.
        </ThemedText>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two
  },
  flex: {
    flex: 1
  },
  moods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one
  },
  centered: {
    paddingVertical: Spacing.four
  },
  result: {
    gap: Spacing.three
  },
  matches: {
    // About four rows; longer answers scroll inside the sheet.
    maxHeight: 260
  },
  matchesContent: {
    gap: Spacing.two
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.card
  },
  matchPressed: {
    backgroundColor: Colors.background
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.background
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text
  },
  why: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary
  }
});
