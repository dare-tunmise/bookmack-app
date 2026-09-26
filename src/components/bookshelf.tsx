import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { Badge, BOOK_STATUS_BADGES } from '@/components/badge';
import { BookCover } from '@/components/book-cover';
import { ShelfSkeleton } from '@/components/skeleton';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];

const SHELF_PADDING = Spacing.three;
const BOOK_INSET = Spacing.one;
const COVER_GAP = 12;
const MIN_COVER_WIDTH = 76;
const MAX_COLUMNS = 6;

type BookshelfProps = {
  books: Book[];
  onPressBook: (book: Book) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  empty: ReactElement | null;
  footer: ReactElement | null;
  // Shows skeleton shelves while the first page loads.
  loading?: boolean;
  // Extra space below the last shelf, e.g. to scroll clear of a floating button.
  bottomInset?: number;
};

const toRows = <T,>(items: T[], perRow: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / perRow) }, (_, row) => items.slice(row * perRow, (row + 1) * perRow));

// Covers standing in rows on flat shelf ledges, as many per row as fit the screen width.
export function Bookshelf({
  books,
  onPressBook,
  refreshing,
  onRefresh,
  onEndReached,
  empty,
  footer,
  loading = false,
  bottomInset = 0
}: BookshelfProps) {
  const { width } = useWindowDimensions();

  const available = Math.min(width, MaxContentWidth) - SHELF_PADDING * 2 - BOOK_INSET * 2;
  const columns = Math.max(3, Math.min(MAX_COLUMNS, Math.floor((available + COVER_GAP) / (MIN_COVER_WIDTH + COVER_GAP))));
  const coverWidth = Math.floor((available - COVER_GAP * (columns - 1)) / columns);
  const rows = toRows(books, columns);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0].id}
      contentContainerStyle={
        rows.length === 0 && !loading ? styles.emptyContent : [styles.content, { paddingBottom: bottomInset }]
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand]} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={loading ? <ShelfSkeleton /> : empty}
      ListFooterComponent={footer}
      renderItem={({ item: row }) => (
        <View style={styles.shelf}>
          <View style={[styles.books, { gap: COVER_GAP }]}>
            {row.map((book) => {
              const badge = book.status === 'Available' ? null : BOOK_STATUS_BADGES[book.status];
              return (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${book.title} by ${book.author}${badge ? `, ${badge.label}` : ''}`}
                  onPress={() => onPressBook(book)}
                  style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
                  <BookCover title={book.title} thumbnail={book.thumbnail} size={coverWidth} />
                  {badge ? <Badge label={badge.label} tone={badge.tone} style={styles.coverBadge} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.ledge} />
          <View style={styles.ledgeShade} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.four,
    paddingHorizontal: SHELF_PADDING,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four
  },
  shelf: {
    marginBottom: Spacing.five
  },
  books: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: BOOK_INSET
  },
  book: {
    borderRadius: Radius.cover,
    backgroundColor: Colors.surface,
    ...Shadows.cover
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }]
  },
  coverBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one
  },
  ledge: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brandTint
  },
  ledgeShade: {
    height: 1,
    marginHorizontal: Spacing.two,
    backgroundColor: Colors.border
  }
});
