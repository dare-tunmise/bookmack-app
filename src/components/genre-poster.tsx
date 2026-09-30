import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { BrandMark } from '@/components/brand-mark';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type Book = Schemas['Book'];

// Declared here rather than imported from the sheet. The sheet imports this component, so taking its
// type back would be a cycle — harmless for a type-only import today, and a real one the moment
// either file needs a value from the other.
export type GenreSelection = { name: string; count: number; colour: string };

// Composed at a fixed width so the saved image is the same on every phone. A poster that came out a
// different size on each device would not read as a poster.
const POSTER_WIDTH = 320;
const POSTER_PADDING = 20;
const GRID_GAP = 10;
const COLUMNS = 3;
const COVER = Math.floor((POSTER_WIDTH - POSTER_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);
// Three rows. A full grid reads as a collection; a ragged last row reads as a mistake.
const COVERS = COLUMNS * 3;

export function GenrePoster({
  genre,
  books,
  onClose
}: {
  genre: GenreSelection | null;
  books: Book[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const poster = useRef<View>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!genre) return null;

  // Books with a real cover first: a grid of typographic placeholders is honest but dull, and the
  // ones with art are what make this worth sharing.
  const covers = [...books]
    .sort((a, b) => Number(Boolean(b.thumbnail)) - Number(Boolean(a.thumbnail)))
    .slice(0, COVERS);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      // Imported here rather than at the top of the file on purpose. Both are native modules, so a
      // build that predates them would crash on a module-scope import the moment this screen opened.
      // Loading them inside the handler means the poster and sharing work everywhere, and only the
      // save reports that it needs a newer build.
      const { captureRef } = await import('react-native-view-shot');
      const MediaLibrary = await import('expo-media-library');

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setNotice('BookMack needs permission to save to your photos.');
        return;
      }

      const uri = await captureRef(poster, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      setNotice('Saved to your photos.');
    } catch {
      // Where an older build lands: the JS is here, the native side is not.
      setNotice('Saving needs the next app update. You can share it now, or take a screenshot.');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setNotice(null);
    try {
      await Share.share({
        message: `${genre.count} ${genre.name.toLowerCase()} ${genre.count === 1 ? 'book' : 'books'} on my shelf — kept with BookMack.`
      });
    } catch {
      // The system sheet was dismissed. Nothing to report.
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="close" color={Colors.text} size={24} />
          </Pressable>
          <ThemedText style={styles.barTitle}>Poster</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* collapsable={false} matters on Android: without it this View can be flattened away at
              render time and there is nothing left for the capture to point at. */}
          <View ref={poster} collapsable={false} style={styles.poster}>
            <View style={[styles.rule, { backgroundColor: genre.colour }]} />
            <View style={styles.posterBody}>
              <View style={styles.head}>
                <View style={[styles.swatch, { backgroundColor: genre.colour }]} />
                <ThemedText style={styles.genre} numberOfLines={1}>
                  {genre.name}
                </ThemedText>
              </View>

              <ThemedText style={styles.count}>{genre.count.toLocaleString()}</ThemedText>
              <ThemedText style={styles.countLabel}>
                {`${genre.count === 1 ? 'book' : 'books'} on my shelf`}
              </ThemedText>

              <View style={styles.grid}>
                {covers.map((book) => (
                  <BookCover key={book.id} title={book.title} thumbnail={book.thumbnail} size={COVER} />
                ))}
              </View>

              <View style={styles.footer}>
                <BrandMark size={24} />
                <ThemedText style={styles.wordmark}>BookMack</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={save}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}>
              <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save to photos'}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={share}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryLabel}>Share</ThemedText>
            </Pressable>
          </View>

          {notice ? <ThemedText style={styles.notice}>{notice}</ThemedText> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: Colors.background
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill
  },
  barTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  scroll: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
    paddingBottom: 24
  },
  pressed: {
    opacity: 0.7
  },
  disabled: {
    opacity: 0.6
  },
  // The artefact itself. A light ground rather than ink, because a cover placeholder can be ink too
  // and would disappear into it.
  poster: {
    width: POSTER_WIDTH,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    overflow: 'hidden'
  },
  rule: {
    height: 6
  },
  posterBody: {
    padding: POSTER_PADDING,
    gap: 2
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3
  },
  genre: {
    flexShrink: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: Colors.textSecondary
  },
  count: {
    marginTop: 6,
    fontFamily: Fonts.display,
    fontSize: 56,
    lineHeight: 58,
    color: Colors.text
  },
  countLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.textSecondary
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 16
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text
  },
  actions: {
    width: POSTER_WIDTH,
    gap: 10
  },
  primary: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text
  },
  primaryLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.textOnDark
  },
  secondary: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  secondaryLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.text
  },
  notice: {
    width: POSTER_WIDTH,
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: Colors.textSecondary
  }
});
