import { Fragment } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

export type GroupAction = {
  label: string;
  onPress: () => void;
  // Label color: brand green for the main action, red for destructive ones.
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
};

const TONE_COLORS = {
  default: Colors.text,
  primary: Colors.brand,
  danger: Colors.danger
};

// Side-by-side actions in one bordered pill, matching SegmentedControl. Unlike a segmented control
// nothing stays selected: these are actions, so a segment only highlights while pressed.
export function ButtonGroup({ actions }: { actions: GroupAction[] }) {
  return (
    <View style={styles.container}>
      {actions.map((action, index) => {
        const color = TONE_COLORS[action.tone ?? 'default'];
        const inactive = Boolean(action.disabled || action.loading);
        return (
          <Fragment key={action.label}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: inactive, busy: Boolean(action.loading) }}
              disabled={inactive}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.segment,
                pressed && styles.pressed,
                action.disabled && !action.loading && styles.disabled
              ]}>
              {action.loading ? (
                <ActivityIndicator color={color} />
              ) : (
                <ThemedText numberOfLines={1} style={[styles.label, { color }]}>
                  {action.label}
                </ThemedText>
              )}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 52,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  pressed: {
    backgroundColor: Colors.brandTint
  },
  disabled: {
    opacity: 0.45
  },
  divider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: Colors.border
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20
  }
});
