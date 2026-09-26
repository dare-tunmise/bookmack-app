import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];

const MAX_SHOWN = 10;
const COVER_WIDTH = 64;

export const readingProgress = (book: Book) =>
  book.currentPage && book.pageCount ? Math.min(1, book.currentPage / book.pageCount) : null;

type CurrentlyReadingProps = {
  onPressBook: (book: Book) => void;
  // Changing this reloads the strip, e.g. after a book is marked read.
  reloadKey?: number;
};

// The books being read right now, above the shelf. Hidden entirely when nothing is in progress,
// so a library that is only lent and catalogued doesn't grow an empty row.
export function CurrentlyReading({ onPressBook, reloadKey = 0 }: CurrentlyReadingProps) {
  const [books, setBooks] = useState<Book[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    api
      .GET('/books', { params: { query: { readingStatus: 'reading', limit: MAX_SHOWN } } })
      .then(({ data }) => {
        if (!cancelled && data) setBooks(data.data);
      })
      // The shelf below still works without this strip.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload when the screen comes back into view...
  useFocusEffect(load);

  // ...and when a book changes while the screen stays open, e.g. one is marked read in the
  // details sheet.
  useEffect(() => {
    if (reloadKey === 0) return;
    return load();
  }, [reloadKey, load]);

  if (books.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Icon name="reading" color={Colors.textSecondary} size={16} />
        <ThemedText accessibilityRole="header" style={styles.heading}>
          Currently reading
        </ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {books.map((book) => {
          const progress = readingProgress(book);
          return (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityLabel={
                progress === null
                  ? `${book.title}, in progress`
                  : `${book.title}, ${Math.round(progress * 100)} percent read`
              }
              onPress={() => onPressBook(book)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <BookCover title={book.title} thumbnail={book.thumbnail} size={COVER_WIDTH} />
              {progress === null ? null : (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                </View>
              )}
              <ThemedText style={styles.title} numberOfLines={2}>
                {book.title}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three
  },
  heading: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  row: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three
  },
  item: {
    width: COVER_WIDTH,
    gap: Spacing.one
  },
  pressed: {
    opacity: 0.7
  },
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brand
  },
  title: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textSecondary
  }
});
