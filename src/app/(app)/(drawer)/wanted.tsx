import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Wanted = Schemas['WantedBook'];

const PAGE_SIZE = 50;
const COVER_WIDTH = 48;

// Books you do not own yet: the one you lost and the one you keep meaning to pick up.
//
// Deliberately plain. There are no prices, no buy buttons and no links out — this is the list you
// take to a shop, not a shop.
export default function WantedScreen() {
  const snackbar = useSnackbar();
  const [items, setItems] = useState<Wanted[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The row currently being acted on, so only its buttons show as busy.
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    api
      .GET('/wanted', { params: { query: { limit: PAGE_SIZE } } })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        if (!data) throw toApiError(apiError);
        setItems(data.data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const remove = async (entry: Wanted) => {
    setBusy(entry.id);
    setError(null);
    try {
      const { error: apiError, response } = await api.DELETE('/wanted/{id}', {
        params: { path: { id: entry.id } }
      });
      if (!response.ok) throw toApiError(apiError);
      setItems((current) => (current ?? []).filter((row) => row.id !== entry.id));
      snackbar.show(`Removed "${entry.title}"`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const bought = async (entry: Wanted) => {
    setBusy(entry.id);
    setError(null);
    try {
      const { data, error: apiError } = await api.POST('/wanted/{id}/bought', {
        params: { path: { id: entry.id } }
      });
      if (!data) throw toApiError(apiError);
      setItems((current) => (current ?? []).filter((row) => row.id !== entry.id));
      // A replacement puts the copy you lost back on the shelf rather than adding a second one,
      // so the wording should not claim you now have two.
      snackbar.show(
        entry.reason === 'replacement'
          ? `"${entry.title}" is back on your shelf`
          : `Added "${entry.title}" to your library`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (items === null) {
    return (
      <ThemedView style={styles.loading}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} width="100%" height={112} radius={Radius.card} />
        ))}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={[styles.content, items.length === 0 && styles.emptyContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[Colors.brand]}
          />
        }
        ListHeaderComponent={error ? <FieldError message={error} /> : null}
        ListEmptyComponent={
          error ? null : (
            <EmptyState
              seed="nothing-wanted"
              title="Nothing on the list"
              message="Books you mean to get hold of show up here — including the ones you have lost and want again."
            />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <BookCover title={item.title} thumbnail={item.thumbnail} size={COVER_WIDTH} />
              <View style={styles.flex}>
                <ThemedText style={styles.title} numberOfLines={2}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.author}
                </ThemedText>
                {item.reason === 'replacement' ? (
                  <View style={styles.replacing}>
                    <Icon name="wanted" color={Colors.textSecondary} size={13} />
                    <ThemedText type="caption" themeColor="textSecondary">
                      Replacing a copy you lost
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.title}`}
                hitSlop={8}
                disabled={busy === item.id}
                onPress={() => remove(item)}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
                <Icon name="close" color={Colors.textSecondary} size={18} />
              </Pressable>
            </View>

            {item.note ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                {item.note}
              </ThemedText>
            ) : null}

            <Button
              title="I bought it"
              variant="secondary"
              loading={busy === item.id}
              onPress={() => bought(item)}
            />
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
    padding: Spacing.three
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.five
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text
  },
  replacing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one
  },
  remove: {
    padding: Spacing.one,
    borderRadius: Radius.pill
  },
  pressed: {
    opacity: 0.6
  },
  note: {
    fontStyle: 'italic'
  }
});
