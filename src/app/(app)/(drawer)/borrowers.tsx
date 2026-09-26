import { router, useFocusEffect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { AppBar } from '@/components/app-bar';
import { BorrowerRow } from '@/components/borrower-row';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FLOATING_BUTTON_SIZE, FloatingAddButton } from '@/components/floating-add-button';
import { ListRowSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

type Borrower = Schemas['Borrower'];
// 'background' reloads without a spinner, e.g. when returning after adding a borrower.
type LoadMode = 'initial' | 'refresh' | 'background' | 'more';

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export default function BorrowersScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadMode | null>('initial');
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  // Responses from a previous search are ignored once a newer request starts.
  const latestRequest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const load = useCallback(async (mode: LoadMode, cursor?: string) => {
    const requestId = ++latestRequest.current;
    const isCurrent = () => requestId === latestRequest.current;

    setLoading(mode);
    setError(null);
    try {
      const { data, error: apiError } = await api.GET('/borrowers', {
        params: { query: { limit: PAGE_SIZE, cursor, q: query || undefined } }
      });
      if (!isCurrent()) return;
      if (!data) throw toApiError(apiError);

      setBorrowers((current) => (mode === 'more' ? [...current, ...data.data] : data.data));
      setNextCursor(data.meta.nextCursor);
    } catch (err) {
      if (isCurrent()) setError(errorMessage(err));
    } finally {
      if (isCurrent()) setLoading(null);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current ? 'background' : 'initial');
      loadedOnce.current = true;
    }, [load])
  );

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText('');
  };

  const loadMore = () => {
    if (nextCursor && !loading && !error) load('more', nextCursor);
  };

  const addBorrower = () => router.push('/borrower-form');
  // Any load with nothing to show yet, not just an 'initial' one: see the library screen.
  const initialLoading = loading !== null && borrowers.length === 0;

  return (
    <ThemedView style={styles.flex}>
      <Drawer.Screen
        options={{
          header: ({ options, navigation }) =>
            searchOpen ? (
              <AppBar
                left={{ icon: 'arrowLeft', label: 'Close search', onPress: closeSearch }}
                right={[
                  {
                    icon: 'close',
                    label: searchText ? 'Clear search' : 'Close search',
                    onPress: () => (searchText ? setSearchText('') : closeSearch())
                  }
                ]}>
                <TextInput
                  autoFocus
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search by name or email"
                  placeholderTextColor={Colors.textSecondary}
                  accessibilityLabel="Search borrowers"
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={Colors.brand}
                  cursorColor={Colors.brand}
                  style={styles.searchInput}
                />
              </AppBar>
            ) : (
              <AppBar
                title={options.title}
                left={{ icon: 'menu', label: 'Open menu', onPress: () => navigation.openDrawer() }}
                right={[{ icon: 'search', label: 'Search borrowers', onPress: () => setSearchOpen(true) }]}
              />
            )
        }}
      />

      <FlatList
        data={borrowers}
        keyExtractor={(borrower) => borrower.id}
        contentContainerStyle={
          borrowers.length === 0 && !initialLoading
            ? styles.emptyContent
            : [styles.content, { paddingBottom: FLOATING_BUTTON_SIZE + Spacing.five * 2 }]
        }
        refreshControl={
          <RefreshControl refreshing={loading === 'refresh'} onRefresh={() => load('refresh')} colors={[Colors.brand]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <BorrowerRow borrower={item} onPress={() => router.push({ pathname: '/borrower', params: { id: item.id } })} />
        )}
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
          ) : query ? (
            <EmptyState seed="no-borrower-matches" title="No matches" message={`No borrowers match "${query}".`} />
          ) : (
            <EmptyState
              seed="no-borrowers"
              title="No borrowers yet"
              message="People you lend to show up here"
              action={{ label: 'Add a borrower', onPress: addBorrower }}
            />
          )
        }
        ListFooterComponent={loading === 'more' ? <ActivityIndicator color={Colors.brand} style={styles.footer} /> : null}
      />

      <FloatingAddButton accessibilityLabel="Add a borrower" onPress={addBorrower} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    color: Colors.text,
    fontFamily: Fonts.body,
    fontSize: 15
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
