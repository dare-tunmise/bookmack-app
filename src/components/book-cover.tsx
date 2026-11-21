import { Image } from 'expo-image';
import { StyleSheet, View, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { jacketFor } from '@/lib/jacket';

const PRESET_WIDTHS = { small: 48, large: 120 } as const;
const ASPECT_RATIO = 1.5;

// Below this a jacket shows its initial instead of its title. The web shelf never draws one
// smaller than about 66pt; here the stats list, the genre sheet and the reading sheet ask for
// 30–40pt, where a 9pt title over four lines is a smudge and the cover is read as colour.
const MIN_WIDTH_FOR_TYPE = 56;

const clamp = (min: number, value: number, max: number) => Math.min(Math.max(value, min), max);

// The jacket's parts are declared out here rather than inside BookCover. Components defined
// during a render are new on every one, which defeats the React Compiler this project builds
// with — and `react-hooks/static-components` fails the lint for it.
function Title({ text, style }: { text: string; style: TextStyle }) {
  return (
    <ThemedText numberOfLines={4} style={style}>
      {text}
    </ThemedText>
  );
}

// Four of the six layouts give the author its own place. Without one, nothing is drawn and the
// layout closes up rather than leaving a gap where a name would have been.
function Author({ text, style }: { text?: string | null; style: TextStyle }) {
  if (!text) return null;
  return (
    <ThemedText numberOfLines={1} style={style}>
      {text}
    </ThemedText>
  );
}

function Rule({ color, gap }: { color: string; gap: number }) {
  return <View style={[styles.rule, { marginVertical: gap, backgroundColor: color }]} />;
}

// Books without a cover image get a designed jacket rather than a tinted box: a colour pair and
// one of six layouts, both from the title, so a book wears the same jacket wherever it appears —
// here, on a poster, on its spine in the year shelf, and on the shelf shared on the web.
//
// The proportions are the web shelf's, which sizes its type as a percentage of the cover's own
// width through container queries. There is no such thing here, but the width is known in points,
// so the same percentages are arithmetic instead.
type BookCoverProps = {
  title: string;
  thumbnail: string | null;
  // Optional because a candidate from a barcode scan may not have one yet.
  author?: string | null;
  // A preset, or an exact width in points (height follows a 2:3 cover shape).
  size?: keyof typeof PRESET_WIDTHS | number;
};

export function BookCover({ title, thumbnail, author, size = 'small' }: BookCoverProps) {
  const width = typeof size === 'number' ? size : PRESET_WIDTHS[size];
  const dimensions = { width, height: Math.round(width * ASPECT_RATIO) };

  if (thumbnail) {
    return (
      <Image
        source={thumbnail}
        style={[styles.cover, dimensions]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  const { bg, fg, layout } = jacketFor(title);
  const pad = Math.round(width * 0.09);

  if (width < MIN_WIDTH_FOR_TYPE) {
    return (
      <View style={[styles.cover, styles.centred, dimensions, { backgroundColor: bg }]}>
        <ThemedText
          style={{
            fontFamily: Fonts.display,
            color: fg,
            fontSize: Math.round(width * 0.45),
            lineHeight: Math.round(width * 0.6)
          }}>
          {(title.trim().charAt(0) || '?').toUpperCase()}
        </ThemedText>
      </View>
    );
  }

  const titleSize = clamp(9, width * 0.11, 15);
  const authorSize = clamp(7, width * 0.07, 10);

  const titleStyle: TextStyle = {
    fontFamily: Fonts.display,
    color: fg,
    fontSize: titleSize,
    lineHeight: titleSize * 1.08,
    letterSpacing: titleSize * -0.01
  };
  const authorStyle: TextStyle = {
    fontFamily: Fonts.bodySemiBold,
    color: fg,
    fontSize: authorSize,
    lineHeight: authorSize * 1.3,
    letterSpacing: authorSize * 0.02,
    opacity: 0.8
  };
  const centredText: TextStyle = { textAlign: 'center' };

  const base = [styles.cover, styles.jacket, dimensions, { backgroundColor: bg, padding: pad }];

  if (layout === 1) {
    return (
      <View style={base}>
        <Title text={title} style={titleStyle} />
        <Rule color={fg} gap={Math.round(width * 0.07)} />
        <Author text={author} style={{ ...authorStyle, marginTop: 'auto' }} />
      </View>
    );
  }

  if (layout === 2) {
    return (
      <View style={[...base, styles.centred]}>
        <View style={[styles.corner, { backgroundColor: fg }]} />
        <Title
          text={title}
          style={{
            ...titleStyle,
            ...centredText,
            fontFamily: Fonts.heading,
            textTransform: 'uppercase',
            letterSpacing: titleSize * 0.06
          }}
        />
        <Author text={author} style={{ ...authorStyle, ...centredText, marginTop: width * 0.09 }} />
      </View>
    );
  }

  if (layout === 3) {
    return (
      <View style={[...base, styles.bottom]}>
        <View style={[styles.band, { backgroundColor: fg }]} />
        <Title text={title} style={titleStyle} />
        <Author text={author} style={{ ...authorStyle, marginTop: width * 0.06 }} />
      </View>
    );
  }

  if (layout === 4) {
    return (
      <View style={[...base, styles.bottom]}>
        <View style={[styles.orb, { backgroundColor: fg }]} />
        <Title text={title} style={titleStyle} />
        <Rule color={fg} gap={Math.round(width * 0.07)} />
        <Author text={author} style={authorStyle} />
      </View>
    );
  }

  if (layout === 5) {
    const big = clamp(11, width * 0.13, 18);
    return (
      <View style={[...base, styles.centred]}>
        <Title text={title} style={{ ...titleStyle, ...centredText, fontSize: big, lineHeight: big * 1.02 }} />
        <Author text={author} style={{ ...authorStyle, ...centredText, marginTop: width * 0.11 }} />
      </View>
    );
  }

  // Layout 6 frames the type in a rule of its own colour, inside the cover's own margin — the box
  // needs air of its own, or it reads as a border drawn on the cover rather than a frame on it.
  return (
    <View style={[...base, styles.centred]}>
      <View style={[styles.frame, { borderColor: fg, padding: pad, gap: Math.round(width * 0.09) }]}>
        <Title text={title} style={{ ...titleStyle, ...centredText }} />
        <Author text={author} style={{ ...authorStyle, ...centredText }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: Radius.cover,
    overflow: 'hidden'
  },
  jacket: {
    justifyContent: 'flex-start'
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottom: {
    justifyContent: 'flex-end'
  },
  rule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.6
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  corner: {
    position: 'absolute',
    right: '-14%',
    top: '12%',
    width: '62%',
    aspectRatio: 1,
    borderRadius: 9999,
    opacity: 0.17
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '46%',
    opacity: 0.16
  },
  orb: {
    position: 'absolute',
    left: '-30%',
    top: '-26%',
    width: '120%',
    aspectRatio: 1,
    borderRadius: 9999,
    opacity: 0.12
  }
});
