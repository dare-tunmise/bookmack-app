import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { jacketFor } from '@/lib/jacket';

// A poster is laid out at its real pixel size — 1080 wide — and scaled down for the preview, so
// what is captured off screen is the same component the reader was just looking at.

export const POSTER_WIDTH = 1080;
export const POSTER_SIZES = { post: 1350, story: 1920 } as const;
export type PosterSize = keyof typeof POSTER_SIZES;
export type PosterLayout = 'grid' | 'mosaic';
export type PosterTheme = keyof typeof POSTER_THEMES;

export const POSTER_THEMES = {
  forest: { bg: '#163300', title: '#9FE870', sub: '#C3DDB1', quiet: '#9DB88B' },
  lime: { bg: '#9FE870', title: '#163300', sub: '#2C5612', quiet: '#2C5612' },
  mist: { bg: '#F4F6F1', title: '#163300', sub: '#56644F', quiet: '#56644F' },
  ink: { bg: '#101310', title: '#FFFFFF', sub: '#B3BDAD', quiet: '#8E998A' }
} as const;

export type PosterBook = {
  id: string;
  title: string;
  author: string;
  thumbnail: string | null;
};

// The collage fills the space left for it, always. It used to take its natural height and let the
// title block absorb whatever was left — which for ten books meant a 648px collage on a 1350px
// poster and half the thing empty green. Now the art area is a fixed size and the rows are sized
// to it, so the question is only which row count distorts the covers least.
//
// Cropping beats stretching: a cover cut a little still looks like a cover, a stretched one looks
// wrong. So a row shorter than its natural height scores on how much it crops, and a row taller
// than natural is penalised three times as hard.
const distortion = (rowHeight: number, natural: number) => {
  const ratio = rowHeight / natural;
  return ratio <= 1 ? 1 - ratio : (ratio - 1) * 3;
};

const COVER_RATIO = 1.5;

// The head's parts, named so the height below is arithmetic rather than a guess.
const BRAND_ROW = 44;
const TITLE_GAP = 40;
const SUBTITLE_GAP = 20;
const SUBTITLE_LINE = 46;

type Plan = { render: () => React.ReactNode };

// Rows that always fill. Pick the row count that brings each tile closest to a cover's shape,
// spread the books across those rows, and let every row span the full width — so the rectangle is
// complete whatever the number of books, and covers crop a little rather than leaving gaps.
function planGrid(books: PosterBook[], artHeight: number): Plan {
  const count = books.length;
  let best = { rows: 1, score: Infinity };

  for (let rows = 1; rows <= Math.min(count, 10); rows += 1) {
    const columns = Math.ceil(count / rows);
    const natural = (POSTER_WIDTH / columns) * COVER_RATIO;
    const score = distortion(artHeight / rows, natural);
    if (score < best.score) best = { rows, score };
  }

  const { rows } = best;
  const rowHeight = artHeight / rows;
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const lines: PosterBook[][] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const size = base + (row < extra ? 1 : 0);
    lines.push(books.slice(index, index + size));
    index += size;
  }

  return {
    render: () => (
      <View>
        {lines.map((line, row) => (
          <View key={row} style={{ flexDirection: 'row', height: rowHeight }}>
            {line.map((book) => (
              <View key={book.id} style={styles.cell}>
                <Cover book={book} />
              </View>
            ))}
          </View>
        ))}
      </View>
    )
  };
}

// Two-by-two features with the rest packed around them, and never a hole: a feature eats four
// cells, so books + three per feature has to divide by the column count exactly. Features sit in
// fixed slots and everything else flows in finish order.
function planMosaic(books: PosterBook[], artHeight: number): Plan {
  const count = books.length;
  const want = count >= 14 ? 3 : count >= 8 ? 2 : count >= 4 ? 1 : 0;
  let best: { columns: number; features: number; rows: number; slots: [number, number][]; score: number } | null = null;

  for (let columns = 2; columns <= 7; columns += 1) {
    for (let features = 0; features <= Math.min(3, Math.floor(count / 3)); features += 1) {
      // A feature eats four cells, so books plus three per feature has to divide by the column
      // count exactly. That is what keeps a hole out of the rectangle.
      if ((count + 3 * features) % columns) continue;
      const rows = (count + 3 * features) / columns;
      if (features > 0 && (columns < 3 || rows < 2)) continue;
      const slots = featureSlots(columns, rows, features);
      if (slots.length < features) continue;
      const natural = (POSTER_WIDTH / columns) * COVER_RATIO;
      const score = distortion(artHeight / rows, natural) + Math.abs(features - want) * 0.2 + (columns < 3 ? 0.4 : 0);
      if (!best || score < best.score) best = { columns, features, rows, slots, score };
    }
  }

  if (!best) return planGrid(books, artHeight);

  const { columns, features, rows, slots } = best;
  const cellWidth = POSTER_WIDTH / columns;
  const cellHeight = artHeight / rows;

  // React Native has no CSS grid, so the mosaic is placed absolutely on a grid worked out here.
  // Features claim their 2×2 block first; the rest fill the remaining cells in order.
  const taken = new Set<string>();
  const placed: { book: PosterBook; left: number; top: number; width: number; height: number }[] = [];

  slots.slice(0, features).forEach(([row, column], index) => {
    for (let r = row; r < row + 2; r += 1) for (let c = column; c < column + 2; c += 1) taken.add(`${r}:${c}`);
    placed.push({
      book: books[index],
      left: (column - 1) * cellWidth,
      top: (row - 1) * cellHeight,
      width: cellWidth * 2,
      height: cellHeight * 2
    });
  });

  let next = features;
  for (let row = 1; row <= rows && next < count; row += 1) {
    for (let column = 1; column <= columns && next < count; column += 1) {
      if (taken.has(`${row}:${column}`)) continue;
      placed.push({
        book: books[next],
        left: (column - 1) * cellWidth,
        top: (row - 1) * cellHeight,
        width: cellWidth,
        height: cellHeight
      });
      next += 1;
    }
  }

  return {
    render: () => (
      <View style={{ width: POSTER_WIDTH, height: artHeight }}>
        {placed.map((item) => (
          <View
            key={item.book.id}
            style={{ position: 'absolute', left: item.left, top: item.top, width: item.width, height: item.height }}>
            <Cover book={item.book} />
          </View>
        ))}
      </View>
    )
  };
}

function featureSlots(columns: number, rows: number, count: number): [number, number][] {
  const wanted: [number, number][] = [
    [1, 1],
    [3, columns - 1],
    [5, 1],
    [7, columns - 1]
  ];
  const out: [number, number][] = [];
  for (const [row, column] of wanted) {
    if (out.length >= count) break;
    if (row + 1 <= rows && column >= 1 && column + 1 <= columns) out.push([row, column]);
  }
  return out;
}

// Covers crop to their cell rather than letterboxing: a poster is a packed rectangle, and a strip
// of background between covers is the thing that makes it look assembled rather than printed.
function Cover({ book }: { book: PosterBook }) {
  if (book.thumbnail) {
    return <Image source={book.thumbnail} style={styles.fill} contentFit="cover" />;
  }

  const { bg, fg, layout } = jacketFor(book.title);
  const centred = layout === 2 || layout === 5;
  const bottom = layout === 3 || layout === 4;

  return (
    <View
      style={[
        styles.fill,
        styles.jacket,
        { backgroundColor: bg },
        centred && styles.jacketCentred,
        bottom && styles.jacketBottom
      ]}>
      {layout === 4 ? (
        <View style={[styles.orb, { backgroundColor: fg }]} />
      ) : layout === 3 ? (
        <View style={[styles.band, { backgroundColor: fg }]} />
      ) : null}
      <ThemedText
        numberOfLines={5}
        style={[styles.jacketTitle, { color: fg }, centred && styles.centredText]}>
        {book.title}
      </ThemedText>
      <ThemedText numberOfLines={1} style={[styles.jacketAuthor, { color: fg }, centred && styles.centredText]}>
        {book.author}
      </ThemedText>
    </View>
  );
}

type PosterProps = {
  books: PosterBook[];
  title: string;
  subtitle: string;
  handle: string;
  size: PosterSize;
  layout: PosterLayout;
  theme: PosterTheme;
};

export function Poster({ books, title, subtitle, handle, size, layout, theme }: PosterProps) {
  const palette = POSTER_THEMES[theme];
  const height = POSTER_SIZES[size];
  const story = size === 'story';

  // The title is sized to fit its own line, and the head is then sized to fit the title. Fixing
  // the head at a round number and hoping the words fit is what cropped "Dare's shelf" and then
  // pushed the line under it off the bottom — the art simply started where the text still was.
  const padTop = story ? 90 : 66;
  const padBottom = story ? 70 : 54;
  const inner = POSTER_WIDTH - 144;
  // Bricolage ExtraBold runs about 0.52em per character at this weight; the cap is the size we
  // would like, the division is the size that fits.
  const titleSize = Math.min(story ? 150 : 128, Math.floor(inner / Math.max(6, title.length * 0.52)));
  const titleLine = Math.ceil(titleSize * 1.05);
  const headHeight = padTop + BRAND_ROW + TITLE_GAP + titleLine + SUBTITLE_GAP + SUBTITLE_LINE + padBottom;

  const artHeight = height - headHeight;
  const plan = (layout === 'grid' ? planGrid : planMosaic)(books, artHeight);

  return (
    <View style={{ width: POSTER_WIDTH, height, backgroundColor: palette.bg, overflow: 'hidden' }}>
      <View style={[styles.head, { height: headHeight, paddingTop: padTop, paddingBottom: padBottom }]}>
        <View style={styles.headTop}>
          <View style={styles.mark}>
            <BrandMark size={44} />
            <ThemedText style={[styles.markText, { color: palette.title }]}>BookMack</ThemedText>
          </View>
          {/* The address is the loop: whoever sees this poster can reach the shelf it came from. */}
          <ThemedText style={[styles.handle, { color: palette.quiet }]}>{handle}</ThemedText>
        </View>

        <View>
          {/* lineHeight is not optional at this size. Without it React Native gives the text a
              line box smaller than the glyphs and crops the title top and bottom, which is
              exactly what it did. */}
          <ThemedText
            numberOfLines={1}
            style={[styles.title, { color: palette.title, fontSize: titleSize, lineHeight: titleLine }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: palette.sub }]}>{subtitle}</ThemedText>
        </View>
      </View>

      {/* Fixed height with the overflow clipped: rows are sized to fill it, and a cover crops a
          little rather than leaving a band of background. */}
      <View style={{ height: artHeight, overflow: 'hidden' }}>{plan.render()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 0
  },
  fill: {
    width: '100%',
    height: '100%'
  },
  jacket: {
    padding: '9%',
    justifyContent: 'flex-start',
    overflow: 'hidden'
  },
  jacketCentred: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  jacketBottom: {
    justifyContent: 'flex-end'
  },
  centredText: {
    textAlign: 'center'
  },
  jacketTitle: {
    fontFamily: Fonts.display,
    fontSize: 34,
    lineHeight: 37
  },
  jacketAuthor: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 20,
    opacity: 0.8,
    marginTop: 14
  },
  orb: {
    position: 'absolute',
    left: '-30%',
    top: '-26%',
    width: '120%',
    aspectRatio: 1,
    borderRadius: 9999,
    opacity: 0.12
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '46%',
    opacity: 0.15
  },
  head: {
    paddingHorizontal: 72,
    paddingTop: 66,
    paddingBottom: 54,
    justifyContent: 'space-between'
  },
  headTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  markText: {
    fontFamily: Fonts.display,
    fontSize: 31,
    letterSpacing: -0.5
  },
  handle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 27
  },
  title: {
    fontFamily: Fonts.display,
    letterSpacing: -4.5
  },
  subtitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 36,
    lineHeight: SUBTITLE_LINE,
    marginTop: SUBTITLE_GAP,
    letterSpacing: -0.2
  }
});
