import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Book = Schemas['Book'];

// One question: what page are you on.
//
// What used to be here asked four things at once — a status control, a page, a note and a history
// to read — and it saved on every blur, so one evening with a novel left a row of edits behind it
// and buried the activity page. This asks for the page, on a keypad built for the job, and saves
// once, when you say so.
//
// Marking a book read is not a separate job either: type the last page and Save becomes "I
// finished it". That is now the only way to finish a book from here, which is why the
// Unread/Reading/Read control is gone rather than hidden somewhere else.
//
// Notes moved to the book, where they are read. A field asking what was happening, inside the
// sheet you open to type three digits, is a form about closing a book rather than closing it.

const MAX_DIGITS = 5;
// Past this a "page" is a typo, not a book. Only used when the catalogue has no page count.
const MAX_PAGE = 99999;

type Pending = { borrower: string } | null;

const percentOf = (page: number, total: number) => Math.round((page / total) * 100);

const ordinal = (n: number) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

type ReadingSheetProps = {
  visible: boolean;
  book: Book;
  onClose: () => void;
  // The book changed, so the shelf and the details behind this can catch up.
  onChanged: (book: Book) => void;
  // Somewhere to go when the catalogue's page count does not match the copy in your hand.
  onEditBook: () => void;
  // Offered only when someone is already waiting on this book, on the one screen where finishing
  // it has just become true.
  onLend?: () => void;
};

export function ReadingSheet({ visible, book, onClose, onChanged, onEditBook, onLend }: ReadingSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Remounted per book so nothing typed for one carries into the next. */}
      <Reading
        key={book.id}
        book={book}
        onClose={onClose}
        onChanged={onChanged}
        onEditBook={onEditBook}
        onLend={onLend}
      />
    </BottomSheet>
  );
}

function Reading({ book, onClose, onChanged, onEditBook, onLend }: Omit<ReadingSheetProps, 'visible'>) {
  const snackbar = useSnackbar();
  const [finished, setFinished] = useState(false);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(book.rating ?? 0);
  const [readThisYear, setReadThisYear] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  // useState, not useRef: the values are read during render to build the style, and a ref read in
  // render is exactly what the hooks rule forbids. This is how bottom-sheet.tsx holds its own.
  const [shake] = useState(() => new Animated.Value(0));
  const [caret] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // The caret is the only thing saying the keypad is live, since no system keyboard comes up. It
  // holds still for anyone who has asked for less motion.
  useEffect(() => {
    if (finished || reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 10, delay: 520, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 10, delay: 520, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [caret, finished, reduceMotion]);

  const total = book.pageCount ?? null;
  const savedPage = book.currentPage ?? 0;
  const value = typed ? Number(typed) : null;
  const over = value !== null && total !== null && value > total;
  const atEnd = value !== null && total !== null && value === total;
  const valid = value !== null && value >= 1 && value <= (total ?? MAX_PAGE);
  // While the number is impossible the bar holds where it was. Letting it run to 100% would say
  // the book was finished by a typo.
  const shown = valid && !over ? (value as number) : savedPage;

  const bump = useCallback(() => {
    if (reduceMotion) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start();
  }, [reduceMotion, shake]);

  const press = (key: string) => {
    setError(null);
    if (key === 'del') {
      setTyped((current) => current.slice(0, -1));
      return;
    }
    if (typed.length >= MAX_DIGITS) return;
    // A page cannot begin with a zero, and "0" alone is not a page.
    if (typed === '' && key === '0') return;
    const next = typed + key;
    setTyped(next);
    // Only on the digit that takes it past the end, not on every one after it.
    if (total !== null && Number(next) > total && Number(typed || '0') <= total) bump();
  };

  const markFinished = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: { readingStatus: 'read' }
      });
      if (!data) throw toApiError(apiError);
      onChanged(data.data);
      setFinished(true);
      // Both of these are only worth asking for once a book is actually finished, and neither is
      // allowed to hold the sheet up: it is already open and correct without them.
      api
        .GET('/stats', {})
        .then(({ data: stats }) => setReadThisYear(stats?.data?.booksReadThisYear ?? null))
        .catch(() => {});
      api
        .GET('/requests', { params: { query: { status: 'pending', limit: 50 } } })
        .then(({ data: requests }) => {
          const match = requests?.data?.find((request) => request.book?.id === book.id);
          setPending(match?.borrower ? { borrower: match.borrower.name } : null);
        })
        .catch(() => {});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const savePage = async () => {
    if (value === null || !valid || over) return;
    if (atEnd) return markFinished();

    const previous = book.currentPage ?? null;
    setSaving(true);
    setError(null);
    try {
      const { data, error: apiError } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        // Nothing else in the body. The server treats a reading-only update as reading rather
        // than as an edit, so turning pages no longer fills the activity timeline.
        body: { currentPage: value }
      });
      if (!data) throw toApiError(apiError);
      onChanged(data.data);
      onClose();
      // Undo instead of "are you sure": the save never stops to ask, and taking it back is one
      // tap on the message that says it happened.
      snackbar.show(total ? `Page ${value} · ${percentOf(value, total)}% read` : `Page ${value}`, {
        label: 'Undo',
        onPress: async () => {
          const { data: reverted } = await api.PATCH('/books/{id}', {
            params: { path: { id: book.id } },
            body: { currentPage: previous }
          });
          if (reverted) onChanged(reverted.data);
        }
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rate = async (next: number) => {
    const previous = stars;
    setStars(next);
    try {
      const { data } = await api.PATCH('/books/{id}', {
        params: { path: { id: book.id } },
        body: { rating: next }
      });
      if (data) onChanged(data.data);
    } catch {
      setStars(previous);
    }
  };

  if (finished) {
    return (
      <View style={styles.done}>
        <View style={styles.ring}>
          <Icon name="check" color={Colors.text} size={38} strokeWidth={3} />
        </View>
        <ThemedText type="subtitle" style={styles.doneTitle}>
          Finished
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.doneSub}>
          {book.title}
          {readThisYear ? ` · your ${ordinal(readThisYear)} book this year` : ''}
        </ThemedText>

        <ThemedText type="smallBold" style={styles.question}>
          How was it?
        </ThemedText>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
              onPress={() => rate(n)}
              style={styles.star}>
              <Icon name="star" size={36} color={n <= stars ? Colors.brand : Colors.border} filled={n <= stars} />
            </Pressable>
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.hint}>
          Optional. You can rate it later.
        </ThemedText>

        {pending && onLend ? (
          <View style={styles.request}>
            <View style={styles.avatar}>
              <ThemedText type="caption" style={styles.avatarText}>
                {pending.borrower.slice(0, 2).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.requestText}>
              {pending.borrower} asked to borrow this.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onLend();
              }}>
              <ThemedText type="smallBold" style={styles.lend}>
                Lend it
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.go, styles.goOn, styles.doneGo]}>
          <ThemedText type="button" style={styles.goOnText}>
            Done
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const canSave = valid && !over && !saving;

  return (
    <View style={styles.pad}>
      <View style={styles.head}>
        <BookCover title={book.title} thumbnail={book.thumbnail} size={34} />
        <View style={styles.headText}>
          <ThemedText type="h2" accessibilityRole="header">
            What page are you on?
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {book.title} · {book.author}
          </ThemedText>
        </View>
      </View>

      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.number,
          { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }
        ]}>
        <ThemedText style={[styles.digits, !typed && styles.digitsPlaceholder, over && styles.digitsError]}>
          {typed || String(savedPage)}
        </ThemedText>
        <Animated.View style={[styles.caret, { opacity: caret }]} />
      </Animated.View>

      {total ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.of}>
          of {total}
        </ThemedText>
      ) : null}

      {total ? (
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${Math.min(100, percentOf(shown, total))}%` }, over && styles.fillHeld]}
          />
        </View>
      ) : null}

      <View style={styles.caption}>
        {over ? (
          <>
            <ThemedText type="caption" themeColor="danger">
              This copy has {total} pages.
            </ThemedText>
            {/* The way out of the error, rather than leaving someone stuck with a page count the
                catalogue got wrong for the copy in their hand. */}
            <Pressable accessibilityRole="button" onPress={onEditBook}>
              <ThemedText type="caption" style={styles.fixLink}>
                Different edition?
              </ThemedText>
            </Pressable>
          </>
        ) : atEnd ? (
          <ThemedText type="caption" themeColor="textSecondary">
            That&apos;s the last page.
          </ThemedText>
        ) : total ? (
          <>
            <ThemedText type="caption" themeColor="textSecondary">
              {percentOf(shown, total)}% read
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {total - shown} pages to go
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="caption" themeColor="textSecondary">
              No page count on this book
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={onEditBook}>
              <ThemedText type="caption" style={styles.fixLink}>
                Add one
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>

      {error ? (
        <ThemedText type="caption" themeColor="danger" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.keys}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, index) =>
          key === '' ? (
            <View key={`gap${index}`} style={styles.key} />
          ) : (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
              {key === 'del' ? (
                <Icon name="backspace" color={Colors.text} size={28} />
              ) : (
                <ThemedText style={styles.keyText}>{key}</ThemedText>
              )}
            </Pressable>
          )
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={savePage}
        style={[styles.go, !canSave ? styles.goOff : styles.goOn]}>
        <ThemedText type="button" style={!canSave ? styles.goOffText : atEnd ? styles.goFinishText : styles.goOnText}>
          {!typed || over ? 'Save' : atEnd ? 'I finished it' : `Save page ${value}`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two
  },
  headText: {
    flex: 1,
    minWidth: 0
  },
  number: {
    height: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three
  },
  digits: {
    fontFamily: Fonts.display,
    fontSize: 84,
    lineHeight: 92,
    letterSpacing: -3,
    color: Colors.text
  },
  digitsPlaceholder: {
    color: Colors.disabledText
  },
  digitsError: {
    color: Colors.danger
  },
  caret: {
    width: 3,
    height: 66,
    borderRadius: 2,
    backgroundColor: Colors.brand,
    marginLeft: 5
  },
  of: {
    textAlign: 'center'
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandTint,
    overflow: 'hidden',
    marginTop: Spacing.three
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.brand
  },
  fillHeld: {
    backgroundColor: Colors.disabledText
  },
  caption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    minHeight: 20
  },
  fixLink: {
    color: Colors.brand,
    fontFamily: Fonts.bodyBold
  },
  error: {
    marginTop: Spacing.one
  },
  keys: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.three
  },
  key: {
    width: '33.33%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.input
  },
  keyPressed: {
    backgroundColor: Colors.brandTint
  },
  keyText: {
    fontFamily: Fonts.body,
    fontSize: 27,
    lineHeight: 34,
    color: Colors.text
  },
  go: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three
  },
  goOn: {
    backgroundColor: Colors.buttonPrimary
  },
  goOnText: {
    color: Colors.textOnDark
  },
  goFinishText: {
    color: Colors.accent
  },
  goOff: {
    backgroundColor: Colors.disabledSurface
  },
  goOffText: {
    color: Colors.disabledText
  },

  done: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four
  },
  ring: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one
  },
  doneTitle: {
    marginTop: Spacing.three
  },
  doneSub: {
    marginTop: Spacing.one,
    textAlign: 'center'
  },
  question: {
    marginTop: Spacing.four
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one
  },
  star: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center'
  },
  hint: {
    marginTop: Spacing.half
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Radius.input,
    padding: Spacing.two,
    marginTop: Spacing.four
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: Colors.brand,
    fontFamily: Fonts.bodyBold
  },
  requestText: {
    flex: 1
  },
  lend: {
    color: Colors.brand
  },
  doneGo: {
    width: '100%'
  }
});
