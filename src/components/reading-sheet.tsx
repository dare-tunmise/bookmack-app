import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SegmentedControl } from '@/components/segmented-control';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type Book = Schemas['Book'];
type ReadingEntry = Schemas['ReadingEntry'];
type ReadingStatus = Book['readingStatus'];

const READING_OPTIONS = [
  { key: 'unread', label: 'Unread' },
  { key: 'reading', label: 'Reading' },
  { key: 'read', label: 'Read' }
] as const satisfies readonly { key: ReadingStatus; label: string }[];

// Giving up on a book and starting one again are real states, but they are not how most books
// go. They appear in the control only once a book is actually in one, because four segments fit
// across a phone and five do not. You get into them from the buttons underneath instead.
const EXTENDED_LABELS: Partial<Record<ReadingStatus, string>> = {
  abandoned: 'Gave up',
  rereading: 'Again'
};

// Enough history to work out a pace from, without paging.
const TRAIL_LIMIT = 20;
// How many are shown before the rest are summarised. A sheet is not a log file.
const TRAIL_SHOWN = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

// Each row says why it exists, taken from the stored reason rather than inferred from the page.
// "Started page 0" is technically true and reads like a bug.
const entryLabel = (entry: ReadingEntry) => {
  if (entry.source === 'started') return 'Started reading';
  if (entry.source === 'restarted') return 'Started again';
  if (entry.source === 'finished') return 'Finished';
  return `Page ${entry.page}`;
};

// Pages the reader actually reported, over the days between reporting them.
//
// Two rules keep this honest, and both matter more than they look:
//
// Only this pass counts. A re-read starts again from zero, so entries before the restart
// describe a different journey through the book. The restart itself stays, as the anchor.
//
// Finishing is excluded. Marking a book read records its last page — a jump to the end that
// nobody sat and read at that moment. Counting it turns "I finally ticked it off a week later"
// into a heroic weekly page count, which is a lie told confidently.
//
// After that: two points and a full day are the minimum for the arithmetic to mean anything.
const paceText = (entries: ReadingEntry[]) => {
  const restartAt = entries.findIndex((entry) => entry.source === 'restarted');
  const pass = restartAt === -1 ? entries : entries.slice(0, restartAt + 1);
  const reported = pass.filter((entry) => entry.source !== 'finished');
  if (reported.length < 2) return null;

  const newest = reported[0];
  const oldest = reported[reported.length - 1];
  const pages = newest.page - oldest.page;
  const days = (new Date(newest.at).getTime() - new Date(oldest.at).getTime()) / DAY_MS;
  if (pages <= 0 || days < 1) return null;

  const perWeek = Math.round((pages / days) * 7);
  if (perWeek < 1) return null;
  return `About ${perWeek} ${perWeek === 1 ? 'page' : 'pages'} a week so far`;
};

// What actually happened with this book, newest first. Hidden entirely below two entries: a
// single row is not a trail, it is the moment you tapped "Reading".
function ReadingTrail({ entries }: { entries: ReadingEntry[] }) {
  if (entries.length < 2) return null;

  const shown = entries.slice(0, TRAIL_SHOWN);
  const pace = paceText(entries);

  return (
    <View style={styles.trail}>
      <ThemedText type="smallBold">How it has gone</ThemedText>

      {shown.map((entry, index) => (
        <View key={entry.id} style={styles.trailRow}>
          <View style={styles.trailMarker}>
            <View style={[styles.trailDot, index === 0 && styles.trailDotLatest]} />
            {index < shown.length - 1 ? <View style={styles.trailLine} /> : null}
          </View>
          <View style={styles.trailText}>
            <ThemedText type="small">{entryLabel(entry)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {formatDate(entry.at)}
            </ThemedText>
            {entry.note ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.trailNote}>
                {entry.note}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ))}

      {entries.length > TRAIL_SHOWN ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {`and ${entries.length - TRAIL_SHOWN} earlier`}
        </ThemedText>
      ) : null}

      {pace ? (
        <ThemedText type="small" themeColor="textSecondary">
          {pace}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ReadingSheetProps = {
  visible: boolean;
  book: Book;
  onClose: () => void;
  // The book changed, so the shelf, the reading strip and the details behind this can catch up.
  onChanged: (book: Book) => void;
};

// Everything about reading one book, in its own sheet.
//
// This used to sit inside the details sheet, between the rating and the loan card. Reading is the
// one part of a book's page you come back to repeatedly — a page number, a note, the trail — while
// the rest (publisher, ISBN, what it is about) is read once. Putting it behind its own sheet gives
// it the whole screen and leaves the details sheet scannable.
//
// It opens on top of the details sheet rather than replacing it, which is the same nesting the
// delete confirmation already does from in there.
export function ReadingSheet({ visible, book, onClose, onChanged }: ReadingSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Remount for a different book, or after the status changes, so no field keeps a stale
          value from the last one. */}
      <Reading key={`${book.id}:${book.readingStatus}`} book={book} onChanged={onChanged} />
    </BottomSheet>
  );
}

function Reading({ book, onChanged }: { book: Book; onChanged: (book: Book) => void }) {
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>(book.readingStatus);
  const [page, setPage] = useState(book.currentPage ? String(book.currentPage) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  // undefined while loading; null when the last thing recorded carried no note. Only the newest
  // entry counts: once further progress is logged without one, the old note describes a place the
  // reader has already left, and showing it then would be worse than showing nothing.
  const [memory, setMemory] = useState<{ note: string; page: number } | null | undefined>(undefined);
  // The history itself. null while loading, so the trail can stay out of the way rather than
  // appearing late and shifting everything under your thumb.
  const [trail, setTrail] = useState<ReadingEntry[] | null>(null);

  // This book's reading history: the trail, and the note left at the newest point in it.
  const loadReading = useCallback(() => {
    let cancelled = false;
    api
      .GET('/books/{id}/reading', { params: { path: { id: book.id }, query: { limit: TRAIL_LIMIT } } })
      .then(({ data }) => {
        if (cancelled) return;
        const entries = data?.data ?? [];
        setTrail(entries);
        const latest = entries[0];
        setMemory(latest?.note ? { note: latest.note, page: latest.page } : null);
      })
      // Nothing to show beats an error about a note: the rest of the sheet still works.
      .catch(() => {
        if (cancelled) return;
        setTrail([]);
        setMemory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => loadReading(), [loadReading]);

  // Like the rating: saves immediately and puts the old value back if it fails.
  const setReading = async (value: ReadingStatus) => {
    const previous = readingStatus;
    setReadingStatus(value);
    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: { readingStatus: value }
      });
      if (!data) throw toApiError(apiError);
      // The server fills in the dates, and clears the page once a book is finished.
      setPage(data.data.currentPage ? String(data.data.currentPage) : '');
      onChanged(data.data);
    } catch (err) {
      setReadingStatus(previous);
      setError(errorMessage(err));
    }
  };

  // The page and the note save together, because they are one act: "I stopped here, and this is
  // what was happening". A note has to reach the server even when the page has not moved, which is
  // why this does not bail out the moment the page is unchanged.
  const saveReading = async () => {
    const trimmed = page.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && !Number.isInteger(value)) return;

    const noteText = note.trim();
    const pageChanged = value !== (book.currentPage ?? null);
    if (!pageChanged && noteText === '') return;

    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: {
          ...(pageChanged ? { currentPage: value } : {}),
          ...(noteText === '' ? {} : { readingNote: noteText })
        }
      });
      if (!data) throw toApiError(apiError);
      onChanged(data.data);
      // What was just written becomes what you see on the way back in, and the field empties for
      // the next one. Set straight away so there is no gap while the refetch is in flight.
      if (noteText !== '') {
        setMemory({ note: noteText, page: value ?? book.currentPage ?? 0 });
        setNote('');
      }
      // The trail gained a row, so ask for it again rather than leaving it a step behind what
      // the reader just did.
      loadReading();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Re-reading a book is reading it, so it gets the same tools.
  const isReading = readingStatus === 'reading' || readingStatus === 'rereading';
  // Driven by what is typed, not by what is saved, so the bar moves under your thumb. That
  // immediate answer is the whole reason to bother entering a page.
  const typedPage = Number(page.trim());
  const pagesIn = Number.isFinite(typedPage) && typedPage > 0 ? Math.floor(typedPage) : 0;
  const total = book.pageCount ?? null;
  const percent = total ? Math.min(100, Math.round((pagesIn / total) * 100)) : 0;
  const fillWidth: `${number}%` = `${percent}%`;

  const extendedLabel = EXTENDED_LABELS[readingStatus];
  const readingOptions: readonly { key: ReadingStatus; label: string }[] = extendedLabel
    ? [...READING_OPTIONS, { key: readingStatus, label: extendedLabel }]
    : READING_OPTIONS;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Icon name="reading" color={Colors.brand} size={22} />
        <View style={styles.headline}>
          <ThemedText type="h2" accessibilityRole="header">
            Reading
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {book.title}
          </ThemedText>
        </View>
      </View>

      <SegmentedControl
        accessibilityLabel="Reading status"
        options={readingOptions}
        value={readingStatus}
        onChange={setReading}
      />

      {isReading ? (
        <>
          {memory ? (
            <View style={styles.memory}>
              <ThemedText type="caption" themeColor="textSecondary">
                You left off on page {memory.page}
              </ThemedText>
              <ThemedText type="small">{memory.note}</ThemedText>
            </View>
          ) : null}
          <TextField
            label="Page you're on"
            value={page}
            onChangeText={setPage}
            onBlur={saveReading}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={saveReading}
            hint={total ? `of ${total}` : 'Optional'}
          />
          {total ? (
            <View style={styles.progress}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: fillWidth }]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {pagesIn > 0 ? `${percent}% · ${total - pagesIn} pages to go` : `${total} pages`}
              </ThemedText>
            </View>
          ) : null}
          <TextField
            label="Note for next time"
            value={note}
            onChangeText={setNote}
            onBlur={saveReading}
            multiline
            hint="What was happening, so you can pick it up cold"
          />
        </>
      ) : null}

      {readingStatus === 'reading' ? (
        <Button title="I gave up on it" variant="secondary" onPress={() => setReading('abandoned')} />
      ) : null}
      {readingStatus === 'read' ? (
        <Button title="Read it again" variant="secondary" onPress={() => setReading('rereading')} />
      ) : null}

      {error ? <FieldError message={error} /> : null}

      {/* Shown for finished books too: how a book went is worth seeing after it is done. */}
      <ReadingTrail entries={trail ?? []} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.two
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two
  },
  headline: {
    flex: 1
  },
  progress: {
    gap: Spacing.one
  },
  track: {
    height: 6,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.brand
  },
  memory: {
    gap: 2,
    padding: Spacing.two,
    borderRadius: Radius.card,
    backgroundColor: Colors.brandTint
  },
  trail: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  trailRow: {
    flexDirection: 'row',
    gap: Spacing.two
  },
  // Fixed width so every row's text starts on the same line, and the connector can run down
  // the middle of the dots rather than wandering with the content.
  trailMarker: {
    width: 10,
    alignItems: 'center',
    paddingTop: 5
  },
  trailDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border
  },
  trailDotLatest: {
    backgroundColor: Colors.brand
  },
  trailLine: {
    flex: 1,
    width: 1,
    marginTop: 2,
    backgroundColor: Colors.border
  },
  trailText: {
    flex: 1,
    gap: 1,
    paddingBottom: Spacing.two
  },
  trailNote: {
    marginTop: 2,
    fontStyle: 'italic'
  }
});
