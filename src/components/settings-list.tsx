import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

// A titled card of rows, with dividers between them.
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  icon: IconName;
  label: string;
  value?: string | null;
  // Rows with onPress show a chevron unless an accessory is given.
  onPress?: () => void;
  accessory?: ReactNode;
  tone?: 'default' | 'danger';
};

export function SettingsRow({ icon, label, value, onPress, accessory, tone = 'default' }: SettingsRowProps) {
  const danger = tone === 'danger';
  const color = danger ? Colors.danger : Colors.text;

  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon name={icon} color={color} size={20} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
        {value ? (
          <ThemedText style={styles.value} numberOfLines={2}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {accessory ?? (onPress ? <Icon name="chevronRight" color={Colors.textSecondary} size={20} /> : null)}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

type SettingsSwitchRowProps = {
  icon: IconName;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SettingsSwitchRow({ icon, label, value, onValueChange }: SettingsSwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} color={Colors.text} size={20} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.brand }}
        thumbColor={Colors.surface}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

const ROW_ICON_SIZE = 36;

const styles = StyleSheet.create({
  section: {
    gap: 8
  },
  sectionTitle: {
    paddingHorizontal: 4,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  card: {
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  divider: {
    height: 1,
    marginLeft: 16 + ROW_ICON_SIZE + 14,
    backgroundColor: Colors.border
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  pressed: {
    backgroundColor: Colors.brandTint
  },
  rowIcon: {
    width: ROW_ICON_SIZE,
    height: ROW_ICON_SIZE,
    borderRadius: ROW_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  rowIconDanger: {
    backgroundColor: Colors.dangerTint
  },
  rowText: {
    flex: 1,
    gap: 2
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text
  },
  value: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary
  }
});
