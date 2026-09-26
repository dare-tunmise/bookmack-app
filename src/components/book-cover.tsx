import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const PRESET_WIDTHS = { small: 48, large: 120 } as const;
const ASPECT_RATIO = 1.5;
// Placeholders at least this wide show the title; narrower ones show its first letter.
const MIN_WIDTH_FOR_TITLE = 72;

// Books without a cover image get a typographic cover in one of the brand color pairs. The pair is
// picked from the title, so a book always gets the same one.
const PLACEHOLDER_COLORS = [
  { backgroundColor: Colors.buttonPrimary, color: Colors.accent },
  { backgroundColor: Colors.brand, color: Colors.textOnDark },
  { backgroundColor: Colors.brandTint, color: Colors.text }
] as const;

const placeholderColors = (title: string) => {
  let sum = 0;
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  return PLACEHOLDER_COLORS[sum % PLACEHOLDER_COLORS.length];
};

type BookCoverProps = {
  title: string;
  thumbnail: string | null;
  // A preset, or an exact width in points (height follows a 2:3 cover shape).
  size?: keyof typeof PRESET_WIDTHS | number;
};

export function BookCover({ title, thumbnail, size = 'small' }: BookCoverProps) {
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

  const { backgroundColor, color } = placeholderColors(title);
  const showTitle = width >= MIN_WIDTH_FOR_TITLE;

  return (
    <View style={[styles.cover, styles.placeholder, dimensions, { backgroundColor }]}>
      {showTitle ? (
        <ThemedText numberOfLines={5} style={[styles.title, { color }]}>
          {title}
        </ThemedText>
      ) : (
        <ThemedText
          style={[styles.letter, { color, fontSize: Math.round(width * 0.45), lineHeight: Math.round(width * 0.6) }]}>
          {title.charAt(0).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: Radius.cover
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'center'
  },
  letter: {
    fontFamily: Fonts.display
  }
});
