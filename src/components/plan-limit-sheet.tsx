import { router } from 'expo-router';
import { createContext, use, useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { UsageMeter } from '@/components/usage-meter';
import { Spacing } from '@/constants/theme';

// What the API sends with PLAN_LIMIT_REACHED (assertWithinLimit in services/entitlements.mjs).
type LimitDetails = { limitKey: string; limit: number; used: number; currentPlan: string };

const LIMIT_LABELS: Record<string, string> = {
  books: 'Books',
  borrowers: 'Borrowers',
  loansPerMonth: 'Loans this month',
  recommendationsPerMonth: 'Recommendations this month',
  coverScansPerMonth: 'Cover scans this month'
};

const limitDetails = (value: unknown): LimitDetails | null => {
  const details = value as LimitDetails | null;
  return details && typeof details.limitKey === 'string' && typeof details.limit === 'number'
    ? details
    : null;
};

type PlanLimit = { message: string; details: LimitDetails | null };

type PlanLimitContextValue = {
  limit: PlanLimit | null;
  show: (err: unknown) => boolean;
  dismiss: () => void;
};

const PlanLimitContext = createContext<PlanLimitContextValue | null>(null);

// Shows one sheet for every "you've used up your plan" error, wherever it happens: adding a book,
// a borrower, a loan, a recommendation, or a cover scan.
export function PlanLimitProvider({ children }: PropsWithChildren) {
  const [limit, setLimit] = useState<PlanLimit | null>(null);

  // Returns true when the error was a plan limit and the sheet is handling it, so callers can
  // skip showing their own error message.
  const show = useCallback((err: unknown) => {
    if (!(err instanceof ApiError) || err.code !== 'PLAN_LIMIT_REACHED') return false;
    setLimit({ message: err.message, details: limitDetails(err.details) });
    return true;
  }, []);

  const dismiss = useCallback(() => setLimit(null), []);

  const value = useMemo(() => ({ limit, show, dismiss }), [limit, show, dismiss]);

  return (
    <PlanLimitContext value={value}>
      {children}
      <PlanLimitSheet />
    </PlanLimitContext>
  );
}

export function usePlanLimit() {
  const value = use(PlanLimitContext);
  if (!value) throw new Error('usePlanLimit must be used inside <PlanLimitProvider>');
  return { show: value.show };
}

function PlanLimitSheet() {
  const value = use(PlanLimitContext);
  const limit = value?.limit ?? null;

  const seePlans = () => {
    value?.dismiss();
    router.push('/plan');
  };

  return (
    <BottomSheet visible={Boolean(limit)} onClose={() => value?.dismiss()}>
      <ThemedText type="h2" accessibilityRole="header">
        You&apos;ve reached your plan&apos;s limit
      </ThemedText>
      <ThemedText themeColor="textSecondary">{limit?.message}</ThemedText>

      {limit?.details ? (
        <View style={styles.meter}>
          <UsageMeter
            label={LIMIT_LABELS[limit.details.limitKey] ?? 'Used'}
            used={limit.details.used}
            limit={limit.details.limit}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="See plans" onPress={seePlans} />
        <Button title="Not now" variant="secondary" onPress={() => value?.dismiss()} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  meter: {
    paddingVertical: Spacing.one
  },
  actions: {
    gap: Spacing.three
  }
});
