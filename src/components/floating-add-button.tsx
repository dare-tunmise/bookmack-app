import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors, Shadows, Spacing } from '@/constants/theme';

export const FLOATING_BUTTON_SIZE = 60;

type FloatingAddButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  accessibilityLabel: string;
};

// Round "+" button pinned to the bottom-right corner of a screen.
//
// Deliberately no safe-area inset. Every screen using this sits inside the drawer navigator,
// which now ends above the bottom bar, and the bar is what clears the system navigation buttons.
// Adding the inset here would lift the button by that height a second time, leaving a gap.
export function FloatingAddButton(props: FloatingAddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      {...props}>
      <Icon name="plus" color={Colors.accent} size={28} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: Spacing.four,
    right: Spacing.four,
    width: FLOATING_BUTTON_SIZE,
    height: FLOATING_BUTTON_SIZE,
    borderRadius: FLOATING_BUTTON_SIZE / 2,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }]
  }
});
