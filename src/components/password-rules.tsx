import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

// Mirrors PasswordInput in the API's v1/schemas.mjs (bookmack-api repo); keep the two in sync.
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (password: string) => password.length >= 8 },
  { label: 'An uppercase letter', test: (password: string) => /[A-Z]/.test(password) },
  { label: 'A lowercase letter', test: (password: string) => /[a-z]/.test(password) },
  { label: 'A number', test: (password: string) => /\d/.test(password) },
  { label: 'A symbol, like ! @ # or ?', test: (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password) }
];

export const passwordMeetsRules = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));

// Checklist under a new-password field; each rule ticks as it's met.
export function PasswordRules({ password }: { password: string }) {
  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View
            key={rule.label}
            accessible
            accessibilityLabel={`${rule.label}: ${met ? 'done' : 'not yet'}`}
            style={styles.rule}>
            <View style={[styles.dot, met && styles.dotMet]}>
              {met ? <Icon name="check" color={Colors.text} size={12} strokeWidth={3} /> : null}
            </View>
            <ThemedText type="small" themeColor={met ? 'text' : 'textSecondary'}>
              {rule.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 20;

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingVertical: Spacing.one
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dotMet: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  }
});
