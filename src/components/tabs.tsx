import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

type Tab<K extends string> = { key: K; label: string };

type TabsProps<K extends string> = {
  tabs: readonly Tab<K>[];
  value: K;
  onChange: (key: K) => void;
};

// Equal-width tabs from the navigation design: a 3px brand underline under the selected tab.
export function Tabs<K extends string>({ tabs, value, onChange }: TabsProps<K>) {
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}>
            <ThemedText style={[styles.label, { color: selected ? Colors.text : Colors.disabledText }]}>
              {tab.label}
            </ThemedText>
            <View style={[styles.indicator, selected && styles.indicatorSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 12
  },
  indicator: {
    alignSelf: 'stretch',
    height: 3,
    marginBottom: -1
  },
  indicatorSelected: {
    backgroundColor: Colors.brand
  }
});
