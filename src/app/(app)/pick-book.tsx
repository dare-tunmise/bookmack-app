import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { ListRowSkeleton } from '@/components/skeleton';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];

const SEARCH_DEBOUNCE_MS = 300;
const LIST_SIZE = 50;

// Choose a book for a borrower (opened with ?borrowerId=), then continue to lending or, with
// ?for=recommend, to recommending. Only books on the shelf can be lent, so lending lists available
// books; any book can be recommended.
export default function PickBookScreen() {
  const { borrowerId, for: purpose } = useLocalSearchParams<{ borrowerId: string; for?: 'lend' | 'recommend' }>();
  const recommending = purpose === 'recommend';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books', {
        params: {
          query: {
            ...(recommending ? {} : { status: 'Available' as const }),
            sort: 'title',
            limit: LIST_SIZE,
            q: query || undefined
          }
        }
      })
      .then(({ data, error: apiError }) => {
        if (!data) throw toApiError(apiError);
        if (cancelled) return;
        setBooks(data.data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [query, recommending]);

  // Replace this screen, so going back from the next step returns to the borrower.
  const choose = (book: Book) =>
    router.replace({ pathname: recommending ? '/recommend' : '/lend', params: { bookId: book.id, borrowerId } });

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={books ?? []}
        keyExtractor={(book) => book.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Search your books"
              value={search}
              onChangeText={setSearch}
              placeholder="Title, author, or ISBN"
              autoCorrect={false}
            />
            {error ? <FieldError message={error} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => choose(item)}>
            {({ pressed }) => (
              <ThemedView type={pressed ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
                <BookCover title={item.title} thumbnail={item.thumbnail} />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.author}
                  </ThemedText>
                </View>
              </ThemedView>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          books === null ? (
            error ? null : (
              <ListRowSkeleton />
            )
          ) : query ? (
            <EmptyState
              seed="no-book-matches"
              title="No matches"
              message={`No ${recommending ? '' : 'available '}books match "${query}".`}
            />
          ) : recommending ? (
            <EmptyState seed="empty-library" title="Your library is empty" message="Add a book first, then recommend it." />
          ) : (
            <EmptyState
              seed="nothing-to-lend"
              title="No books to lend"
              message="Books on your shelf that aren't lent out show up here."
            />
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.card
  },
  rowText: {
    flex: 1,
    gap: Spacing.half
  }
});
