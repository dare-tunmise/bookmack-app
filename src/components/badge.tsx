import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Schemas } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

export type BadgeTone = 'brand' | 'accent' | 'danger' | 'neutral';

const TONES: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  brand: { backgroundColor: Colors.brandTint, color: Colors.brand },
  accent: { backgroundColor: Colors.accent, color: Colors.text },
  danger: { backgroundColor: Colors.dangerTint, color: Colors.danger },
  neutral: { backgroundColor: Colors.border, color: Colors.textSecondary }
};

export const BOOK_STATUS_BADGES: Record<Schemas['Book']['status'], { label: string; tone: BadgeTone }> = {
  Available: { label: 'Available', tone: 'brand' },
  Loaned: { label: 'On loan', tone: 'accent' },
  Lost: { label: 'Lost', tone: 'neutral' }
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

// Small pill label for statuses such as "On loan" or a plan name.
export function Badge({ label, tone = 'brand', style }: BadgeProps) {
  const { backgroundColor, color } = TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

export const PLAN_LABELS: Record<Schemas['Profile']['plan'], string> = {
  free: 'Free plan',
  premium: 'Premium plan'
};

// The plan pill from the navigation design (drawer and account header).
export function PlanBadge({ plan, style }: { plan: Schemas['Profile']['plan']; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.plan, style]}>
      <ThemedText style={styles.planText}>{PLAN_LABELS[plan]}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  plan: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  planText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.brand
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half
  }
});
