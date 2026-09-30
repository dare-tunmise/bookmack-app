import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BOOK_STATUS_BADGES } from '@/components/badge';
import { BookCover } from '@/components/book-cover';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Icon } from '@/components/icon';
import { LoanCard } from '@/components/loan-card';
import { ReadingSheet } from '@/components/reading-sheet';
import { useSnackbar } from '@/components/snackbar';
import { Skeleton } from '@/components/skeleton';
import { StarRating } from '@/components/star-rating';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type Book = Schemas['Book'];
type Loan = Schemas['Loan'];
type ReadingStatus = Book['readingStatus'];

// What the summary row says for each state. The controls themselves live in the reading sheet.
const READING_LABELS: Record<ReadingStatus, string> = {
  unread: 'Not started',
  reading: 'Reading',
  read: 'Read',
  abandoned: 'Gave up',
  rereading: 'Reading again'
};


// Publishers sometimes fill the description field with the book's reviews rather than a description.
// Detected by the ATTRIBUTIONS rather than by length, because length alone would misfire on the long
// descriptions that are genuinely about the book: two or more "--Source" sign-offs is a review
// roundup, and an ordinary blurb has none at all.
const ATTRIBUTION = /--\s*[A-Z]/g;
const looksLikePressQuotes = (text: string) => (text.match(ATTRIBUTION) ?? []).length >= 2;

// '' arrives from a bad export upstream and lands mid-word ("Kooser''s"), where it reads as the
// owner's own typo. Repaired on the way to the screen; the stored text is left alone, because the
// catalogue's copy is not ours to rewrite.
const tidyBlurb = (text: string) => text.replace(/''/g, '’').trim();

type BookDetailsSheetProps = {
  // The book to show, or null to close the sheet.
  book: Book | null;
  onClose: () => void;
  // The book changed while the sheet is open (e.g. it was returned); the sheet keeps showing it.
  onChanged: (book: Book) => void;
  onDeleted: () => void;
  // Tapping a theme shows the rest of the shelf about the same thing. Optional on purpose: a sheet
  // opened somewhere with no shelf to filter should show its themes as plain labels rather than
  // offer a press that goes nowhere.
  onFilterByTheme?: (theme: string) => void;
  // How many books on the shelf share a theme, so a chip can say whether tapping it leads anywhere.
  // Returns 0 when the counts have not loaded, which reads as "not yet known" and leaves the chip a
  // plain label rather than a link that might go nowhere.
  countForTheme?: (theme: string) => number;
};

export function BookDetailsSheet({
  book,
  onClose,
  onChanged,
  onDeleted,
  onFilterByTheme,
  countForTheme
}: BookDetailsSheetProps) {
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
          onFilterByTheme={onFilterByTheme}
          countForTheme={countForTheme}
        />
      ) : null}
    </BottomSheet>
  );
}

type BookDetailsProps = Omit<BookDetailsSheetProps, 'book'> & { book: Book };

function BookDetails({ book, onClose, onChanged, onDeleted, onFilterByTheme, countForTheme }: BookDetailsProps) {
  const onLoan = book.status === 'Loaned';
  // undefined while the open loan of a book on loan is loading.
  const [loan, setLoan] = useState<Loan | null | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(book.rating);
  // null while it is still loading, so the section can hold its place instead of appearing late.
  const [similar, setSimilar] = useState<Book[] | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);

  // Enough to say where the book is up to. Unlike the sheet's own bar, this one follows what is
  // saved rather than what is being typed — there is nothing to type here.
  const isReading = book.readingStatus === 'reading' || book.readingStatus === 'rereading';
  const total = book.pageCount ?? null;
  const pagesIn = book.currentPage ?? 0;
  const percent = total && pagesIn > 0 ? Math.min(100, Math.round((pagesIn / total) * 100)) : 0;
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

  // What the book is about, compressed from its own catalog text by the API. Null for a book whose
  // sources said too little, which is most of the ones with no description and few subjects.
  const about = book.about;
  // The publisher's blurb when there is one, otherwise the compressed version. Never both:
  // about.text is a compression OF the description, so showing the two together says the same thing
  // twice — but a book catalogued with headings and no blurb still has one summary worth reading.
  //
  // Unless the "description" is a press-quote dump, in which case the compression is the better text
  // by a distance. Measured on this shelf: Delights & Shadows carries 3,986 characters of eleven
  // review blurbs run together and not one sentence about the poems, while its `about` opens "finds
  // metaphysical themes and quiet wonder in ordinary details of daily life".
  const blurb = book.description ? tidyBlurb(book.description) : null;
  const summary = blurb && !looksLikePressQuotes(blurb) ? blurb : about?.text ?? blurb;
  // Form, period and setting on one line. A fact row each would bury them; together they read like
  // the spine of the book.
  const aboutContext = about
    ? [about.form, about.period, about.places.join(', ') || null].filter(Boolean).join(' · ')
    : '';

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // The sheet already reads as scrollable from its handle and the content running past the
      // edge; a bar tracking down the side of a card is just noise.
      showsVerticalScrollIndicator={false}>
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
                  {/* 14 with a 2.5 stroke, matching Chip's leading icon: at 12 it read as a smudge
                      rather than a tag, and the two sizes made the same glyph look like two. */}
                  <Icon name="tag" color={Colors.text} size={14} strokeWidth={2.5} />
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

      {/* Reading used to be this whole block — status, page, note, trail — wedged between the
          rating and the loan card. It is the one part you come back to repeatedly, so it gets its
          own sheet and leaves a single row here saying where the book is up to. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${READING_LABELS[book.readingStatus]}. Open reading`}
        onPress={() => setReadingOpen(true)}
        style={({ pressed }) => [styles.readingRow, pressed && styles.readingRowPressed]}>
        <Icon name="reading" color={Colors.brand} size={20} />
        <View style={styles.readingText}>
          <ThemedText type="smallBold">{READING_LABELS[book.readingStatus]}</ThemedText>
          {isReading && total ? (
            <View style={styles.progress}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: fillWidth }]} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {pagesIn > 0 ? `Page ${pagesIn} of ${total} · ${percent}%` : `${total} pages`}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="caption" themeColor="textSecondary">
              Progress, a note for next time, and how it has gone
            </ThemedText>
          )}
        </View>
        <Icon name="chevronRight" color={Colors.textSecondary} size={20} />
      </Pressable>

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

      {/* The themes are the part worth scanning, so they sit above the prose rather than under it.
          They are the catalog's words, not the owner's, which is why they are bordered rather than
          tinted like the tags in the header. */}
      {about && (about.themes.length > 0 || aboutContext) ? (
        <View style={styles.about}>
          {/* A string expression rather than bare JSX text: react/no-unescaped-entities rejects the
              apostrophe, and the &apos; it suggests would render literally in React Native. */}
          <ThemedText type="smallBold">{"What it's about"}</ThemedText>
          {aboutContext ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {aboutContext}
            </ThemedText>
          ) : null}
          {about.themes.length > 0 ? (
            <View style={styles.themes}>
              {about.themes.map((theme) => {
                // Most themes belong to one book — measured, 439 of 558 on a real shelf — because
                // each book was described without seeing the vocabulary already on the shelf. Tapping
                // one of those can only return the book you are already looking at, which reads as
                // broken. So a theme only becomes a link when it genuinely leads somewhere, and says
                // how far: "colonialism 13". The rest stay labels.
                const shared = countForTheme?.(theme) ?? 0;
                const leadsSomewhere = shared > 1 && Boolean(onFilterByTheme);
                const content = (
                  <>
                    <Icon name="tag" color={Colors.textSecondary} size={14} strokeWidth={2.5} />
                    <ThemedText type="caption">{theme}</ThemedText>
                    {leadsSomewhere ? (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {shared}
                      </ThemedText>
                    ) : null}
                  </>
                );

                return leadsSomewhere ? (
                  <Pressable
                    key={theme}
                    accessibilityRole="button"
                    accessibilityLabel={`Show the ${shared} books about ${theme}`}
                    onPress={() => onFilterByTheme?.(theme)}
                    style={({ pressed }) => [styles.themeChip, pressed && styles.themeChipPressed]}>
                    {content}
                  </Pressable>
                ) : (
                  <View key={theme} style={styles.themeChip}>
                    {content}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {summary ? (
        <View style={styles.about}>
          <ThemedText type="smallBold">About this book</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summary}
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

      {/* Opens over this sheet rather than replacing it, the same nesting the delete
          confirmation below already relies on. */}
      <ReadingSheet
        visible={readingOpen}
        book={book}
        onClose={() => setReadingOpen(false)}
        onChanged={onChanged}
        // Both sheets close on the way out, or the reader comes back from editing to a stack of
        // them still sitting open behind the screen they just left.
        onEditBook={() => {
          setReadingOpen(false);
          edit();
        }}
      />

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
  // One tappable row rather than a section: state, how far in, and a chevron into the sheet.
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.background
  },
  readingRowPressed: {
    opacity: 0.7
  },
  readingText: {
    flex: 1,
    gap: Spacing.one
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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill
  },
  themes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.half
  },
  // Same size as a tag so the sheet keeps one pill idiom, but outlined instead of tinted: these are
  // the catalog's words about the book, not the owner's words about their copy.
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  themeChipPressed: {
    backgroundColor: Colors.brandTint,
    borderColor: Colors.brandTint
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
