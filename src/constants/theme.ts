import type { TextStyle, ViewStyle } from 'react-native';

// BookMack design system; the reasoning behind it is in docs/ui-design-prompt.md. Light theme only.

export const Colors = {
  // Text
  text: '#163300',
  textBody: '#1F2A1B',
  textSecondary: '#5E6B58',
  textOnDark: '#FFFFFF',
  // Surfaces
  background: '#F6F7F4',
  surface: '#FFFFFF',
  // Cards and inputs on the background, and rows while pressed or selected.
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#EEF7E8',
  // Brand
  brand: '#347821',
  brandTint: '#EEF7E8',
  // Highlights only: never use as text on a light background (contrast is about 1.3:1).
  accent: '#9FE870',
  buttonPrimary: '#163300',
  border: '#E2E6DE',
  danger: '#B3261E',
  dangerTint: '#FCEBE8',
  // Disabled inputs
  disabledSurface: '#F4F5F2',
  disabledText: '#9AA79A',
  disabledBorder: '#EAEBE7',
  // Loading placeholders
  skeleton: '#EAEDE6',
  // Dims the screen behind drawers, sheets, and dialogs.
  backdrop: 'rgba(22, 51, 0, 0.4)'
} as const;

export type ThemeColor = keyof typeof Colors;

// Loaded in src/app/_layout.tsx. Each weight is its own family: on Android, fontWeight doesn't
// select a weight of a custom font, so never combine these with fontWeight.
export const Fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold'
} as const;

export const Typography = {
  display: { fontFamily: Fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: Fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: Fonts.bodyBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 20 },
  // Hints and errors under form fields.
  hint: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: Fonts.bodyBold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  button: { fontFamily: Fonts.bodyBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 },
  caption: { fontFamily: Fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 }
} satisfies Record<string, TextStyle>;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64
} as const;

export const Radius = {
  cover: 6,
  input: 14,
  card: 20,
  sheet: 28,
  pill: 999
} as const;

export const Shadows = {
  cover: {
    shadowColor: Colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  floating: {
    shadowColor: Colors.text,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  sheet: {
    shadowColor: Colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12
  }
} satisfies Record<string, ViewStyle>;

// Chart colour and marks, from the design's own chart system. The app's palette is one green family,
// which is fine for buttons and badges and cannot tell six genres apart — these are the tokens that
// extend it, derived in OKLCH from the brand hue and checked for contrast and colour blindness rather
// than eyeballed.
export const Chart = {
  // IDENTITY colour, spent in exactly one place: genre. A genre keeps its hue everywhere it appears,
  // so filtering never repaints the survivors. Assigned in this fixed order and never cycled.
  genre: ['#227E00', '#1A5EC2', '#BB8800', '#812B8F', '#00919F'],
  // The tail is neutral by design. A seventh genre folds in here rather than getting a generated hue.
  genreOther: '#9AA79A',
  // SEQUENTIAL and ordinal: one hue, light to dark. Magnitude on the activity heatmap (pages that
  // day), order on the reading-state bar (unread → reading → read). Never used for identity.
  ramp: ['#EAEDE6', '#83C575', '#59A847', '#308B15', '#1A6700'],
  // 1px hairline, never dashed and never heavier than the data it sits behind.
  gridline: '#EDEFEA',
  // Type on the ink hero card.
  onInk: '#CFE8BC',
  onInkMuted: '#9DB48C'
} as const;

// Lime (#9FE870) is never a chart fill: it sits at 1.3:1 on white, so a lime bar on a white card is
// close to invisible. It stays what it is elsewhere — a highlight behind dark text.

export const MaxContentWidth = 800;
