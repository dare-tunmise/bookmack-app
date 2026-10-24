import { Pressable, StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
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

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

type ReadingRowProps = {
  row: ReadingBook;
  // The oldest pending request for this book, if anyone has asked for it.
  request: BookRequest | null;
  onPress: () => void;
  // Opens the keypad. The row no longer edits the page itself — see the note on the removed
  // stepper below.
  onUpdatePage: () => void;
  // Say yes to whoever is waiting, then go and lend it to them.
  onHandOver: (request: BookRequest) => void;
};

export function ReadingRow({ row, request, onPress, onUpdatePage, onHandOver }: ReadingRowProps) {
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

        {/* This was a +/- stepper you could also drag. Every tap of it saved, so one sitting with
            a book wrote a dozen updates — a dozen rows in the reading history and, until the
            server stopped logging them, a dozen "edited this book" entries burying the activity
            page. A page is now typed once, on a keypad, and saved when you say so. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={total ? `Page ${page} of ${total}. Update your page.` : 'Update your page'}
          onPress={onUpdatePage}
          style={({ pressed }) => [styles.update, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="brand">
            {page > 0 ? page : 'Set page'}
          </ThemedText>
        </Pressable>
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
  // One tap target, not a control: it says where you are and opens the keypad.
  update: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background
  },
  handOver: {
    gap: Spacing.two
  }
});
