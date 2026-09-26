import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

export type AppBarAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

type AppBarProps = {
  title?: string;
  left?: AppBarAction;
  right?: AppBarAction[];
  // Replaces the title, e.g. with a search input.
  children?: ReactNode;
};

// Top app bar from the navigation design: 64px tall, left-aligned title, 48px round icon buttons.
export function AppBar({ title, left, right = [], children }: AppBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {left ? <IconButton {...left} /> : null}
        {children ?? (
          <ThemedText accessibilityRole="header" numberOfLines={1} style={[styles.title, !left && styles.titleInset]}>
            {title}
          </ThemedText>
        )}
        {right.map((action) => (
          <IconButton key={action.label} {...action} />
        ))}
      </View>
    </View>
  );
}

export function IconButton({ icon, label, onPress }: AppBarAction) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} color={Colors.text} />
    </Pressable>
  );
}

const ICON_BUTTON_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background
  },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8
  },
  title: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  titleInset: {
    paddingLeft: 12
  },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    backgroundColor: Colors.brandTint
  }
});
