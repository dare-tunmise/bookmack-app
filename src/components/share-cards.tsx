import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { jacketFor } from '@/lib/jacket';
import { MONTHS } from '@/lib/year-stats';

// The two share cards, drawn at their real size and scaled to fit wherever they are shown, so the
// preview in the sheet and the image that gets captured are the same component.
//
// There is nothing to choose here on purpose: no themes, no layouts, no fonts. The old poster
// editor offered sixty-four combinations, most of which were worse than the default.
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

// What a card needs, and no more. Narrower than a year's totals on purpose: the same two cards
// are made from a year's shelf and from a handful of books picked by hand in Library, and those
// two have different shapes. What `deriveYear` returns satisfies this as it stands.
export type CardBook = {
  id: string;
  title: string;
  author: string;
  thumbnail: string | null;
  pageCount: number | null;
};

export type CardData = {
  year: number;
  books: CardBook[];
  count: number;
  pages: number;
  // Only the Numbers card reads these two.
  bestMonth: number;
  longest: CardBook | null;
};

/** Card data for an arbitrary set of books, for the sheet Library opens from a selection. */
export const cardDataFromBooks = (books: CardBook[], year: number): CardData => ({
  year,
  books,
  count: books.length,
  pages: books.reduce((total, book) => total + (book.pageCount ?? 0), 0),
  bestMonth: 0,
  longest: books.reduce<CardBook | null>(
    (best, book) => ((book.pageCount ?? 0) > (best?.pageCount ?? 0) ? book : best),
    null
  )
});

// The art area's ceiling, from the design: the collage takes what it needs up to this, and the
// head keeps the rest.
const ART_MAX = 950;
const COVER_RATIO = 1.5;

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

// How badly a collage of this height fits the space. Under-filling is mild, over-filling is worse
// but tolerable to 1.2, and beyond that it is simply wrong.
const fillScore = (ratio: number) => (ratio <= 1 ? (1 - ratio) * 1.2 : ratio <= 1.2 ? (ratio - 1) * 2.5 : 9);

/**
 * Rows that always fill the width, which is what the design asks of this card: the remainder is
 * spread across the rows and every cell flexes, so the collage is a complete rectangle edge to
 * edge whatever the number of books. Cells in a shorter row come out wider.
 */
function layout(books: CardBook[], maxHeight: number) {
  let best = { rows: 1, rowHeight: CARD_WIDTH * COVER_RATIO, height: CARD_WIDTH * COVER_RATIO, score: Infinity };

  for (let rows = 1; rows <= Math.min(books.length, 10); rows += 1) {
    const columns = Math.ceil(books.length / rows);
    const rowHeight = (CARD_WIDTH / columns) * COVER_RATIO;
    const height = rows * rowHeight;
    const score = fillScore(height / maxHeight);
    if (score < best.score) best = { rows, rowHeight, height, score };
  }

  const base = Math.floor(books.length / best.rows);
  const extra = books.length % best.rows;
  const lines: CardBook[][] = [];
  let index = 0;
  for (let row = 0; row < best.rows; row += 1) {
    const size = base + (row < extra ? 1 : 0);
    lines.push(books.slice(index, index + size));
    index += size;
  }

  return { lines, rowHeight: best.rowHeight, height: best.height };
}

// Fills its cell and crops, rather than letterboxing: a strip of background between covers is
// what makes a collage look assembled instead of printed.
function CardCover({ book }: { book: CardBook }) {
  if (book.thumbnail) {
    return <Image source={book.thumbnail} style={styles.cell} contentFit="cover" accessibilityIgnoresInvertColors />;
  }

  const { bg, fg, layout: style } = jacketFor(book.title);
  const centred = style === 2 || style === 5;
  const bottom = style === 3 || style === 4;

  return (
    <View
      style={[
        styles.cell,
        styles.jacket,
        { backgroundColor: bg },
        centred && styles.jacketCentred,
        bottom && styles.jacketBottom
      ]}>
      {style === 4 ? <View style={[styles.orb, { backgroundColor: fg }]} /> : null}
      {style === 3 ? <View style={[styles.band, { backgroundColor: fg }]} /> : null}
      <ThemedText numberOfLines={5} style={[styles.jacketTitle, { color: fg }, centred && styles.centredText]}>
        {book.title}
      </ThemedText>
      <ThemedText numberOfLines={1} style={[styles.jacketAuthor, { color: fg }, centred && styles.centredText]}>
        {book.author}
      </ThemedText>
    </View>
  );
}

function CardTop({ handle, quiet, mark }: { handle: string; quiet: string; mark: string }) {
  return (
    <View style={styles.top}>
      <View style={styles.markRow}>
        <BrandMark size={58} />
        <ThemedText style={[styles.markText, { color: mark }]}>BookMack</ThemedText>
      </View>
      <ThemedText style={[styles.handle, { color: quiet }]}>{handle}</ThemedText>
    </View>
  );
}

export type CardProps = { stats: CardData; handle: string; title: string };

/** Every book finished in the year, edge to edge, under the count and the page total. */
export function CoversCard({ stats, handle, title }: CardProps) {
  const grid = layout(stats.books, CARD_HEIGHT - 400);
  const artHeight = Math.min(grid.height, ART_MAX);

  return (
    <View style={[styles.card, styles.light]}>
      <View style={styles.head}>
        <CardTop handle={handle} quiet="#5E6B58" mark="#163300" />
        <View>
          <ThemedText numberOfLines={2} style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {`${stats.count} book${stats.count === 1 ? '' : 's'}, ${fmt(stats.pages)} pages`}
          </ThemedText>
        </View>
      </View>

      <View style={{ height: artHeight, overflow: 'hidden' }}>
        {grid.lines.map((line, row) => (
          <View key={row} style={{ flexDirection: 'row', height: grid.rowHeight }}>
            {line.map((book) => (
              <View key={book.id} style={styles.flexCell}>
                <CardCover book={book} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The count, three facts, and the year's books as a row of spines along the bottom. */
export function NumbersCard({ stats, handle }: CardProps) {
  // Spines vary in height so the row reads as a shelf rather than a bar chart. Off the title, so
  // a book keeps the same spine every time the card is made.
  const spineHeight = (text: string) => {
    let value = 0;
    for (const character of text) value = (value * 31 + character.charCodeAt(0)) % 997;
    return 100 + (value % 50);
  };

  const facts: [string, string][] = [
    ['Pages', fmt(stats.pages)],
    ['Most pages', MONTHS[stats.bestMonth]],
    ['Longest', stats.longest?.title ?? '—']
  ];

  return (
    <View style={[styles.card, styles.dark]}>
      <CardTop handle={handle} quiet="#9DB88B" mark="#E7F1E0" />
      <ThemedText style={styles.bigNumber}>{stats.count}</ThemedText>
      <ThemedText style={styles.bigLabel}>{`books in ${stats.year}`}</ThemedText>

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <ThemedText style={styles.factLabel}>{label}</ThemedText>
            <ThemedText numberOfLines={1} style={styles.factValue}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.spines}>
        {stats.books.map((book) => (
          <View
            key={book.id}
            style={{
              flexGrow: book.pageCount ?? 1,
              flexShrink: 1,
              flexBasis: 0,
              height: spineHeight(book.title),
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: jacketFor(book.title).bg
            }}
          />
        ))}
      </View>
    </View>
  );
}

export const CARDS = [
  { name: 'Covers', Card: CoversCard },
  { name: 'Numbers', Card: NumbersCard }
] as const;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden'
  },
  light: { backgroundColor: '#F6F7F4' },
  dark: { backgroundColor: '#163300', paddingTop: 70, paddingHorizontal: 72 },

  head: {
    flex: 1,
    paddingTop: 70,
    paddingHorizontal: 72,
    paddingBottom: 60,
    justifyContent: 'space-between'
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  markText: { fontFamily: Fonts.display, fontSize: 40, lineHeight: 48, letterSpacing: -0.5 },
  handle: { fontFamily: Fonts.bodySemiBold, fontSize: 30, lineHeight: 38 },

  title: { fontFamily: Fonts.display, fontSize: 136, lineHeight: 129, letterSpacing: -4.5, color: '#163300' },
  subtitle: { fontFamily: Fonts.bodySemiBold, fontSize: 40, lineHeight: 50, color: '#5E6B58', marginTop: 18 },

  bigNumber: {
    fontFamily: Fonts.display,
    fontSize: 420,
    lineHeight: 328,
    letterSpacing: -18,
    color: '#9FE870',
    marginTop: 110,
    marginLeft: -12
  },
  bigLabel: { fontFamily: Fonts.display, fontSize: 66, lineHeight: 76, letterSpacing: -1.5, color: '#E7F1E0', marginTop: 34 },

  facts: { marginTop: 'auto' },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 30,
    paddingVertical: 24,
    borderTopWidth: 2,
    borderTopColor: 'rgba(159,232,112,0.18)'
  },
  factLabel: { fontFamily: Fonts.body, fontSize: 36, lineHeight: 46, color: '#9DB88B' },
  factValue: { fontFamily: Fonts.bodyBold, fontSize: 36, lineHeight: 46, color: '#E7F1E0', flexShrink: 1, textAlign: 'right' },

  spines: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150, marginTop: 50, marginHorizontal: -72 },

  flexCell: { flex: 1, minWidth: 0 },
  cell: { width: '100%', height: '100%' },
  jacket: { padding: '9%', justifyContent: 'flex-start', overflow: 'hidden' },
  jacketCentred: { justifyContent: 'center', alignItems: 'center' },
  jacketBottom: { justifyContent: 'flex-end' },
  centredText: { textAlign: 'center' },
  jacketTitle: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 37 },
  jacketAuthor: { fontFamily: Fonts.bodySemiBold, fontSize: 20, lineHeight: 26, opacity: 0.8, marginTop: 14 },
  orb: { position: 'absolute', left: '-30%', top: '-26%', width: '120%', aspectRatio: 1, borderRadius: 9999, opacity: 0.12 },
  band: { position: 'absolute', left: 0, right: 0, top: 0, height: '46%', opacity: 0.15 }
});
