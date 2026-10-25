import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { AppBar } from '@/components/app-bar';
import {
  POSTER_SIZES,
  POSTER_THEMES,
  POSTER_WIDTH,
  Poster,
  type PosterBook,
  type PosterLayout,
  type PosterSize,
  type PosterTheme
} from '@/components/poster';
import { useSnackbar } from '@/components/snackbar';
import { useSession } from '@/auth/session';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];
type YearShelf = Schemas['YearShelf'];

// Four sources, two layouts, two sizes, four colours. Sixty-four posters, all of them good —
// which is the reason there are no fonts, borders or filters here. Every control added makes a
// bad poster possible, and nobody shares a bad poster.

type Source = 'year' | 'five' | 'recent' | 'picked';

const SOURCE_LABELS: Record<Source, string> = {
  year: 'This year',
  five: 'Five stars',
  recent: 'Recently added',
  picked: 'Selected'
};

const subtitleFor = (source: Source, count: number, year: number) => {
  if (source === 'year') return `${count} books finished in ${year}`;
  if (source === 'five') return `${count} books I gave five stars`;
  if (source === 'recent') return `${count} new on the shelf`;
  return `${count} I'd lend you first`;
};

const THEME_KEYS = Object.keys(POSTER_THEMES) as PosterTheme[];
// A poster needs books. One cover is a photograph, not a collage.
const MIN_BOOKS = 2;
const MAX_BOOKS = 40;

const toPosterBook = (book: { id: string; title: string; author: string; thumbnail: string | null }): PosterBook => ({
  id: book.id,
  title: book.title,
  author: book.author,
  thumbnail: book.thumbnail
});

export default function PosterScreen() {
  const { bookIds } = useLocalSearchParams<{ bookIds?: string }>();
  const picked = useMemo(() => (bookIds ? bookIds.split(',').filter(Boolean) : []), [bookIds]);
  const snackbar = useSnackbar();
  const { user } = useSession();

  const [shelf, setShelf] = useState<YearShelf | null>(null);
  const [recent, setRecent] = useState<Book[] | null>(null);
  const [chosen, setChosen] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  const [source, setSource] = useState<Source>(picked.length ? 'picked' : 'year');
  const [layout, setLayout] = useState<PosterLayout>('grid');
  const [size, setSize] = useState<PosterSize>('post');
  const [theme, setTheme] = useState<PosterTheme>('forest');
  const [previewWidth, setPreviewWidth] = useState(0);
  const [previewHeight, setPreviewHeight] = useState(0);

  // Captured off screen at full size. The preview is the same component scaled down, so what gets
  // shared is what was on screen rather than a second rendering that can drift from it.
  const shotRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [year, added] = await Promise.all([
          api.GET('/stats/year/shelf', { params: { query: {} } }),
          api.GET('/books', { params: { query: { sort: '-createdAt', limit: MAX_BOOKS } } })
        ]);
        if (cancelled) return;
        if (!year.data) throw toApiError(year.error);
        setShelf(year.data.data);
        setRecent(added.data?.data ?? []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!picked.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        picked.slice(0, MAX_BOOKS).map((id) => api.GET('/books/{id}', { params: { path: { id } } }))
      );
      if (cancelled) return;
      setChosen(results.map((result) => result.data?.data).filter((book): book is Book => Boolean(book)));
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);

  const books: Record<Source, PosterBook[]> = useMemo(() => {
    const yearBooks = shelf?.books ?? [];
    return {
      year: yearBooks.slice(0, MAX_BOOKS).map(toPosterBook),
      five: yearBooks.filter((book) => book.rating === 5).slice(0, MAX_BOOKS).map(toPosterBook),
      recent: (recent ?? []).slice(0, MAX_BOOKS).map(toPosterBook),
      picked: (chosen ?? []).map(toPosterBook)
    };
  }, [shelf, recent, chosen]);

  const available = (Object.keys(SOURCE_LABELS) as Source[]).filter(
    (key) => (key !== 'picked' || picked.length > 0) && books[key].length >= MIN_BOOKS
  );

  // If the chosen source turns out to be too thin once the data lands, fall through to one that
  // is not. Derived rather than corrected in an effect: writing state to fix state renders twice
  // and briefly shows the empty poster it is trying to avoid.
  const showing = available.includes(source) ? source : available[0] ?? source;
  const current = books[showing];
  const year = shelf?.year ?? new Date().getFullYear();

  const capture = useCallback(async () => {
    if (!shotRef.current) return null;
    return captureRef(shotRef, { format: 'png', quality: 1, width: POSTER_WIDTH, height: POSTER_SIZES[size] });
  }, [size]);

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      // Asked for only when someone actually saves, not on the way into the screen: a permission
      // prompt before anyone has made anything is how permissions get denied.
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error('BookMack needs permission to save to your photos.');
      const uri = await capture();
      if (!uri) throw new Error('The poster could not be rendered.');
      await MediaLibrary.saveToLibraryAsync(uri);
      snackbar.show('Saved to your photos');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    setError(null);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const uri = await capture();
      if (!uri) throw new Error('The poster could not be rendered.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your shelf' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const loading = !shelf && !error;
  const scale = previewWidth && previewHeight
    ? Math.min(previewWidth / POSTER_WIDTH, previewHeight / POSTER_SIZES[size])
    : 0;

  // First name only, the way a shared shelf shows it — a poster goes further than a link does.
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'My';
  const posterProps = {
    books: current,
    title: `${firstName}\u2019s shelf`,
    subtitle: subtitleFor(showing, current.length, year),
    handle: 'bookmack.com',
    size,
    layout,
    theme
  };

  return (
    <ThemedView style={styles.screen}>
      <AppBar title="Poster" left={{ icon: 'arrowLeft', label: 'Back', onPress: () => router.back() }} />

      <View
        style={styles.preview}
        onLayout={(event) => {
          setPreviewWidth(event.nativeEvent.layout.width - Spacing.five);
          setPreviewHeight(event.nativeEvent.layout.height - Spacing.three);
        }}>
        {loading ? (
          <ActivityIndicator color={Colors.brand} />
        ) : current.length >= MIN_BOOKS && scale > 0 ? (
          <View
            style={{
              width: POSTER_WIDTH * scale,
              height: POSTER_SIZES[size] * scale,
              borderRadius: 8,
              overflow: 'hidden'
            }}>
            <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
              <Poster {...posterProps} />
            </View>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            {error
              ? 'Something went wrong loading your books.'
              : `Finish a couple of books and your year becomes a poster.`}
          </ThemedText>
        )}
      </View>

      {/* Off screen at full size, and only while something is actually being captured — a
          1080-wide view with every cover in it is not worth keeping mounted otherwise. */}
      {busy ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View ref={shotRef} collapsable={false}>
            <Poster {...posterProps} />
          </View>
        </View>
      ) : null}

      <View style={styles.tray}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled">
          {available.map((key) => {
            const on = key === showing;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSource(key)}
                style={[styles.chip, on && styles.chipOn]}>
                <ThemedText type="smallBold" style={on ? styles.chipOnText : undefined}>
                  {SOURCE_LABELS[key]}
                </ThemedText>
                <ThemedText type="caption" style={on ? styles.chipOnCount : styles.chipCount}>
                  {books[key].length}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.options}>
          <Toggle
            options={[
              { key: 'grid', icon: 'grid', label: 'Grid' },
              { key: 'mosaic', icon: 'mosaic', label: 'Mosaic' }
            ]}
            value={layout}
            onChange={(next) => setLayout(next as PosterLayout)}
          />
          <Toggle
            options={[
              { key: 'post', icon: 'post', label: 'Post, 4 by 5' },
              { key: 'story', icon: 'story', label: 'Story, 9 by 16' }
            ]}
            value={size}
            onChange={(next) => setSize(next as PosterSize)}
          />

          <View style={styles.swatches}>
            {THEME_KEYS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key}
                accessibilityState={{ selected: key === theme }}
                onPress={() => setTheme(key)}
                style={[
                  styles.swatch,
                  { backgroundColor: POSTER_THEMES[key].bg },
                  key === theme && styles.swatchOn
                ]}
              />
            ))}
          </View>
        </View>

        {error ? (
          <ThemedText type="caption" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || current.length < MIN_BOOKS}
            onPress={save}
            style={[styles.action, styles.actionSecondary, busy === 'save' && styles.actionBusy]}>
            <ThemedText type="button">{busy === 'save' ? 'Saving…' : 'Save image'}</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || current.length < MIN_BOOKS}
            onPress={share}
            style={[styles.action, styles.actionPrimary, busy === 'share' && styles.actionBusy]}>
            <ThemedText type="button" style={styles.actionPrimaryText}>
              {busy === 'share' ? 'Preparing…' : 'Share'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

function Toggle({
  options,
  value,
  onChange
}: {
  options: { key: string; icon: 'grid' | 'mosaic' | 'post' | 'story'; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.toggle}>
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            style={[styles.toggleButton, on && styles.toggleButtonOn]}>
            <LayoutIcon name={option.icon} color={on ? Colors.text : Colors.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Four shapes the icon set has no equivalent for: they describe a poster's arrangement, not an
// object, so they are drawn here rather than forced onto a stock icon.
function LayoutIcon({ name, color }: { name: 'grid' | 'mosaic' | 'post' | 'story'; color: string }) {
  const size = 20;
  const box = (left: number, top: number, width: number, height: number) => (
    <View
      key={`${left}:${top}`}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderWidth: 1.9,
        borderColor: color,
        borderRadius: 1.5
      }}
    />
  );

  return (
    <View style={{ width: size, height: size }}>
      {name === 'grid'
        ? [box(0, 0, 8.5, 8.5), box(11.5, 0, 8.5, 8.5), box(0, 11.5, 8.5, 8.5), box(11.5, 11.5, 8.5, 8.5)]
        : name === 'mosaic'
          ? [box(0, 0, 12.5, 12.5), box(15, 0, 5, 5.5), box(15, 7.5, 5, 5), box(0, 15, 5.5, 5), box(8, 15, 4.5, 5), box(15, 15, 5, 5)]
          : name === 'post'
            ? [box(2.5, 0.5, 15, 19)]
            : [box(5, 0, 10, 20)]}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 260
  },
  // Far enough off screen that it is never seen, still laid out so it can be captured.
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
    opacity: 0
  },
  tray: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border
  },
  chipOn: {
    backgroundColor: Colors.buttonPrimary,
    borderColor: Colors.buttonPrimary
  },
  chipOnText: {
    color: Colors.accent
  },
  chipCount: {
    color: Colors.textSecondary
  },
  chipOnCount: {
    color: '#BFE3A6'
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.brandTint,
    borderRadius: 12,
    padding: 3
  },
  toggleButton: {
    width: 44,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toggleButtonOn: {
    backgroundColor: Colors.surface
  },
  swatches: {
    flexDirection: 'row',
    gap: 7,
    marginLeft: 'auto'
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(22,51,0,0.16)'
  },
  swatchOn: {
    borderWidth: 2,
    borderColor: Colors.text,
    transform: [{ scale: 1.12 }]
  },
  error: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three
  },
  action: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionSecondary: {
    flex: 1,
    backgroundColor: Colors.brandTint
  },
  actionPrimary: {
    flex: 1.4,
    backgroundColor: Colors.buttonPrimary
  },
  actionPrimaryText: {
    color: Colors.textOnDark
  },
  actionBusy: {
    opacity: 0.7
  }
});
