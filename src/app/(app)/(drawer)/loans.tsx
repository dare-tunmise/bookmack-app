import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { LoanRow, LoanSheet } from '@/components/loan-sheet';
import { ListRowSkeleton } from '@/components/skeleton';
import { Tabs } from '@/components/tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type Loan = Schemas['Loan'];
// 'background' reloads without a spinner, e.g. after returning a book.
type LoadMode = 'initial' | 'refresh' | 'background' | 'more';

const PAGE_SIZE = 20;

// "Lent out" (active) includes overdue loans; "Overdue" narrows to those.
const LOAN_TABS = [
  { key: 'active', label: 'Lent out' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' }
] as const;

type LoanTab = (typeof LOAN_TABS)[number]['key'];

const EMPTY_STATES: Record<LoanTab, { seed: string; title: string; message: string }> = {
  active: {
    seed: 'nothing-lent',
    title: 'Nothing lent out',
    message: 'Open a book on your shelf and tap "Lend this book".'
  },
  overdue: { seed: 'nothing-overdue', title: 'Nothing is overdue', message: 'Every book is back on time.' },
  returned: { seed: 'nothing-returned', title: 'No returns yet', message: 'Books that come back show up here.' }
};

export default function LoansScreen() {
  const [tab, setTab] = useState<LoanTab>('active');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadMode | null>('initial');
  const [error, setError] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const loadedOnce = useRef(false);
  // Responses from a previous tab are ignored once a newer request starts.
  const latestRequest = useRef(0);

  const load = useCallback(async (mode: LoadMode, cursor?: string) => {
    const requestId = ++latestRequest.current;
    const isCurrent = () => requestId === latestRequest.current;

    setLoading(mode);
    setError(null);
    try {
      const { data, error: apiError } = await api.GET('/loans', {
        params: { query: { status: tab, limit: PAGE_SIZE, cursor } }
      });
      if (!isCurrent()) return;
      if (!data) throw toApiError(apiError);

      setLoans((current) => (mode === 'more' ? [...current, ...data.data] : data.data));
      setNextCursor(data.meta.nextCursor);
    } catch (err) {
      if (isCurrent()) setError(errorMessage(err));
    } finally {
      if (isCurrent()) setLoading(null);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current ? 'background' : 'initial');
      loadedOnce.current = true;
    }, [load])
  );

  const changeTab = (next: LoanTab) => {
    if (next === tab) return;
    setTab(next);
    setLoans([]);
    setNextCursor(null);
    setError(null);
    setLoading('initial');
  };

  const loadMore = () => {
    if (nextCursor && !loading && !error) load('more', nextCursor);
  };

  // Any load with nothing to show yet, not just an 'initial' one: a tab change re-fires the
  // focus effect in 'background' mode, which would otherwise flash "nothing lent out" first.
  const initialLoading = loading !== null && loans.length === 0;

  return (
    <ThemedView style={styles.flex}>
      <Tabs tabs={LOAN_TABS} value={tab} onChange={changeTab} />

      <FlatList
        data={loans}
        keyExtractor={(loan) => loan.id}
        contentContainerStyle={loans.length === 0 && !initialLoading ? styles.emptyContent : styles.content}
        refreshControl={
          <RefreshControl refreshing={loading === 'refresh'} onRefresh={() => load('refresh')} colors={[Colors.brand]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => <LoanRow loan={item} onPress={() => setSelectedLoan(item)} />}
        ListEmptyComponent={
          initialLoading ? (
            <ListRowSkeleton />
          ) : error ? (
            <View style={styles.message}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {error}
              </ThemedText>
              <Button title="Try again" variant="secondary" onPress={() => load('initial')} />
            </View>
          ) : (
            <EmptyState {...EMPTY_STATES[tab]} />
          )
        }
        ListFooterComponent={loading === 'more' ? <ActivityIndicator color={Colors.brand} style={styles.footer} /> : null}
      />

      <LoanSheet
        loan={selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onReturned={() => {
          setSelectedLoan(null);
          load('background');
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four
  },
  message: {
    alignItems: 'center',
    gap: Spacing.three
  },
  center: {
    textAlign: 'center'
  },
  footer: {
    paddingVertical: Spacing.three
  }
});
