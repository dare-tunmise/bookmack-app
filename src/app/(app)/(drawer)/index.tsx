import { useFocusEffect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useAppActions } from '@/components/app-actions';
import { AppBar } from '@/components/app-bar';
import { BookDetailsSheet } from '@/components/book-details-sheet';
import { Bookshelf } from '@/components/bookshelf';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Tabs } from '@/components/tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];
// 'background' reloads without a spinner, e.g. when returning after adding a book.
type LoadMode = 'initial' | 'refresh' | 'background' | 'more';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const LIBRARY_TABS = [
  { key: 'recent', label: 'Recent' },
  { key: 'all', label: 'My books' },
  { key: 'reading', label: 'Reading' },
  { key: 'lent', label: 'Lent out' }
] as const;

type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

const TAB_QUERIES = {
  recent: { sort: '-createdAt' },
  all: { sort: 'title' },
  lent: { sort: '-createdAt', status: 'Loaned' },
  // Both states: a book being reread is being read, and asking for 'reading' alone used to hide
  // it. The API takes a comma-separated list for exactly this.
  reading: { sort: '-createdAt', readingStatus: 'reading,rereading' }
} as const satisfies Record<LibraryTab, { sort: string; status?: string; readingStatus?: string }>;

export default function LibraryScreen() {
  const [tab, setTab] = useState<LibraryTab>('recent');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadMode | null>('initial');
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  // Adding a book and "what should I read?" both live in the bottom bar now, so this screen asks
  // for them rather than owning them.
  const { openAdd, libraryVersion } = useAppActions();
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  // Responses from a previous tab or search are ignored once a newer request starts.
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
      const { data, error: apiError } = await api.GET('/books', {
        params: {
          query: {
            limit: PAGE_SIZE,
            cursor,
            q: query || undefined,
            tags: selectedTag ?? undefined,
            ...TAB_QUERIES[tab]
          }
        }
      });
      if (!isCurrent()) return;
      if (!data) throw toApiError(apiError);

      setBooks((current) => (mode === 'more' ? [...current, ...data.data] : data.data));
      setNextCursor(data.meta.nextCursor);
    } catch (err) {
      if (isCurrent()) setError(errorMessage(err));
    } finally {
      if (isCurrent()) setLoading(null);
    }
  }, [tab, query, selectedTag]);

  // Load when the screen first appears; refresh quietly when it comes back into view or the
  // tab or search changes.
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current ? 'background' : 'initial');
      loadedOnce.current = true;
    }, [load])
  );

  // Tags change as books are edited, so refresh the filter chips whenever the library comes into view.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .GET('/books/facets')
        .then(({ data }) => {
          if (cancelled || !data) return;
          const available = data.data.tags;
          setTags([...available].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)));
          // Drop a filter for a tag that no book has any more.
          setSelectedTag((current) => (current && !available.some((tag) => tag.name === current) ? null : current));
        })
        // The shelf still works without filter chips.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const chooseTag = (name: string) => {
    setSelectedTag((current) => (current === name ? null : name));
    setBooks([]);
    setNextCursor(null);
    setError(null);
    setLoading('initial');
  };

  const changeTab = (next: LibraryTab) => {
    if (next === tab) return;
    setTab(next);
    setBooks([]);
    setNextCursor(null);
    setError(null);
    setLoading('initial');
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText('');
  };

  const loadMore = () => {
    if (nextCursor && !loading && !error) load('more', nextCursor);
  };

  // Starting a book from the bar happens while this screen is already on top, so there is no
  // focus change to hang a reload on. The version is what says something changed.
  const handledVersion = useRef(0);
  useEffect(() => {
    if (libraryVersion === handledVersion.current) return;
    handledVersion.current = libraryVersion;
    load('background');
  }, [libraryVersion, load]);

  const emptyShelf = error ? (
    <LoadError message={error} onRetry={() => load('initial')} />
  ) : selectedTag ? (
    <EmptyState
      seed="no-tag-matches"
      title="No books with this tag"
      message={`No books in this list are tagged "${selectedTag}".`}
    />
  ) : query ? (
    <EmptyState seed="no-matches" title="No matches" message={`No books match "${query}".`} />
  ) : tab === 'lent' ? (
    <EmptyState seed="nothing-lent" title="Nothing lent out" message="Books you lend to someone show up here." />
  ) : tab === 'reading' ? (
    <EmptyState
      seed="nothing-reading"
      title="Nothing on the go"
      message="Start a book and it turns up here, with the page you're on."
    />
  ) : (
    <EmptyState
      seed="empty-library"
      title="Your library is empty"
      message="Scan a barcode or snap a cover to add your first book"
      action={{ label: 'Add a book', onPress: openAdd }}
    />
  );

  return (
    <ThemedView style={styles.container}>
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
                  placeholder="Search your books"
                  placeholderTextColor={Colors.textSecondary}
                  accessibilityLabel="Search your books"
                  returnKeyType="search"
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
                right={[
                  // "What should I read?" moved to the bottom bar, where it is reachable from
                  // every section instead of only from the shelf.
                  { icon: 'search', label: 'Search your books', onPress: () => setSearchOpen(true) }
                ]}
              />
            )
        }}
      />

      <Tabs tabs={LIBRARY_TABS} value={tab} onChange={changeTab} />

      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagBar}
          contentContainerStyle={styles.tagBarContent}>
          {tags.map((tag) => (
            <Chip
              key={tag.name}
              label={tag.name}
              selected={tag.name === selectedTag}
              onPress={() => chooseTag(tag.name)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Bookshelf
        books={books}
        onPressBook={setSelectedBook}
        refreshing={loading === 'refresh'}
        onRefresh={() => load('refresh')}
        onEndReached={loadMore}
        // Not `loading === 'initial'`: switching tabs re-fires the focus effect, which loads in
        // 'background' mode and overwrites the 'initial' that changeTab just set. The shelf then
        // had no books and no initial load, so it showed "your library is empty" until the
        // response arrived. What matters is simply that there is nothing to show yet and
        // something is in flight.
        loading={books.length === 0 && loading !== null}
        empty={emptyShelf}
        footer={
          loading === 'more' ? (
            <ActivityIndicator color={Colors.brand} style={styles.footer} />
          ) : error && books.length > 0 ? (
            <LoadError message={error} onRetry={loadMore} />
          ) : null
        }
        // The bar takes its own strip of the screen, so the shelf only needs breathing room.
        bottomInset={Spacing.four}
      />
      <BookDetailsSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onChanged={(book) => {
          setSelectedBook(book);
          load('background');
        }}
        onDeleted={() => {
          setSelectedBook(null);
          load('background');
        }}
      />
    </ThemedView>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.message}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.messageText}>
        {message}
      </ThemedText>
      <Button title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  tagBar: {
    flexGrow: 0
  },
  tagBarContent: {
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingTop: 12
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
  message: {
    alignItems: 'center',
    gap: Spacing.three
  },
  messageText: {
    textAlign: 'center'
  },
  footer: {
    paddingVertical: Spacing.three
  }
});
