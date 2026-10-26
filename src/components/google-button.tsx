import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

// Google's mark, in its four colours.
//
// It is not in `icon.tsx` and should not be: everything there takes a colour from the design
// system and obeys it, and this one must not — Google's terms are specific that the mark keeps its
// own colours, is not recoloured to match a theme, and is not redrawn. It is a logo that happens
// to be icon-sized, so it lives with the button that is allowed to show it.
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

type GoogleButtonProps = {
  // "Continue with Google" on both screens: it is one button that signs in or signs up depending
  // on whether the address is already known here, and saying "sign up" on one of them would be a
  // promise the server does not keep.
  label?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Google's own guidance: its mark, its colours, a neutral surface, and a visible border so the
// button still reads as a button on white. Same height and radius as `Button`, so a column of
// actions keeps one silhouette.
export function GoogleButton({
  label = 'Continue with Google',
  onPress,
  loading = false,
  disabled = false,
  style
}: GoogleButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, inactive && styles.inactive, style]}>
      {loading ? (
        <ActivityIndicator color={Colors.text} />
      ) : (
        <View style={styles.row}>
          <GoogleMark />
          <ThemedText style={styles.label} numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

// A rule either side of "or use your email", between the Google button and the form. The air
// around it comes from AuthScreen's row gap — a hairline needs more room than a field, and with
// none at all it sat flush against the button above and the first field below.
export function AuthDivider({ label = 'or use your email' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <ThemedText style={styles.dividerLabel}>{label}</ThemedText>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text
  },
  pressed: {
    opacity: 0.85
  },
  inactive: {
    opacity: 0.5
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border
  },
  dividerLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary
  }
});
