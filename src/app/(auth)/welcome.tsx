import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHELF_HEIGHT } from '@/components/auth-shelf';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

import { useShelfStep } from './shelf-step';

// The first screen, and the shelf above it does the explaining.
//
// This replaced three rows of icon-and-sentence. Add it, lend it, get it back is not a list of
// features — it is what the shelf is acting out a few inches higher, and these three words only
// label the part that is playing. The step comes from the shelf rather than from a timer here:
// two clocks would drift apart inside one cycle.
const STEPS = ['Add it', 'Lend it', 'Get it back'];

// Everything rises 55ms apart, which is the cadence the whole flow uses.
const STAGGER = 55;
export const rise = (index: number) => FadeInDown.delay(120 + index * STAGGER).springify().damping(16);

export default function WelcomeScreen() {
  const step = useShelfStep();

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <Animated.View entering={rise(0)} style={styles.brand}>
          <BrandMark size={34} />
          <ThemedText style={styles.wordmark}>BookMack</ThemedText>
        </Animated.View>

        {/* Clears the shelf, which the layout draws above this. */}
        <View style={{ height: SHELF_HEIGHT - 16 }} />

        <Animated.View entering={rise(5)} style={styles.steps}>
          {STEPS.map((label, index) => {
            const on = step === index;
            return (
              <View key={label} style={styles.step}>
                <ThemedText style={[styles.stepText, on && styles.stepTextOn]}>{label}</ThemedText>
                <View style={[styles.stepRule, on && styles.stepRuleOn]} />
              </View>
            );
          })}
        </Animated.View>

        <Animated.View entering={rise(6)}>
          <ThemedText style={styles.headline}>
            Your books, always <ThemedText style={styles.headlineAccent}>within reach.</ThemedText>
          </ThemedText>
        </Animated.View>

        <Animated.View entering={rise(7)}>
          <ThemedText style={styles.sub}>
            Add a book in seconds, lend it to a friend, and always know when it&apos;s coming home.
          </ThemedText>
        </Animated.View>

        <View style={styles.grow} />

        <Animated.View entering={rise(8)} style={styles.actions}>
          <Button title="Create account" onPress={() => router.push('/sign-up')} />
          <Button title="Log in" variant="secondary" onPress={() => router.push('/sign-in')} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 30
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 48
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 21,
    letterSpacing: -0.3,
    color: Colors.text
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: Spacing.four
  },
  step: {
    alignItems: 'center',
    gap: 7
  },
  stepText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.disabledText
  },
  stepTextOn: {
    color: Colors.text
  },
  // The lime rule sits only under the part that is playing: it is the shelf's caption, so it says
  // one thing at a time rather than labelling all three at once.
  stepRule: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'transparent'
  },
  stepRuleOn: {
    backgroundColor: Colors.accent
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.3,
    color: Colors.text,
    marginTop: Spacing.five
  },
  headlineAccent: {
    fontFamily: Fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.3,
    color: Colors.brand
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: Spacing.three,
    maxWidth: 320
  },
  grow: {
    flex: 1
  },
  actions: {
    gap: 12
  }
});
