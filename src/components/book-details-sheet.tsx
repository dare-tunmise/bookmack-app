import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BOOK_STATUS_BADGES } from '@/components/badge';
import { BookCover } from '@/components/book-cover';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoanCard } from '@/components/loan-card';
import { SegmentedControl } from '@/components/segmented-control';
import { useSnackbar } from '@/components/snackbar';
import { Skeleton } from '@/components/skeleton';
import { StarRating } from '@/components/star-rating';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type Book = Schemas['Book'];
type Loan = Schemas['Loan'];
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

type BookDetailsSheetProps = {
  // The book to show, or null to close the sheet.
  book: Book | null;
  onClose: () => void;
  // The book changed while the sheet is open (e.g. it was returned); the sheet keeps showing it.
  onChanged: (book: Book) => void;
  onDeleted: () => void;
};

export function BookDetailsSheet({ book, onClose, onChanged, onDeleted }: BookDetailsSheetProps) {
  // Keep showing the last book while the sheet slides closed.
  const [shownBook, setShownBook] = useState(book);
  if (book && book !== shownBook) setShownBook(book);

  return (
    <BottomSheet visible={book !== null} onClose={onClose}>
      {shownBook ? (
        <BookDetails
          // Start fresh (loan, errors) for another book or after the status changes.
          key={`${shownBook.id}:${shownBook.status}`}
          book={shownBook}
          onClose={onClose}
          onChanged={onChanged}
          onDeleted={onDeleted}
        />
      ) : null}
    </BottomSheet>
  );
}

type BookDetailsProps = Omit<BookDetailsSheetProps, 'book'> & { book: Book };

function BookDetails({ book, onClose, onChanged, onDeleted }: BookDetailsProps) {
  const onLoan = book.status === 'Loaned';
  // undefined while the open loan of a book on loan is loading.
  const [loan, setLoan] = useState<Loan | null | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(book.rating);
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>(book.readingStatus);
  const [page, setPage] = useState(book.currentPage ? String(book.currentPage) : '');
  // null while it is still loading, so the section can hold its place instead of appearing late.
  const [similar, setSimilar] = useState<Book[] | null>(null);
  const [note, setNote] = useState('');
  // undefined while loading; null when the last thing recorded carried no note. Only the newest
  // entry counts: once further progress is logged without one, the old note describes a place the
  // reader has already left, and showing it then would be worse than showing nothing.
  const [memory, setMemory] = useState<{ note: string; page: number } | null | undefined>(undefined);
  // The history itself. null while loading, so the trail can stay out of the way rather than
  // appearing late and shifting everything under your thumb.
  const [trail, setTrail] = useState<ReadingEntry[] | null>(null);

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
  // why this no longer bails out the moment the page is unchanged.
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

  // A lost book is a dead end: it cannot be lent and nothing else happens to it. Wanting it again
  // is the obvious next move, and this sheet is the one place you are already thinking about it.
  const snackbar = useSnackbar();
  const [wanting, setWanting] = useState(false);

  const wantAgain = async () => {
    setWanting(true);
    setError(null);
    try {
      const { data, error: apiError } = await api.POST('/wanted', {
        body: {
          title: book.title,
          author: book.author,
          thumbnail: book.thumbnail,
          isbn: book.isbn,
          publisher: book.publisher,
          publishedDate: book.publishedDate,
          pageCount: book.pageCount,
          description: book.description,
          language: book.language,
          subjects: book.subjects,
          reason: 'replacement',
          // So buying it puts this copy back on the shelf rather than adding a second one.
          replaces: book.id
        }
      });
      if (!data) throw toApiError(apiError);
      snackbar.show(`"${book.title}" is on your wanted list`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWanting(false);
    }
  };

  // Saves straight away, like rating a book on the web; puts the old rating back if saving fails.
  const rate = async (value: number) => {
    const previous = rating;
    setRating(value);
    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: { rating: value }
      });
      if (!data) throw toApiError(apiError);
      onChanged(data.data);
    } catch (err) {
      setRating(previous);
      setError(errorMessage(err));
    }
  };

  // Books closest to this one by meaning. Comes back empty until the shelf has been indexed, and
  // the sheet is perfectly useful without it, so a failure here is silent.
  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books/{id}/similar', { params: { path: { id: book.id }, query: { limit: 3 } } })
      .then(({ data }) => {
        if (!cancelled) setSimilar(data?.data ?? []);
      })
      // An empty list rather than null: leaving it loading would show skeletons forever.
      .catch(() => {
        if (!cancelled) setSimilar([]);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  // This book's reading history: the trail, and the note left at the newest point in it.
  //
  // Only the newest entry's note is surfaced as the memory. A note is about the place it was
  // written at, so once further progress is logged without one, the older note describes
  // somewhere the reader has already left.
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

  useEffect(() => {
    if (!onLoan) return;
    let cancelled = false;
    api
      .GET('/loans', { params: { query: { bookId: book.id, status: 'active', limit: 1 } } })
      .then(({ data, error: apiError }) => {
        if (!data) throw toApiError(apiError);
        if (!cancelled) setLoan(data.data[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoan(null);
        setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [book.id, onLoan]);

  const lend = () => {
    onClose();
    router.push({ pathname: '/lend', params: { bookId: book.id } });
  };

  const edit = () => {
    onClose();
    router.push({ pathname: '/edit-book', params: { id: book.id } });
  };

  const deleteBook = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    setError(null);
    try {
      const { error: apiError, response } = await api.DELETE('/books/{id}', { params: { path: { id: book.id } } });
      if (!response.ok) throw toApiError(apiError);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  const extendedLabel = EXTENDED_LABELS[readingStatus];
  const readingOptions: readonly { key: ReadingStatus; label: string }[] = extendedLabel
    ? [...READING_OPTIONS, { key: readingStatus, label: extendedLabel }]
    : READING_OPTIONS;

  const facts: [label: string, value: string | null][] = [
    // First, because "where did I put it" is the question this answers.
    ['Where it is', book.location],
    ['Category', book.category],
    ['Publisher', book.publisher],
    ['Published', book.publishedDate],
    ['Pages', book.pageCount ? String(book.pageCount) : null],
    ['ISBN', book.isbn13 ?? book.isbn],
    ['Language', book.language ? book.language.toUpperCase() : null],
    ['Added', formatDate(book.createdAt)]
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BookCover title={book.title} thumbnail={book.thumbnail} size={64} />
        <View style={styles.headline}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {book.title}
          </ThemedText>
          <ThemedText style={styles.caption}>
            {`${book.author} · ${BOOK_STATUS_BADGES[book.status].label}`}
          </ThemedText>
          {book.tags.length > 0 ? (
            <View style={styles.tags}>
              {book.tags.map((tag) => (
                <ThemedView key={tag} type="brandTint" style={styles.tag}>
                  <ThemedText type="caption">{tag}</ThemedText>
                </ThemedView>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.rating}>
        <ThemedText type="smallBold">Your rating</ThemedText>
        <StarRating label="Your rating" value={rating} onChange={rate} />
      </View>

      <View style={styles.reading}>
        <ThemedText type="smallBold">Reading</ThemedText>
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

        {/* Shown for finished books too: how a book went is worth seeing after it is done. */}
        <ReadingTrail entries={trail ?? []} />
      </View>

      {onLoan ? (
        loan === undefined ? (
          <Skeleton width="100%" height={140} radius={Radius.card} />
        ) : loan ? (
          <LoanCard loan={loan} onReturned={() => onChanged({ ...book, status: 'Available' })} />
        ) : null
      ) : (
        <View style={styles.actions}>
          <Button title="Lend this book" onPress={lend} disabled={book.status === 'Lost'} />
          {book.status === 'Lost' ? (
            <>
              <Button
                title="Add to my wanted list"
                variant="secondary"
                loading={wanting}
                onPress={wantAgain}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Marked as lost. Put it on your wanted list, or edit it to mark it available again.
              </ThemedText>
            </>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <ButtonGroup
          actions={[
            { label: 'Edit', onPress: edit },
            {
              label: 'Delete',
              tone: 'danger',
              onPress: () => setConfirmingDelete(true),
              loading: deleting,
              disabled: onLoan
            }
          ]}
        />
        {onLoan ? (
          <ThemedText type="small" themeColor="textSecondary">
            Mark the book returned before deleting it.
          </ThemedText>
        ) : null}
        {error ? <FieldError message={error} /> : null}
      </View>

      <ThemedView type="background" style={styles.facts}>
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
              <ThemedText type="small" style={styles.factValue}>
                {value}
              </ThemedText>
            </View>
          ))}
      </ThemedView>

      {book.notes ? (
        <View style={styles.about}>
          <ThemedText type="smallBold">Your notes</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {book.notes}
          </ThemedText>
        </View>
      ) : null}

      {book.description ? (
        <View style={styles.about}>
          <ThemedText type="smallBold">About this book</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {book.description}
          </ThemedText>
        </View>
      ) : null}

      {/* Space is held while this loads so it does not appear after you have moved on. Nothing is
          shown once it resolves empty, which is the honest answer for an unindexed shelf. */}
      {similar === null || similar.length > 0 ? (
        <View style={styles.about}>
          <ThemedText type="smallBold">More like this on your shelf</ThemedText>
          {similar === null
            ? [0, 1, 2].map((row) => (
              <View key={row} style={styles.similarRow}>
                <Skeleton width={SIMILAR_COVER} height={SIMILAR_COVER * 1.5} radius={Radius.cover} />
                <View style={styles.similarText}>
                  <Skeleton width="70%" height={14} radius={4} />
                  <Skeleton width="45%" height={12} radius={4} />
                </View>
              </View>
            ))
            : similar.map((other) => (
              <View key={other.id} style={styles.similarRow}>
                <BookCover title={other.title} thumbnail={other.thumbnail} size={SIMILAR_COVER} />
                <View style={styles.similarText}>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {other.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {other.author}
                  </ThemedText>
                </View>
              </View>
            ))}
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete this book?"
        message={`"${book.title}" will be removed from your library.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteBook}
        onCancel={() => setConfirmingDelete(false)}
      />
    </ScrollView>
  );
}

// Big enough to read as a book you might recognise rather than a footnote.
const SIMILAR_COVER = 56;

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0
  },
  content: {
    gap: 20,
    paddingBottom: Spacing.two
  },
  header: {
    flexDirection: 'row',
    gap: 14
  },
  headline: {
    flex: 1,
    gap: 4
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text
  },
  caption: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary
  },
  rating: {
    gap: 4
  },
  reading: {
    gap: Spacing.two
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
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill
  },
  actions: {
    gap: Spacing.two
  },
  facts: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.one
  },
  factValue: {
    flexShrink: 1,
    textAlign: 'right'
  },
  about: {
    gap: Spacing.one
  },
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two
  },
  similarText: {
    flex: 1,
    gap: 2
  }
});
