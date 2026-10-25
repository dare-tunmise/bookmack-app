import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { jacketFor } from '@/lib/jacket';

// The year as a shelf: one spine per book, as thick as its page count, in the order they were
// finished. It is a real chart — both halves share one scale, so a busier half-year is visibly
// longer — and it could not belong to any other app, because the marks are the books.
//
// Split in two so a year fits a phone without each spine becoming a hair. The split is at the
// midpoint of the year rather than at the midpoint of the books, so the two labels mean something.

export type ShelfBook = {
  id: string;
  title: string;
  pageCount: number | null;
  finishedAt: string;
};

// A book with no page count still happened, so it gets a spine — just the narrowest one, rather
// than being dropped from the reader's year because a catalogue was thin.
const UNKNOWN_PAGES = 120;
// Below this a spine is a line, and a title inside it is noise.
const MIN_TITLE_WIDTH = 13;
const MIN_SPINE = 3;
const GAP = 1;

const HALVES: { label: string; test: (month: number) => boolean }[] = [
  { label: 'January to June', test: (month) => month <= 5 },
  { label: 'July to December', test: (month) => month > 5 }
];

type YearShelfProps = {
  books: ShelfBook[];
  width: number;
  height: number;
  labelColor: string;
};

export function YearShelf({ books, width, height, labelColor }: YearShelfProps) {
  const halves = HALVES.map((half) => ({
    ...half,
    books: books.filter((book) => half.test(new Date(book.finishedAt).getUTCMonth()))
  }));

  const pagesOf = (book: ShelfBook) => book.pageCount ?? UNKNOWN_PAGES;
  const totals = halves.map((half) => half.books.reduce((sum, book) => sum + pagesOf(book), 0));
  const widest = Math.max(...totals, 1);
  // One scale across both shelves. Measured against the busier half so it just fits, and the
  // quieter half is then honestly shorter.
  const gaps = Math.max(0, Math.max(...halves.map((half) => half.books.length)) - 1);
  const perPage = (width - gaps * GAP) / widest;

  // A half-year with nothing in it is not drawn at all. It used to render a full-height empty box
  // and a ledge under a "0 pages" label, which read as a bug rather than as a quiet half-year.
  const shown = halves.map((half, index) => ({ ...half, total: totals[index] })).filter((half) => half.books.length);

  return (
    <View style={styles.shelves}>
      {shown.map((half) => (
        <View key={half.label}>
          <View style={styles.label}>
            <ThemedText type="caption" style={[styles.labelText, { color: labelColor }]}>
              {half.label}
            </ThemedText>
            <ThemedText type="caption" style={[styles.labelText, { color: labelColor }]}>
              {half.total.toLocaleString()} pages
            </ThemedText>
          </View>

          <View style={[styles.shelf, { height }]}>
            {half.books.map((book) => {
              const spine = Math.max(MIN_SPINE, pagesOf(book) * perPage);
              const { bg, fg } = jacketFor(book.title);
              // Type that fits the spine it is written on: never taller than the spine is wide,
              // and never longer than the spine is tall.
              const size = Math.max(
                6,
                Math.min(height * 0.12, spine * 0.52, (height * 0.8) / (book.title.length * 0.56))
              );
              return (
                <View
                  key={book.id}
                  accessible
                  accessibilityLabel={`${book.title}, ${book.pageCount ?? 'unknown'} pages`}
                  style={[styles.spine, { width: spine, height, backgroundColor: bg }]}>
                  {/* The rounded band near the top of a real spine. */}
                  <View style={[styles.band, { backgroundColor: fg }]} />
                  {spine >= MIN_TITLE_WIDTH ? (
                    <ThemedText
                      numberOfLines={1}
                      style={[styles.title, { color: fg, fontSize: size, width: height * 0.82 }]}>
                      {book.title}
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.ledge} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shelves: {
    gap: 18
  },
  label: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7
  },
  labelText: {
    fontFamily: Fonts.bodySemiBold,
    fontVariant: ['tabular-nums']
  },
  shelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: GAP
  },
  spine: {
    overflow: 'hidden',
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '6%',
    height: 2,
    opacity: 0.3
  },
  // Rotated rather than set vertically: React Native has no writing-mode, and a rotated single
  // line is what a spine actually reads like.
  title: {
    fontFamily: Fonts.heading,
    transform: [{ rotate: '90deg' }],
    textAlign: 'left'
  },
  ledge: {
    height: 7,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    backgroundColor: '#4A7533'
  }
});
