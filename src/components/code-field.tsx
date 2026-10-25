import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

// Six boxes drawn over one hidden input.
//
// One input, not six: paste works, SMS autofill works, and the backspace-between-boxes dance that
// six separate fields always gets wrong simply does not exist. The boxes are decoration over a
// field that behaves like any other.

const LENGTH = 6;
const SPRING = { damping: 14, stiffness: 180 } as const;
const RIPPLE_STAGGER = 60;

type CodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  // Called once the sixth digit lands, so the caller never has to watch the length itself.
  onComplete: (value: string) => void;
  error?: boolean;
  // Lime ripple across the boxes, left to right, once the code is accepted.
  accepted?: boolean;
  autoFocus?: boolean;
};

export function CodeField({ value, onChange, onComplete, error = false, accepted = false, autoFocus }: CodeFieldProps) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error || reduced) return;
    shake.value = withSequence(
      withTiming(-1, { duration: 70 }),
      withTiming(1, { duration: 70 }),
      withTiming(0, { duration: 70 })
    );
  }, [error, reduced, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value * 8 }] }));

  const take = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH) onComplete(digits);
  };

  return (
    <Animated.View style={shakeStyle}>
      <Pressable
        accessibilityRole="none"
        onPress={() => input.current?.focus()}
        style={styles.row}>
        {Array.from({ length: LENGTH }, (_, index) => (
          <Box
            key={index}
            index={index}
            digit={value[index]}
            current={focused && index === value.length}
            error={error}
            accepted={accepted}
            reduced={reduced}
          />
        ))}
      </Pressable>

      {/* Invisible, on top, and the only thing the keyboard talks to. */}
      <TextInput
        ref={input}
        value={value}
        onChangeText={take}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={LENGTH}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="6-digit code"
        caretHidden
        style={styles.input}
      />
    </Animated.View>
  );
}

function Box({
  index,
  digit,
  current,
  error,
  accepted,
  reduced
}: {
  index: number;
  digit?: string;
  current: boolean;
  error: boolean;
  accepted: boolean;
  reduced: boolean;
}) {
  const pop = useSharedValue(0);
  const win = useSharedValue(0);

  // A small pop as each digit lands, so typing has a pulse to it.
  useEffect(() => {
    if (!digit || reduced) return;
    pop.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, SPRING));
  }, [digit, reduced, pop]);

  // The ripple: each box lifts in turn, left to right.
  useEffect(() => {
    if (reduced) {
      win.value = accepted ? 1 : 0;
      return;
    }
    win.value = accepted
      ? withDelay(index * RIPPLE_STAGGER, withSequence(withSpring(1, SPRING), withDelay(120, withSpring(0.999, SPRING))))
      : withTiming(0, { duration: 150 });
  }, [accepted, index, reduced, win]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pop.value * 0.12 }, { translateY: win.value * -8 }]
  }));

  return (
    <Animated.View
      style={[
        styles.box,
        current && styles.boxCurrent,
        error && styles.boxError,
        accepted && styles.boxAccepted,
        style
      ]}>
      <ThemedText style={[styles.digit, error && styles.digitError]}>{digit ?? ''}</ThemedText>
      {current && !digit ? <View style={styles.caret} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 9
  },
  input: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
    // Transparent rather than removed: a zero-size input is not reliably focusable on Android.
    color: 'transparent'
  },
  box: {
    flex: 1,
    height: 64,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  boxCurrent: {
    borderColor: Colors.brand
  },
  boxError: {
    borderColor: Colors.danger
  },
  boxAccepted: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  digit: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.text
  },
  digitError: {
    color: Colors.danger
  },
  caret: {
    position: 'absolute',
    width: 2.5,
    height: 28,
    borderRadius: 2,
    backgroundColor: Colors.brand
  }
});
