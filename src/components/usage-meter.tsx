import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type UsageMeterProps = {
  label: string;
  used: number;
  // null means unlimited.
  limit: number | null;
};

// "7 of 10" with a lime bar on brandTint that turns red once the limit is reached.
export function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const full = limit !== null && used >= limit;
  const ratio = limit === null || limit === 0 ? 0 : Math.min(1, used / limit);
  const count = limit === null ? `${used.toLocaleString()} · Unlimited` : `${used.toLocaleString()} of ${limit.toLocaleString()}`;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${limit === null ? `${used}, unlimited` : `${used} of ${limit}${full ? ', limit reached' : ''}`}`}
      style={styles.meter}>
      <View style={styles.header}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <ThemedText style={[styles.count, full && styles.danger]}>{count}</ThemedText>
      </View>
      {limit !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }, full && styles.fillFull]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    gap: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  label: {
    flexShrink: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text
  },
  count: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  danger: {
    color: Colors.danger
  },
  track: {
    height: 8,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent
  },
  fillFull: {
    backgroundColor: Colors.danger
  }
});
