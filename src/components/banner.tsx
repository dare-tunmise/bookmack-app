import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

// The three banner treatments from the navigation design:
// - offline: sync is blocked (dangerTint)
// - plan: an upgrade path, not an error (brandTint)
// - info: a heads-up, no action needed (surface with a border)
const TONES = {
  offline: { icon: 'offline', iconColor: Colors.danger, textColor: '#7A150F', backgroundColor: Colors.dangerTint },
  plan: { icon: 'info', iconColor: Colors.brand, textColor: Colors.text, backgroundColor: Colors.brandTint },
  info: { icon: 'error', iconColor: Colors.textSecondary, textColor: Colors.textBody, backgroundColor: Colors.surface }
} satisfies Record<string, { icon: IconName; iconColor: string; textColor: string; backgroundColor: string }>;

type BannerProps = {
  tone: keyof typeof TONES;
  // Text, optionally with a nested link (a ThemedText with type="linkPrimary").
  children: ReactNode;
};

export function Banner({ tone, children }: BannerProps) {
  const { icon, iconColor, textColor, backgroundColor } = TONES[tone];

  return (
    <View
      accessibilityRole={tone === 'offline' ? 'alert' : undefined}
      style={[styles.banner, { backgroundColor }, tone === 'info' && styles.bordered]}>
      <View style={styles.icon}>
        <Icon name={icon} color={iconColor} size={20} />
      </View>
      <ThemedText style={[styles.text, { color: textColor }]}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14
  },
  bordered: {
    borderWidth: 1,
    borderColor: Colors.border
  },
  icon: {
    marginTop: 1
  },
  text: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 19
  }
});
