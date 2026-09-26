import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Badge } from '@/components/badge';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { EmptyState } from '@/components/empty-state';
import { usePendingRequests } from '@/components/pending-requests';
import { ListRowSkeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/time';

type BookRequest = Schemas['BookRequest'];

const PAGE_SIZE = 30;

const STATUS_BADGES: Record<BookRequest['status'], { label: string; tone: 'brand' | 'accent' | 'neutral' }> = {
  pending: { label: 'Waiting on you', tone: 'accent' },
  approved: { label: 'You said yes', tone: 'brand' },
  declined: { label: 'Declined', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' }
};

// Books people have asked to borrow from a shelf you shared.
export default function RequestsScreen() {
  const [requests, setRequests] = useState<BookRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const snackbar = useSnackbar();
  const { refresh: refreshPending, decrement: decrementPending } = usePendingRequests();

  const load = useCallback(async () => {
    try {
      const { data, error: apiError } = await api.GET('/requests', { params: { query: { limit: PAGE_SIZE } } });
      if (!data) throw toApiError(apiError);
      setRequests(data.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Requests can arrive while the app is open, so the badge is re-checked here too.
      refreshPending();
    }, [load, refreshPending])
  );

  const decide = async (request: BookRequest, approve: boolean) => {
    setDeciding(request.id);
    try {
      const { data, error: apiError } = await api.POST('/requests/{id}/decision', {
        params: { path: { id: request.id } },
        body: { approve }
      });
      if (!data) throw toApiError(apiError);

      setRequests((current) =>
        current?.map((entry) => (entry.id === request.id ? data.data : entry)) ?? null);
      // Only a request that was actually waiting comes off the badge: answering one that had
      // already been decided would otherwise count against it a second time.
      if (request.status === 'pending') decrementPending();
      snackbar.show(
        approve
          ? `${request.borrower?.name ?? 'They'} will hear that you said yes`
          : `${request.borrower?.name ?? 'They'} will hear that you can't right now`
      );
    } catch (err) {
      snackbar.show(errorMessage(err));
    } finally {
      setDeciding(null);
    }
  };

  if (!requests) {
    return (
      <ThemedView style={styles.loading}>
        {error ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {error}
            </ThemedText>
            <Button title="Try again" variant="secondary" onPress={load} />
          </>
        ) : (
          [0, 1, 2].map((key) => <ListRowSkeleton key={key} />)
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={requests}
        keyExtractor={(request) => request.id}
        contentContainerStyle={[styles.content, requests.length === 0 && styles.emptyContent]}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        ListEmptyComponent={
          <EmptyState
            seed="no-requests"
            title="No requests yet"
            message="Share your shelf with someone and anything they ask to borrow shows up here."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <BookCover title={item.book?.title ?? 'Deleted book'} thumbnail={item.book?.thumbnail ?? null} size={48} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {item.book?.title ?? 'A book you no longer have'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {`${item.borrower?.name ?? 'Someone'} · ${timeAgo(item.createdAt)}`}
                </ThemedText>
              </View>
              <Badge {...STATUS_BADGES[item.status]} />
            </View>

            {item.message ? (
              <ThemedView type="background" style={styles.note}>
                <ThemedText type="small">{`“${item.message}”`}</ThemedText>
              </ThemedView>
            ) : null}

            {item.status === 'pending' ? (
              deciding === item.id ? (
                <ActivityIndicator color={Colors.brand} />
              ) : (
                <ButtonGroup
                  actions={[
                    { label: 'Say yes', tone: 'primary', onPress: () => decide(item, true) },
                    { label: 'Not now', tone: 'danger', onPress: () => decide(item, false) }
                  ]}
                />
              )
            ) : null}

            {item.status === 'approved' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Lend it from the book&apos;s page when you hand it over.
              </ThemedText>
            ) : null}
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  loading: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four
  },
  center: {
    textAlign: 'center'
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three
  },
  note: {
    padding: Spacing.three,
    borderRadius: Radius.input
  }
});
