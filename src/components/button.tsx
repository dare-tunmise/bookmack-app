import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

// Use at most one primary button per screen; everything else is secondary.
const VARIANTS = {
  primary: { backgroundColor: Colors.buttonPrimary, color: Colors.textOnDark },
  secondary: { backgroundColor: Colors.brandTint, color: Colors.text },
  // For destructive actions such as deleting.
  danger: { backgroundColor: Colors.danger, color: Colors.textOnDark },
  // A softer destructive action, e.g. signing out other devices.
  dangerSecondary: { backgroundColor: Colors.dangerTint, color: Colors.danger }
};

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  loading?: boolean;
  variant?: keyof typeof VARIANTS;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, loading = false, variant = 'primary', disabled, style, ...rest }: ButtonProps) {
  const { backgroundColor, color } = VARIANTS[variant];
  const inactive = Boolean(disabled) || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.pressed,
        inactive && styles.inactive,
        style
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="button" style={{ color }} numberOfLines={1}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    opacity: 0.85
  },
  inactive: {
    opacity: 0.5
  }
});
