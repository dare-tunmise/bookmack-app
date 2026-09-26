import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type ChipProps = {
  label: string;
  onPress?: () => void;
  // Deep green, e.g. the active tag filter.
  selected?: boolean;
  // Soft green, e.g. a tag already added to a book.
  tinted?: boolean;
  leadingIcon?: 'plus';
  onRemove?: () => void;
};

// A small pill for tags and filters.
export function Chip({ label, onPress, selected = false, tinted = false, leadingIcon, onRemove }: ChipProps) {
  const textColor = selected ? Colors.textOnDark : Colors.text;
  const chipStyle = [styles.chip, tinted && styles.tinted, selected && styles.selected];

  const content = (
    <>
      {leadingIcon ? <Icon name={leadingIcon} color={textColor} size={14} strokeWidth={2.5} /> : null}
      <ThemedText numberOfLines={1} style={[styles.label, { color: textColor }]}>
        {label}
      </ThemedText>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={10}
          onPress={onRemove}
          style={styles.remove}>
          <Icon name="close" color={Colors.textSecondary} size={14} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </>
  );

  if (!onPress) return <View style={chipStyle}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [...chipStyle, pressed && !selected && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  tinted: {
    borderColor: Colors.brandTint,
    backgroundColor: Colors.brandTint
  },
  selected: {
    borderColor: Colors.buttonPrimary,
    backgroundColor: Colors.buttonPrimary
  },
  pressed: {
    backgroundColor: Colors.brandTint
  },
  label: {
    maxWidth: 180,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 18
  },
  remove: {
    marginRight: -4
  }
});
