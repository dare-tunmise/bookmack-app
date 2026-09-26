import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';

const FIELD_HEIGHT = 52;
const PADDING = Spacing.three;
const TOGGLE_WIDTH = 52;

// The label rests inside the field like a placeholder and floats up onto the top border while the
// field is focused or has a value. Only transform, opacity, and color animate (on the UI thread),
// so nothing re-lays out mid-animation.
const LABEL_LINE_HEIGHT = 20;
const LABEL_TOP = (FIELD_HEIGHT - LABEL_LINE_HEIGHT) / 2;
// Moves the label's center onto the top border.
const FLOATING_OFFSET = -(LABEL_TOP + LABEL_LINE_HEIGHT / 2);
// 16px label → about 13px when floating.
const FLOATING_SCALE = 0.8;
const ANIMATION_MS = 180;
// Space on each side of the floating label where the border is hidden.
const NOTCH_PADDING = 4;
// The border is drawn inside the field's top edge (0–2px down), so the notch must reach further
// below the label's center than above it. Scaled with the label, it covers about −1.6px to 4.8px:
// all of the border, with nothing visible above it.
const NOTCH_ABOVE_CENTER = 2;
const NOTCH_HEIGHT = 8;

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  // Shown instead of the hint, with a red border.
  error?: string | null;
};

// Outlined input with a floating label: 1px border, 2px brand border while focused, red on error,
// muted when not editable. Password fields (secureTextEntry) get an eye button to show or hide the text.
export function TextField({
  label,
  hint,
  error,
  style,
  secureTextEntry,
  editable,
  placeholder,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [labelWidth, setLabelWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  const disabled = editable === false;
  const floating = focused || Boolean(inputProps.value ?? inputProps.defaultValue);

  const lift = useSharedValue(floating ? 1 : 0);
  const highlight = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const timing = { duration: reduceMotion ? 0 : ANIMATION_MS, easing: Easing.out(Easing.cubic) };
    lift.set(withTiming(floating ? 1 : 0, timing));
    highlight.set(withTiming(focused ? 1 : 0, timing));
  }, [floating, focused, reduceMotion, lift, highlight]);

  const restingLabelColor = disabled ? Colors.disabledText : error ? Colors.danger : Colors.textSecondary;
  const focusedLabelColor = disabled ? Colors.disabledText : error ? Colors.danger : Colors.brand;
  const borderColor = disabled ? Colors.disabledBorder : error ? Colors.danger : focused ? Colors.brand : Colors.border;
  const fieldColor = disabled ? Colors.disabledSurface : Colors.surface;

  const labelMotion = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.get(), [0, 1], [0, FLOATING_OFFSET]) },
      { scale: interpolate(lift.get(), [0, 1], [1, FLOATING_SCALE]) }
    ]
  }));

  const labelColor = useAnimatedStyle(() => ({
    color: interpolateColor(highlight.get(), [0, 1], [restingLabelColor, focusedLabelColor])
  }));

  // The notch only needs to hide the border once the label is close to it.
  const notchVisibility = useAnimatedStyle(() => ({
    opacity: interpolate(lift.get(), [0.5, 1], [0, 1], 'clamp')
  }));

  return (
    <View style={styles.field}>
      <View style={[styles.box, { backgroundColor: fieldColor }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ disabled }}
          placeholder={floating ? placeholder : undefined}
          placeholderTextColor={Colors.textSecondary}
          selectionColor={Colors.brand}
          cursorColor={Colors.brand}
          editable={editable}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            { paddingRight: secureTextEntry ? 0 : PADDING },
            disabled && styles.inputDisabled,
            style
          ]}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((current) => !current)}
            style={styles.toggle}>
            <Icon
              name={revealed ? 'eyeOff' : 'eye'}
              color={revealed ? Colors.brand : Colors.textSecondary}
              size={20}
            />
          </Pressable>
        ) : null}

        {/* Drawn over the field so a thicker focus border never shifts the text or label. */}
        <View pointerEvents="none" style={[styles.outline, { borderWidth: focused ? 2 : 1, borderColor }]} />

        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.label, { right: PADDING + (secureTextEntry ? TOGGLE_WIDTH : 0) }, labelMotion]}>
          <Animated.View
            style={[
              styles.notch,
              { width: labelWidth + NOTCH_PADDING * 2, backgroundColor: fieldColor },
              notchVisibility
            ]}
          />
          <Animated.Text
            numberOfLines={1}
            onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
            style={[styles.labelText, labelColor]}>
            {label}
          </Animated.Text>
        </Animated.View>
      </View>

      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <ThemedText style={[Typography.hint, styles.hint]}>{hint}</ThemedText>
      ) : null}
    </View>
  );
}

// A red error line with an icon, for under a field or a code input.
export function FieldError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorRow}>
      <Icon name="error" color={Colors.danger} size={14} />
      <ThemedText style={[Typography.hint, styles.errorText]}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: FIELD_HEIGHT,
    borderRadius: Radius.input
  },
  input: {
    flex: 1,
    minHeight: FIELD_HEIGHT,
    paddingLeft: PADDING,
    color: Colors.text,
    fontFamily: Fonts.body,
    fontSize: 16
  },
  inputDisabled: {
    color: Colors.disabledText
  },
  toggle: {
    width: TOGGLE_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center'
  },
  outline: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.input
  },
  label: {
    position: 'absolute',
    top: LABEL_TOP,
    left: PADDING - NOTCH_PADDING,
    paddingHorizontal: NOTCH_PADDING,
    alignItems: 'flex-start',
    // Scale from the left so the label stays aligned with the text.
    transformOrigin: 'left center'
  },
  notch: {
    position: 'absolute',
    left: 0,
    top: LABEL_LINE_HEIGHT / 2 - NOTCH_ABOVE_CENTER,
    height: NOTCH_HEIGHT
  },
  labelText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: LABEL_LINE_HEIGHT
  },
  hint: {
    color: Colors.textSecondary
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  errorText: {
    flexShrink: 1,
    color: Colors.danger
  }
});
