import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type Option<K extends string> = { key: K; label: string };

type SegmentedControlProps<K extends string> = {
  options: readonly Option<K>[];
  // null selects nothing, e.g. when a custom date was picked instead of a preset.
  value: K | null;
  onChange: (key: K) => void;
  accessibilityLabel: string;
};

const HEIGHT = 52;
const BORDER = 1;
const PADDING = 4;
const ANIMATION_MS = 220;

// Choose one option from a few, in one bordered pill. The selected option has a deep green fill that
// slides between options (transform only, on the UI thread).
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel
}: SegmentedControlProps<K>) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const selectedIndex = options.findIndex((option) => option.key === value);
  const segmentWidth = width > 0 ? (width - (BORDER + PADDING) * 2) / options.length : 0;

  const position = useSharedValue(Math.max(selectedIndex, 0));
  const visibility = useSharedValue(selectedIndex >= 0 ? 1 : 0);

  useEffect(() => {
    const timing = { duration: reduceMotion ? 0 : ANIMATION_MS, easing: Easing.out(Easing.cubic) };
    if (selectedIndex >= 0) {
      // Appearing from "nothing selected" starts at the new option instead of sliding across.
      position.set(visibility.get() === 0 ? selectedIndex : withTiming(selectedIndex, timing));
    }
    visibility.set(withTiming(selectedIndex >= 0 ? 1 : 0, timing));
  }, [selectedIndex, reduceMotion, position, visibility]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: visibility.get(),
    transform: [{ translateX: position.get() * segmentWidth }]
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}>
      {segmentWidth > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} />
      ) : null}
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(option.key)}
            style={styles.segment}>
            <ThemedText numberOfLines={1} style={[styles.label, { color: selected ? Colors.textOnDark : Colors.text }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: HEIGHT,
    padding: PADDING,
    borderWidth: BORDER,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Radius.pill,
    backgroundColor: Colors.buttonPrimary
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: Radius.pill
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20
  }
});
