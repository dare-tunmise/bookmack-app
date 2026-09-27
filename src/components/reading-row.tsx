import { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type ReadingBook = Schemas['ReadingBook'];

const COVER = 56;
const DAY_MS = 24 * 60 * 60 * 1000;
// A book untouched for this long is not being read, it is sitting there. Two weeks is long enough
// that a busy fortnight does not get called a stall.
const STALL_DAYS = 14;
// Close enough to the end that telling someone the book is nearly free is worth doing.
const NEARLY_DONE_PAGES = 30;

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

// Drag along the book's length to say roughly where you are.
//
// Deliberately built from PanResponder and plain Views rather than a slider package: every slider
// worth using is a native module, and a native module ships by `eas build`, not `eas update` — it
// could never reach a phone through the preview channel. This is the whole point of the control,
// so it had to be something that can actually be delivered.
//
// Reading is the one thing people do daily, and a three-digit number is not how anyone knows where
// they are in a book. "About two thirds" is.
function Scrubber({
  page,
  total,
  onCommit
}: {
  page: number;
  total: number;
  onCommit: (page: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  // PanResponder closes over its callbacks once, so the live values are read through refs rather
  // than captured at creation — otherwise the first render's width and page are used for ever.
  const widthRef = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  const pageAt = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return pageRef.current;
    const ratio = Math.min(1, Math.max(0, x / w));
    return Math.round(ratio * total);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => setDragging(pageAt(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => setDragging(pageAt(event.nativeEvent.locationX)),
      onPanResponderRelease: (event) => {
        const next = pageAt(event.nativeEvent.locationX);
        setDragging(null);
        if (next !== pageRef.current) onCommit(next);
      },
      onPanResponderTerminate: () => setDragging(null)
    })
  ).current;

  const shown = dragging ?? page;
  const percent = total > 0 ? Math.min(100, Math.round((shown / total) * 100)) : 0;
  const fill: `${number}%` = `${percent}%`;

  const measure = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Page you are on"
      accessibilityValue={{ min: 0, max: total, now: shown }}
      // Generous vertical padding: the track is 6px and a thumb-sized target is not.
      style={styles.scrubber}
      onLayout={measure}
      {...responder.panHandlers}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fill }]} />
        {width > 0 ? <View style={[styles.thumb, { left: Math.max(0, (percent / 100) * width - 8) }]} /> : null}
      </View>
      <ThemedText type="caption" themeColor={dragging === null ? 'textSecondary' : 'text'}>
        {shown > 0 ? `Page ${shown} of ${total} · ${percent}%` : `${total} pages`}
      </ThemedText>
    </View>
  );
}

type ReadingRowProps = {
  row: ReadingBook;
  onPress: () => void;
  onSetPage: (page: number) => void;
};

export function ReadingRow({ row, onPress, onSetPage }: ReadingRowProps) {
  const { book, lastRead, waiting } = row;
  const total = book.pageCount ?? null;
  const page = book.currentPage ?? 0;
  const left = total === null ? null : Math.max(0, total - page);

  const stalledFor = lastRead ? daysSince(lastRead.at) : null;
  const stalled = stalledFor !== null && stalledFor >= STALL_DAYS;
  const nearlyDone = left !== null && page > 0 && left <= NEARLY_DONE_PAGES;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title} by ${book.author}`}
        onPress={onPress}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <BookCover title={book.title} thumbnail={book.thumbnail} size={COVER} />
        <View style={styles.headline}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {book.title}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {book.author}
          </ThemedText>
        </View>
        <Icon name="chevronRight" color={Colors.textSecondary} size={18} />
      </Pressable>

      {/* The note, at the moment it is useful: coming back to the book, not while logging. This is
          the whole reason it is worth writing one. */}
      {lastRead?.note ? (
        <View style={styles.note}>
          <ThemedText type="caption" themeColor="textSecondary">
            {`Page ${lastRead.page}, ${formatDate(lastRead.at)}`}
          </ThemedText>
          <ThemedText type="small" style={styles.noteText}>
            {lastRead.note}
          </ThemedText>
        </View>
      ) : null}

      {total ? (
        <Scrubber page={page} total={total} onCommit={onSetPage} />
      ) : (
        <ThemedText type="caption" themeColor="textSecondary">
          No page count for this copy, so there is nothing to drag along. Open it to type a page.
        </ThemedText>
      )}

      {/* At most one nudge, in order of how much it earns the interruption: someone waiting beats
          nearly finished, which beats a book going cold. Three lines at once is nagging. */}
      {waiting > 0 && nearlyDone ? (
        <Nudge
          tone="brand"
          text={`${left} pages to go, and ${waiting === 1 ? 'someone is' : `${waiting} people are`} waiting for it.`}
        />
      ) : waiting > 0 ? (
        <Nudge tone="brand" text={`${waiting === 1 ? 'Someone has' : `${waiting} people have`} asked to borrow this.`} />
      ) : nearlyDone ? (
        <Nudge tone="brand" text={`${left} pages to go.`} />
      ) : stalled ? (
        <Nudge tone="muted" text={`Last opened ${formatDate(lastRead!.at)}. Still reading it?`} />
      ) : null}
    </View>
  );
}

function Nudge({ text, tone }: { text: string; tone: 'brand' | 'muted' }) {
  return (
    <ThemedText type="caption" themeColor={tone === 'brand' ? 'brand' : 'textSecondary'}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three
  },
  pressed: {
    opacity: 0.7
  },
  headline: {
    flex: 1,
    gap: 2
  },
  note: {
    gap: 2,
    padding: Spacing.two,
    borderRadius: Radius.card,
    backgroundColor: Colors.brandTint
  },
  noteText: {
    fontStyle: 'italic'
  },
  scrubber: {
    gap: Spacing.one,
    paddingVertical: Spacing.one
  },
  track: {
    height: 6,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  fill: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brand
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.surface,
    backgroundColor: Colors.brand
  }
});
