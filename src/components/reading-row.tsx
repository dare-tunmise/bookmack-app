import { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type ReadingBook = Schemas['ReadingBook'];
type BookRequest = Schemas['BookRequest'];

const COVER = 56;
const DAY_MS = 24 * 60 * 60 * 1000;
// A book untouched this long is not being read, it is sitting there. Two weeks is long enough that
// a busy fortnight does not get called a stall.
const STALL_DAYS = 14;
// Close enough to the end that telling someone the book is nearly free is worth doing.
const NEARLY_DONE_PAGES = 30;
// Drag friction. One page per four pixels: a full thumb-length travel moves about forty pages, so
// you can settle on a number rather than fling past it. Big jumps belong in the sheet, where you
// can type.
const PIXELS_PER_PAGE = 4;
// Below this a drag is a tap, and the +/- buttons should get it.
const DRAG_THRESHOLD = 3;

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

// A crown, like the one you set a watch with. Drag it up or down and the page climbs or falls
// under your thumb; tap the ends to step one page.
//
// It replaced a scrubber along the book's length, which was the wrong control twice over. It
// mapped the absolute touch position to a page, so pressing anywhere *jumped* there — grabbing the
// bar at page 18 and landing on 53 before moving a millimetre. And a 700-page book across 300
// pixels is two pages per pixel, so no amount of care could land on a particular page.
//
// This is relative: where you grab means nothing, only how far you travel. That is the difference
// between a slider and a crown, and it is why a watch uses one.
function Crown({ page, total, onCommit }: { page: number; total: number; onCommit: (page: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);

  const clamp = (value: number) => Math.max(0, Math.min(total, Math.round(value)));

  // PanResponder builds its callbacks once, so everything they read has to come from a ref.
  // Capturing state directly leaves the control using the first render's values for ever.
  const pageRef = useRef(page);
  pageRef.current = page;
  const startRef = useRef(page);
  const draftRef = useRef<number | null>(null);

  const setDraftValue = (value: number | null) => {
    draftRef.current = value;
    setDraft(value);
  };

  const responder = useRef(
    PanResponder.create({
      // Not on touch down: the + and - underneath need taps. Only a real vertical movement is a
      // drag, which is what lets one control be both.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        startRef.current = pageRef.current;
        setDraftValue(pageRef.current);
      },
      onPanResponderMove: (_event, gesture) => {
        // Up is forwards. Screen y grows downwards, hence the negation.
        setDraftValue(clamp(startRef.current - gesture.dy / PIXELS_PER_PAGE));
      },
      onPanResponderRelease: () => {
        const next = draftRef.current;
        setDraftValue(null);
        if (next !== null && next !== pageRef.current) onCommit(next);
      },
      onPanResponderTerminate: () => setDraftValue(null)
    })
  ).current;

  const shown = draft ?? page;
  const step = (by: number) => {
    const next = clamp(pageRef.current + by);
    if (next !== pageRef.current) onCommit(next);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Page you are on"
      accessibilityValue={{ min: 0, max: total, now: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.crown}
      {...responder.panHandlers}>
      <Pressable accessibilityLabel="A page forward" hitSlop={4} onPress={() => step(1)} style={styles.crownEnd}>
        <Icon name="plus" color={Colors.textSecondary} size={16} strokeWidth={2.5} />
      </Pressable>

      <View style={[styles.crownFace, draft !== null && styles.crownFaceActive]}>
        <ThemedText type="smallBold" style={draft !== null ? styles.crownNumberActive : undefined}>
          {shown}
        </ThemedText>
      </View>

      <Pressable accessibilityLabel="A page back" hitSlop={4} onPress={() => step(-1)} style={styles.crownEnd}>
        <Icon name="minus" color={Colors.textSecondary} size={16} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

type ReadingRowProps = {
  row: ReadingBook;
  // The oldest pending request for this book, if anyone has asked for it.
  request: BookRequest | null;
  onPress: () => void;
  onSetPage: (page: number) => void;
  // Say yes to whoever is waiting, then go and lend it to them.
  onHandOver: (request: BookRequest) => void;
};

export function ReadingRow({ row, request, onPress, onSetPage, onHandOver }: ReadingRowProps) {
  const { book, lastRead, waiting } = row;
  const total = book.pageCount ?? null;
  const page = book.currentPage ?? 0;
  const left = total === null ? null : Math.max(0, total - page);

  const stalledFor = lastRead ? daysSince(lastRead.at) : null;
  const stalled = stalledFor !== null && stalledFor >= STALL_DAYS;
  const nearlyDone = left !== null && page > 0 && left <= NEARLY_DONE_PAGES;
  const percent = total && page > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;
  const fill: `${number}%` = `${percent}%`;
  const asker = request?.borrower?.name ?? 'Someone';

  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <View style={styles.main}>
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
          </Pressable>

          {/* The note, at the moment it is useful: coming back to the book, not while logging. */}
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
            <View style={styles.progress}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: fill }]} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {page > 0 ? `${percent}% · page ${page} of ${total}` : `${total} pages`}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="caption" themeColor="textSecondary">
              No page count for this copy. Open it to set one.
            </ThemedText>
          )}
        </View>

        {total ? <Crown page={page} total={total} onCommit={onSetPage} /> : null}
      </View>

      {/* At most one nudge, in the order of what earns the interruption: someone waiting for a book
          you are about to finish, then someone waiting, then nearly done, then going cold. */}
      {request && nearlyDone ? (
        <View style={styles.handOver}>
          <ThemedText type="caption" themeColor="brand">
            {`${left} pages to go, and ${asker} is waiting for it.`}
          </ThemedText>
          <Button title={`Tell ${asker} it's nearly free`} variant="secondary" onPress={() => onHandOver(request)} />
        </View>
      ) : request ? (
        <ThemedText type="caption" themeColor="brand">
          {`${asker} has asked to borrow this.`}
        </ThemedText>
      ) : waiting > 0 ? (
        <ThemedText type="caption" themeColor="brand">
          {`${waiting === 1 ? 'Someone has' : `${waiting} people have`} asked to borrow this.`}
        </ThemedText>
      ) : nearlyDone ? (
        <ThemedText type="caption" themeColor="brand">{`${left} pages to go.`}</ThemedText>
      ) : stalled ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {`Last opened ${formatDate(lastRead!.at)}. Still reading it?`}
        </ThemedText>
      ) : null}
    </View>
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three
  },
  main: {
    flex: 1,
    gap: Spacing.two
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
  progress: {
    gap: Spacing.one
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  fill: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brand
  },
  // A column you can put a thumb on: the ends step a page, the middle is the grip.
  crown: {
    width: 46,
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingVertical: Spacing.one
  },
  crownEnd: {
    height: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center'
  },
  crownFace: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border
  },
  crownFaceActive: {
    backgroundColor: Colors.brandTint
  },
  crownNumberActive: {
    color: Colors.brand
  },
  handOver: {
    gap: Spacing.two
  }
});
