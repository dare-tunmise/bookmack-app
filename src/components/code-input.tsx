import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  // Called when every box is filled.
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
};

// One box per digit, drawn over a single invisible input: typing moves to the next box, and pasting
// or autofilling a code fills them all.
export function CodeInput({ value, onChange, onComplete, length = 6, error = false, autoFocus = false }: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[styles.box, focused && index === activeIndex && styles.boxActive, error && styles.boxError]}>
          <ThemedText style={[styles.digit, error && styles.digitError]}>{value[index] ?? ''}</ThemedText>
        </View>
      ))}
      <TextInput
        value={value}
        onChangeText={(text) => {
          const code = text.replace(/\D/g, '').slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        maxLength={length}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10
  },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 60,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  boxActive: {
    borderWidth: 2,
    borderColor: Colors.brand
  },
  boxError: {
    borderWidth: 1.5,
    borderColor: Colors.danger
  },
  digit: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  digitError: {
    color: Colors.danger
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
    color: 'transparent'
  }
});
