import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { GenrePoster, type GenreSelection } from '@/components/genre-poster';
import { Skeleton } from '@/components/skeleton';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type Book = Schemas['Book'];

// A genre is small — the design's own example is 48 books — so one request brings the whole thing and
// the status counts are taken from what is in hand. The alternative was three more count queries, or
// a total on the list endpoint that does not exist; neither earns its keep for a few dozen rows.
const FETCH_LIMIT = 100;
// How many rows before "See all" expands the rest.
const PREVIEW_ROWS = 4;

// The slice that was tapped, carrying its colour with it so the link between the two screens is
// visible rather than implied. Defined alongside the poster and re-exported here, because both need
// it and only one of them can own it without the two importing each other.
export type { GenreSelection };

type Filter = 'all' | 'read' | 'reading' | 'unread';

// Partitioned so the three chips sum to the genre's total. 'rereading' sits under Reading because
// that is what it is now, even though the book has also been read once.
const bucketOf = (book: Book): Exclude<Filter, 'all'> => {
  if (book.readingStatus === 'reading' || book.readingStatus === 'rereading') return 'reading';
  if (book.readingStatus === 'read') return 'read';
  return 'unread';
};

const STATUS_WORD: Record<Exclude<Filter, 'all'>, string> = {
  read: 'Read',
  reading: 'Reading',
  unread: 'Unread'
};

export function GenreSheet({
  genre,
  libraryTotal,
  onClose
}: {
  genre: GenreSelection | null;
  libraryTotal: number;
  onClose: () => void;
}) {
  // Keeps showing the last genre while the sheet slides closed.
  const [shown, setShown] = useState(genre);
  if (genre && genre !== shown) setShown(genre);

  return (
    <BottomSheet visible={genre !== null} onClose={onClose}>
      {shown ? <GenreDetail key={shown.name} genre={shown} libraryTotal={libraryTotal} /> : null}
    </BottomSheet>
  );
}

function GenreDetail({ genre, libraryTotal }: { genre: GenreSelection; libraryTotal: number }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books', { params: { query: { category: genre.name, limit: FETCH_LIMIT, sort: 'title' } } })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        if (!data) throw toApiError(apiError);
        setBooks(data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [genre.name]);

  const share = libraryTotal > 0 ? Math.round((genre.count / libraryTotal) * 100) : 0;
  const counts = { read: 0, reading: 0, unread: 0 };
  let onLoan = 0;
  for (const book of books ?? []) {
    counts[bucketOf(book)] += 1;
    if (book.status === 'Loaned') onLoan += 1;
  }

  const matching = (books ?? []).filter((book) => filter === 'all' || bucketOf(book) === filter);
  const rows = expanded ? matching : matching.slice(0, PREVIEW_ROWS);

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        {/* The slice's own colour, so the two screens are visibly the same thing. */}
        <View style={[styles.swatch, { backgroundColor: genre.colour }]} />
        <ThemedText style={styles.title} numberOfLines={1}>
          {genre.name}
        </ThemedText>
        <ThemedText style={styles.count}>{genre.count.toLocaleString()}</ThemedText>
      </View>

      <ThemedText style={styles.note}>
        {books === null
          ? `${share}% of your library`
          : `${share}% of your library · ${counts.read} read${onLoan > 0 ? `, ${onLoan} on loan` : ''}`}
      </ThemedText>

      {books === null ? (
        <View style={styles.loading}>
          <Skeleton width="100%" height={34} radius={Radius.pill} />
          <Skeleton width="100%" height={180} radius={Radius.card} />
        </View>
      ) : error ? (
        <FieldError message={error} />
      ) : (
        <>
          <View style={styles.chips}>
            {(['read', 'reading', 'unread'] as const).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === key }}
                onPress={() => setFilter((current) => (current === key ? 'all' : key))}
                style={({ pressed }) => [
                  styles.chip,
                  filter === key && styles.chipOn,
                  pressed && styles.pressed
                ]}>
                <ThemedText style={[styles.chipLabel, filter === key && styles.chipLabelOn]}>
                  {`${STATUS_WORD[key]} ${counts[key]}`}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listBody} showsVerticalScrollIndicator={false}>
            {rows.map((book) => (
              <View key={book.id} style={styles.row}>
                <BookCover title={book.title} thumbnail={book.thumbnail} size={38} />
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle} numberOfLines={1}>
                    {book.title}
                  </ThemedText>
                  <ThemedText style={styles.rowMeta} numberOfLines={1}>
                    {`${book.author} · ${book.status === 'Loaned' ? 'On loan' : STATUS_WORD[bucketOf(book)]}`}
                  </ThemedText>
                </View>
              </View>
            ))}
            {rows.length === 0 ? (
              <ThemedText style={styles.rowMeta}>Nothing in this genre with that status.</ThemedText>
            ) : null}
          </ScrollView>

          {!expanded && matching.length > PREVIEW_ROWS ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded(true)}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
              <ThemedText style={styles.seeAllLabel}>{`See all ${matching.length}`}</ThemedText>
            </Pressable>
          ) : null}

          {books.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPosterOpen(true)}
              style={({ pressed }) => [styles.poster, pressed && styles.pressed]}>
              <Icon name="image" color={Colors.textOnDark} size={18} strokeWidth={2} />
              <ThemedText style={styles.posterLabel}>Make a poster</ThemedText>
            </Pressable>
          ) : null}

          <GenrePoster
            genre={posterOpen ? genre : null}
            books={books}
            onClose={() => setPosterOpen(false)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: 14
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  count: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  note: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary
  },
  loading: {
    gap: 14
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipOn: {
    backgroundColor: Colors.text,
    borderColor: Colors.text
  },
  chipLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.text
  },
  chipLabelOn: {
    color: Colors.accent
  },
  pressed: {
    opacity: 0.7
  },
  list: {
    // Caps the sheet rather than letting a large genre push the button off the screen.
    maxHeight: 320,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  listBody: {
    paddingTop: 4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10
  },
  rowText: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2
  },
  rowTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14.5,
    lineHeight: 19,
    color: Colors.text
  },
  rowMeta: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textSecondary
  },
  seeAll: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  seeAllLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.text
  },
  poster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text
  },
  posterLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.textOnDark
  }
});
