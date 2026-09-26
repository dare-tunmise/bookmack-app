import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors } from '@/constants/theme';

const MAX_STARS = 5;
const STAR_SIZE = 32;

type StarRatingProps = {
  // 0 means no rating.
  value: number;
  onChange: (value: number) => void;
  label: string;
};

// Five tappable stars. Tapping the current rating again clears it. Screen readers adjust it by
// swiping up or down.
export function StarRating({ value, onChange, label }: StarRatingProps) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: MAX_STARS, now: value, text: value ? `${value} of ${MAX_STARS} stars` : 'No rating' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onChange(Math.min(MAX_STARS, value + 1));
        if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - 1));
      }}
      style={styles.row}>
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const star = index + 1;
        const selected = star <= value;
        return (
          <Pressable
            key={star}
            importantForAccessibility="no"
            hitSlop={4}
            onPress={() => onChange(star === value ? 0 : star)}
            style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
            <Icon
              name="star"
              color={selected ? Colors.brand : Colors.border}
              fill={selected ? Colors.brand : 'none'}
              size={STAR_SIZE}
              strokeWidth={1.5}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4
  },
  star: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    transform: [{ scale: 0.9 }]
  }
});
