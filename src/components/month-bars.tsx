import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

// The twelve months as one control. Touching a month is how you see what you finished in it, so
// the chart is the navigation rather than a picture to look at.
//
// Exact values from the design: 98pt tall, 6pt between bars, a bar 72pt at the fullest month and
// never less than 10pt when it has anything in it, 4pt when it has nothing, and 8pt as an outline
// for a month that has not happened.
const CHART_HEIGHT = 98;
const BAR_GAP = 6;
const BAR_MAX = 72;
const BAR_MIN = 10;
const BAR_NONE = 4;
const BAR_FUTURE = 8;
const MONTHS = 12;

// The design's own greys. Neither is in the palette: the idle bar sits between `border` and
// `skeleton`, and the outline is a shade darker so an empty future month still reads as a month.
const IDLE = '#E1E7DC';
const FUTURE_LINE = '#D3DACD';
const FAINT = '#97A391';

const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type BarProps = { height: number; selected: boolean; future: boolean; letter: string };

function Bar({ height, selected, future, letter }: BarProps) {
  const grown = useSharedValue(height);

  // Springs rather than a linear tween, so a year change lands with some weight instead of
  // sliding. Writing a shared value is not setState, so this is not the effect lint rule.
  useEffect(() => {
    grown.value = withSpring(height, { damping: 20, stiffness: 170, mass: 0.6 });
  }, [height, grown]);

  const animated = useAnimatedStyle(() => ({ height: grown.value }));

  return (
    <View style={styles.bar}>
      <Animated.View
        style={[
          styles.fill,
          animated,
          future ? styles.fillFuture : selected ? styles.fillOn : null
        ]}
      />
      <ThemedText style={[styles.letter, selected && styles.letterOn]}>{letter}</ThemedText>
    </View>
  );
}

type MonthBarsProps = {
  // Books finished in each month of the year being looked at, January first.
  counts: number[];
  selected: number;
  // The last month that has happened. Later ones are drawn as outlines and cannot be chosen.
  lastMonth: number;
  onSelect: (month: number) => void;
};

export function MonthBars({ counts, selected, lastMonth, onSelect }: MonthBarsProps) {
  const width = useSharedValue(0);
  const most = Math.max(...counts, 1);

  // One gesture for the whole strip, as the design asks. The index is the finger's position
  // across the width rather than which bar was hit, which is what makes a drag continuous
  // instead of twelve separate taps.
  const pick = (x: number) => {
    'worklet';
    if (width.value <= 0) return;
    const index = Math.floor((x / width.value) * MONTHS);
    const clamped = Math.max(0, Math.min(lastMonth, index));
    if (clamped !== selected) {
      runOnJS(onSelect)(clamped);
      runOnJS(Haptics.selectionAsync)();
    }
  };

  // Pan has to give way vertically or the strip would swallow the page's own scrolling, which is
  // why a plain tap needs its own gesture: without it nothing would happen until you moved 8pt.
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin((event) => pick(event.x))
    .onUpdate((event) => pick(event.x));

  const tap = Gesture.Tap().onEnd((event) => pick(event.x));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={styles.bars}
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
        }}>
        {LETTERS.map((letter, month) => {
          const count = counts[month] ?? 0;
          const future = month > lastMonth;
          const height = future
            ? BAR_FUTURE
            : count
              ? Math.max(BAR_MIN, (count / most) * BAR_MAX)
              : BAR_NONE;

          return (
            <Bar
              key={month}
              height={height}
              selected={month === selected}
              future={future}
              letter={letter}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    gap: BAR_GAP,
    height: CHART_HEIGHT,
    marginTop: 14
  },
  bar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8
  },
  fill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: IDLE
  },
  fillOn: {
    backgroundColor: Colors.text
  },
  fillFuture: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: FUTURE_LINE
  },
  letter: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 12,
    color: FAINT
  },
  letterOn: {
    fontFamily: Fonts.bodyBold,
    color: Colors.text
  }
});
