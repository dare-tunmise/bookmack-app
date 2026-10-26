import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

// One shelf, mounted once above the whole signed-out stack, that travels between screens.
//
// On welcome it is the product acting itself out: a book arrives, one gets lent, it comes back.
// On a form it shrinks into the header and stays there, so five screens feel like one place
// rather than five pages. It is never unmounted between routes — that continuity is the entire
// point, and it is why this lives in the layout rather than in any screen.
//
// Plain Views, no Lottie and no video: it stays sharp at any size, weighs nothing, and the spines
// can become the reader's own books once they have added some.

export const SHELF_WIDTH = 320;
export const SHELF_HEIGHT = 200;

// Where the shelf sits in each of its two states, as given in the design.
const HERO = { x: 46, y: 124, scale: 1 };
const COMPACT = { x: 160, y: 42, scale: 0.32 };

// How far down the screen the parked shelf reaches, measured from the top of the safe area.
// AuthScreen uses it to start its heading below the shelf: the two were set by hand before, and
// drifted 2px into each other — the ledge sat on top of "Welcome back".
export const SHELF_COMPACT_BOTTOM = COMPACT.y + SHELF_HEIGHT * COMPACT.scale;

// No `easing` key at all. Reanimated merges this over its own defaults, so spelling it out as
// `easing: undefined` replaced the default easing function with undefined and the UI thread then
// called undefined(progress) on every frame — the screen went white, and Android took the app
// down with it. That was the blank screen on Create account.
const GLIDE = { duration: 700 } as const;
const SPRING = { damping: 14, stiffness: 170 } as const;

// width, height, spine, text, title
const SPINES: [number, number, string, string, string][] = [
  [26, 150, '#B8831C', '#2A1A08', 'Things Fall Apart'],
  [34, 168, '#A33B2A', '#F6E7D8', 'Americanah'],
  [22, 138, '#141414', '#E0B55C', 'Dune'],
  [30, 158, '#0F2E25', '#D9F58C', 'Half of a Yellow Sun'],
  [20, 130, '#E3D5B8', '#2F3E2F', 'Possession'],
  [38, 176, '#3E4C59', '#FFFFFF', 'A Suitable Boy'],
  [24, 146, '#4A5A32', '#F2EEDC', 'Birdsong'],
  [28, 154, '#15616D', '#FFFFFF', 'The Famished Road'],
  [21, 136, '#6B1414', '#F5E9DD', 'Alias Grace']
];
const NEW_BOOK: [number, number, string, string, string] = [27, 152, '#9FE870', '#163300', 'Your next one'];

// The loop, in the order the design tells it. Seven seconds and a bit, then round again.
const LOOP = { arrive: 0, lend: 2400, back: 4800, clear: 6800, repeat: 7400 };

export type ShelfMode = 'hero' | 'compact';
export type ShelfStep = -1 | 0 | 1 | 2;

type AuthShelfProps = {
  mode: ShelfMode;
  // Runs the welcome loop. Off on the forms, where the shelf is just a mark in the header.
  animate?: boolean;
  // Called as the loop moves, so the welcome screen's Add it / Lend it / Get it back can follow.
  onStep?: (step: ShelfStep) => void;
  // A small hop from every spine, for the moment someone is actually signed in.
  cheer?: boolean;
};

export function AuthShelf({ mode, animate = false, onStep, cheer = false }: AuthShelfProps) {
  const reduced = useReducedMotion();

  const travel = useSharedValue(mode === 'hero' ? 0 : 1);
  // The newest book: 0 is above the shelf and invisible, 1 is standing in place.
  const arrived = useSharedValue(0);
  // The lent book: 0 at rest, 1 lifted out and tilted.
  const lent = useSharedValue(0);
  const chip = useSharedValue(0);
  const hop = useSharedValue(0);

  // In an effect, not in the render body: assigning to a shared value while rendering starts an
  // animation as a side effect of a render that may yet be thrown away.
  useEffect(() => {
    const to = mode === 'hero' ? 0 : 1;
    travel.value = reduced ? withTiming(to, { duration: 150 }) : withTiming(to, GLIDE);
  }, [mode, reduced, travel]);

  // The loop. Driven by one timeout chain rather than per-spine animations, so stopping it is
  // stopping one thing — a loop that keeps running behind a form is a loop that drains a battery
  // for nobody.
  useEffect(() => {
    if (!animate || reduced) {
      arrived.value = withTiming(animate ? 1 : 0, { duration: 150 });
      return undefined;
    }

    let timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

    const run = () => {
      onStep?.(0);
      arrived.value = withSpring(1, SPRING);

      at(LOOP.lend, () => {
        onStep?.(1);
        lent.value = withSpring(1, SPRING);
        chip.value = withSpring(1, SPRING);
      });
      at(LOOP.back, () => {
        onStep?.(2);
        lent.value = withSpring(0, SPRING);
        chip.value = withSequence(withTiming(0, { duration: 200 }), withDelay(120, withSpring(1, SPRING)));
      });
      at(LOOP.clear, () => {
        onStep?.(-1);
        chip.value = withTiming(0, { duration: 250 });
        arrived.value = withTiming(0, { duration: 350 });
      });
      at(LOOP.repeat, run);
    };

    const start = setTimeout(run, 900);
    return () => {
      clearTimeout(start);
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimation(arrived);
      cancelAnimation(lent);
      cancelAnimation(chip);
    };
  }, [animate, reduced, arrived, lent, chip, onStep]);

  useEffect(() => {
    if (!cheer || reduced) return;
    hop.value = withSequence(withSpring(1, SPRING), withDelay(180, withSpring(0, SPRING)));
  }, [cheer, reduced, hop]);

  const shelf = useAnimatedStyle(() => {
    const t = travel.value;
    return {
      transform: [
        { translateX: HERO.x + (COMPACT.x - HERO.x) * t },
        { translateY: HERO.y + (COMPACT.y - HERO.y) * t },
        { scale: HERO.scale + (COMPACT.scale - HERO.scale) * t }
      ]
    };
  });

  const newBook = useAnimatedStyle(() => ({
    opacity: arrived.value,
    transform: [{ translateY: (1 - arrived.value) * -90 }]
  }));

  const lentBook = useAnimatedStyle(() => ({
    transform: [
      { translateX: lent.value * 16 },
      { translateY: lent.value * -64 },
      { rotate: `${lent.value * 8}deg` }
    ]
  }));

  const chipStyle = useAnimatedStyle(() => ({
    // Hidden entirely once the shelf is a header mark — a caption on a 32% shelf is illegible.
    opacity: chip.value * (1 - travel.value),
    transform: [{ translateY: (1 - chip.value) * 8 }, { scale: 0.94 + chip.value * 0.06 }]
  }));

  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value * -16 }] }));

  return (
    <Animated.View pointerEvents="none" style={[styles.shelf, shelf]}>
      <Animated.View style={[styles.books, hopStyle]}>
        {SPINES.map((spine, index) => (
          <Animated.View
            key={spine[4]}
            style={[
              styles.spine,
              { width: spine[0], height: spine[1], backgroundColor: spine[2] },
              index === 1 ? lentBook : undefined
            ]}>
            <View style={[styles.band, { backgroundColor: spine[3] }]} />
            <ThemedText numberOfLines={1} style={[styles.title, { color: spine[3], width: spine[1] - 18 }]}>
              {spine[4]}
            </ThemedText>
          </Animated.View>
        ))}

        <Animated.View
          style={[
            styles.spine,
            { width: NEW_BOOK[0], height: NEW_BOOK[1], backgroundColor: NEW_BOOK[2] },
            newBook
          ]}>
          <View style={[styles.band, { backgroundColor: NEW_BOOK[3] }]} />
          <ThemedText numberOfLines={1} style={[styles.title, { color: NEW_BOOK[3], width: NEW_BOOK[1] - 18 }]}>
            {NEW_BOOK[4]}
          </ThemedText>
        </Animated.View>
      </Animated.View>

      <View style={styles.ledge} />

      <Animated.View style={[styles.chip, chipStyle]}>
        <ChipContents lent={lent} />
      </Animated.View>
    </Animated.View>
  );
}

// Which caption the chip carries is decided by whether the book is out, so the two never
// disagree with the spine behind them.
function ChipContents({ lent }: { lent: { value: number } }) {
  const out = useAnimatedStyle(() => ({ opacity: lent.value }));
  const home = useAnimatedStyle(() => ({ opacity: 1 - lent.value }));

  return (
    <>
      <Animated.View style={[styles.chipRow, out]}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>CO</ThemedText>
        </View>
        <ThemedText style={styles.chipText}>Lent to Chidi · back 12 Nov</ThemedText>
      </Animated.View>
      <Animated.View style={[styles.chipRow, styles.chipOverlay, home]}>
        <View style={[styles.avatar, styles.avatarTick]}>
          <ThemedText style={styles.avatarText}>✓</ThemedText>
        </View>
        <ThemedText style={styles.chipText}>Back on the shelf</ThemedText>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  shelf: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SHELF_WIDTH,
    height: SHELF_HEIGHT,
    transformOrigin: 'top left',
    zIndex: 2
  },
  books: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    height: 186,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2
  },
  spine: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '8%',
    height: 2,
    opacity: 0.32
  },
  // Rotated rather than set vertically: React Native has no writing-mode, and a rotated line is
  // what a spine actually reads like.
  title: {
    fontFamily: Fonts.heading,
    fontSize: 11,
    transform: [{ rotate: '90deg' }]
  },
  ledge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#3F7A26'
  },
  chip: {
    position: 'absolute',
    right: -6,
    top: -8,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: Colors.text,
    paddingLeft: 6,
    paddingRight: 13,
    paddingVertical: 6,
    justifyContent: 'center'
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  chipOverlay: {
    position: 'absolute',
    left: 0,
    right: 0
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarTick: {
    backgroundColor: Colors.accent
  },
  avatarText: {
    color: Colors.text,
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5
  },
  chipText: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5
  }
});
