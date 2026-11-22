import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

// How many books to aim at this year.
//
// The stats design asks for "Set a goal" as a link and does not draw what it opens, so this is
// deliberately the plainest thing that works: a number, two buttons, and a way to remove it. A
// stepper rather than a keyboard because the answer is always a small round number, and typing
// one means dismissing a keyboard to see the thing you are setting.
const STEP = 1;
const MIN = 1;
const MAX = 2000;
const DEFAULT = 24;

export default function ReadingGoalScreen() {
  const { user, updateUser } = useSession();
  const [goal, setGoal] = useState(user?.readingGoal ?? DEFAULT);
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = async (value: number | null, mode: 'save' | 'clear') => {
    setBusy(mode);
    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/me', { body: { readingGoal: value } });
      if (!data) throw toApiError(apiError);
      updateUser(data.data);
      router.back();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  const nudge = (by: number) => setGoal((current) => Math.max(MIN, Math.min(MAX, current + by)));

  return (
    <FormScreen
      title="Your reading goal"
      subtitle="Books to finish this year. The stats page measures your pace against it, and you can change or remove it whenever you like."
      edges={['bottom']}>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fewer books"
          disabled={goal <= MIN}
          onPress={() => nudge(-STEP)}
          style={({ pressed }) => [styles.step, (pressed || goal <= MIN) && styles.dim]}>
          <Icon name="minus" color={Colors.text} size={22} />
        </Pressable>

        <ThemedText style={styles.value}>{goal}</ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More books"
          disabled={goal >= MAX}
          onPress={() => nudge(STEP)}
          style={({ pressed }) => [styles.step, (pressed || goal >= MAX) && styles.dim]}>
          <Icon name="plus" color={Colors.text} size={22} />
        </Pressable>
      </View>

      <View style={styles.quick}>
        {[12, 24, 36, 52].map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => setGoal(suggestion)}
            style={({ pressed }) => [styles.chip, goal === suggestion && styles.chipOn, pressed && styles.dim]}>
            <ThemedText style={[styles.chipText, goal === suggestion && styles.chipTextOn]}>{suggestion}</ThemedText>
          </Pressable>
        ))}
      </View>

      {error ? <FieldError message={error} /> : null}

      <View style={styles.actions}>
        <Button title="Save goal" onPress={() => commit(goal, 'save')} loading={busy === 'save'} disabled={busy !== null} />
        {user?.readingGoal ? (
          <Button
            title="Remove goal"
            variant="secondary"
            onPress={() => commit(null, 'clear')}
            loading={busy === 'clear'}
            disabled={busy !== null}
          />
        ) : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four
  },
  step: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  value: {
    fontFamily: Fonts.display,
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -2,
    color: Colors.text,
    minWidth: 120,
    textAlign: 'center'
  },
  quick: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  chip: {
    height: 40,
    minWidth: 56,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipOn: { backgroundColor: Colors.buttonPrimary, borderColor: Colors.buttonPrimary },
  chipText: { fontFamily: Fonts.bodyBold, fontSize: 15, lineHeight: 20, color: Colors.text },
  chipTextOn: { color: Colors.textOnDark },
  dim: { opacity: 0.6 },
  actions: { gap: Spacing.two, marginTop: Spacing.two }
});
