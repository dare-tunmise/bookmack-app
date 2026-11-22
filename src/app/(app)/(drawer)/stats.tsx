import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { AppBar } from '@/components/app-bar';
import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/icon';
import { MonthBars } from '@/components/month-bars';
import { ShareSheet } from '@/components/share-sheet';
import { Skeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/auth/session';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  MONTHS,
  deriveYear,
  genreLine,
  goalLine,
  initials,
  lendingLine,
  paceLine,
  type YearStats
} from '@/lib/year-stats';

type Overview = Schemas['StatsOverview'];
type Shelf = Schemas['YearShelf'];
type Loan = Schemas['Loan'];

// Stats with the noise taken out.
//
// One number against a goal, one chart you can scrub, and a few plain sentences. Everything here
// answers a question somebody would actually ask — am I on track, what did I read, who has my
// books — and anything that was only trivia is gone: the ribbon, the genre donut, the activity
// heatmap, the theme bars, the on-time meter and the tiles.
//
// The covers are the only colour on the page. That is deliberate: a palette per chart was what
// made the old screen look like a dashboard rather than something about books.

// The design's own greys, neither of which is a palette token: the row hairline is lighter than
// `border`, and faint text sits between `textSecondary` and `disabledText`.
const HAIRLINE = '#ECEFE8';
const FAINT = '#97A391';

// Darkest first, so the commonest genre is the strongest mark.
const RAMP = ['#163300', '#347821', '#6FA956', '#A9CF96', '#D3E6C8'];

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Loaded = { overview: Overview; shelf: Shelf; loans: Loan[] };

// "4 days late" or "Due back Friday": a weekday while it is still this week, a date after that,
// because "due back Tuesday" three weeks out tells you nothing.
function loanStatus(loan: Loan, now: Date) {
  const due = new Date(loan.dueAt);
  const days = Math.floor((now.getTime() - due.getTime()) / DAY_MS);
  if (loan.status === 'overdue' || days > 0) {
    return { text: days <= 0 ? 'Due back today' : `${days} day${days === 1 ? '' : 's'} late`, late: days > 0 };
  }
  const ahead = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  if (ahead <= 6) return { text: `Due back ${WEEKDAYS[due.getDay()]}`, late: false };
  return { text: `Due back ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, late: false };
}

export default function StatsScreen() {
  const navigation = useNavigation();
  const snackbar = useSnackbar();
  const { user } = useSession();

  const now = useMemo(() => new Date(), []);
  const thisYear = now.getUTCFullYear();
  const firstYear = user?.createdAt ? new Date(user.createdAt).getUTCFullYear() : thisYear;

  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(now.getUTCMonth());
  const [sharing, setSharing] = useState(false);
  const [nudged, setNudged] = useState<string[]>([]);

  const load = useCallback(
    async (forYear: number, mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const [overview, shelf, loans] = await Promise.all([
          api.GET('/stats', {}),
          api.GET('/stats/year/shelf', { params: { query: { year: forYear } } }),
          api.GET('/loans', { params: { query: { status: 'active', limit: 20 } } })
        ]);
        if (!overview.data) throw toApiError(overview.error);
        if (!shelf.data) throw toApiError(shelf.error);
        setData({
          overview: overview.data.data,
          shelf: shelf.data.data,
          // Who has your books is the one part that can be missing without the page being wrong.
          loans: loans.data?.data ?? []
        });
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load(year);
    }, [load, year])
  );

  useEffect(() => {
    // The plain action rather than DrawerActions.openDrawer(): @react-navigation/native is only a
    // transitive dependency here, and importing from a package this app never declared is how a
    // working build breaks on someone else's install.
    const openDrawer = () => navigation.dispatch({ type: 'OPEN_DRAWER' });
    navigation.setOptions({
      header: () => <AppBar title="Stats" left={{ icon: 'menu', label: 'Open menu', onPress: openDrawer }} />
    });
  }, [navigation]);

  const stats: YearStats | null = useMemo(() => (data ? deriveYear(data.shelf, now) : null), [data, now]);

  // Overdue first, then soonest due. At most two, as the design asks — this is a glance, and the
  // Loans screen is one tap away for the rest.
  const showing = useMemo(() => {
    const open = data?.loans.filter((loan) => loan.book && loan.borrower) ?? [];
    return [...open]
      .sort((a, b) => {
        const late = Number(b.status === 'overdue') - Number(a.status === 'overdue');
        return late || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      })
      .slice(0, 2);
  }, [data]);

  const nudge = async (loan: Loan) => {
    setNudged((sent) => [...sent, loan.id]);
    try {
      const { error: apiError, response } = await api.POST('/loans/{id}/reminder/send', {
        params: { path: { id: loan.id } }
      });
      if (!response.ok) throw toApiError(apiError);
      snackbar.show(`Reminder sent to ${loan.borrower?.name ?? 'them'}`);
    } catch (err) {
      // Put the button back: a "Sent" that never sent is worse than an error.
      setNudged((sent) => sent.filter((id) => id !== loan.id));
      snackbar.show(errorMessage(err));
    }
  };

  if (!data || !stats) {
    return (
      <ThemedView style={styles.flex}>
        <View style={styles.loading}>
          {error ? (
            <>
              <FieldError message={error} />
              <Pressable accessibilityRole="button" onPress={() => load(year)}>
                <ThemedText style={styles.link}>Try again</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Skeleton width="60%" height={104} radius={Radius.card} />
              <Skeleton width="100%" height={98} radius={Radius.card} />
              <Skeleton width="100%" height={180} radius={Radius.card} />
            </>
          )}
        </View>
      </ThemedView>
    );
  }

  // The open month is derived, not stored: stepping back to a year that ended in June must not
  // leave the list pointing at November. Holding it in state and correcting it in an effect
  // works, but it renders twice and the lint rule is right to object — `month` keeps what was
  // asked for, and this is what the page can actually show.
  const openMonth = Math.min(month, stats.lastMonth);

  const goal = user?.readingGoal ?? null;
  const caption = goalLine(stats, goal, now);
  const genre = genreLine(stats);
  const lending = lendingLine(stats, now);
  const inMonth = stats.books.filter((book) => new Date(book.finishedAt).getUTCMonth() === openMonth);
  // What is on the shelf and not read: the books that are neither finished nor in progress. The
  // API counts those three separately rather than serving "unread", so it is subtraction here.
  const unread = Math.max(0, data.overview.books - data.overview.booksRead - data.overview.booksReading);
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'My';

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(year, 'refresh')} colors={[Colors.brand]} />
        }>
        {error ? <FieldError message={error} /> : null}

        <View style={styles.headRow}>
          <View style={styles.yearRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous year"
              disabled={year <= firstYear}
              onPress={() => setYear((current) => current - 1)}
              style={({ pressed }) => [styles.step, (pressed || year <= firstYear) && styles.stepDim]}>
              <Icon name="chevronLeft" color={Colors.text} size={20} />
            </Pressable>
            <ThemedText style={styles.yearValue}>{year}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next year"
              disabled={year >= thisYear}
              onPress={() => setYear((current) => current + 1)}
              style={({ pressed }) => [styles.step, (pressed || year >= thisYear) && styles.stepDim]}>
              <Icon name="chevronRight" color={Colors.text} size={20} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setSharing(true)}
            style={({ pressed }) => [styles.sharePill, pressed && styles.pressed]}>
            <Icon name="share" color={Colors.text} size={19} />
            <ThemedText style={styles.shareLabel}>Share</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.label}>Books finished</ThemedText>
        <View style={styles.bigRow}>
          <ThemedText style={styles.bigNumber}>{stats.count}</ThemedText>
          {goal ? <ThemedText style={styles.bigOf}>{`of ${goal}`}</ThemedText> : null}
        </View>

        {goal ? (
          <>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${Math.min(100, (stats.count / goal) * 100)}%` }]} />
            </View>
            {caption ? <ThemedText style={styles.caption}>{caption}</ThemedText> : null}
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/reading-goal')}>
            <ThemedText style={[styles.link, styles.captionLink]}>Set a goal</ThemedText>
          </Pressable>
        )}

        <View style={styles.trio}>
          <View style={styles.trioCell}>
            <ThemedText style={styles.trioValue}>{stats.pages.toLocaleString('en-GB')}</ThemedText>
            <ThemedText style={styles.trioLabel}>pages</ThemedText>
          </View>
          <View style={styles.trioCell}>
            <ThemedText style={styles.trioValue}>{stats.daysPerBook ?? '—'}</ThemedText>
            <ThemedText style={styles.trioLabel}>days per book</ThemedText>
          </View>
          <View style={styles.trioCell}>
            <ThemedText style={styles.trioValue}>{stats.pagesPerDay}</ThemedText>
            <ThemedText style={styles.trioLabel}>pages a day</ThemedText>
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <ThemedText style={styles.blockTitle}>By month</ThemedText>
            <ThemedText style={styles.selected}>
              {`${MONTHS[openMonth]} · ${inMonth.length ? `${inMonth.length} book${inMonth.length === 1 ? '' : 's'}` : 'none'}`}
            </ThemedText>
          </View>

          <MonthBars counts={stats.byMonth} selected={openMonth} lastMonth={stats.lastMonth} onSelect={setMonth} />

          <View style={styles.list}>
            {inMonth.length ? (
              inMonth.map((book, position) => (
                <View key={book.id} style={[styles.row, position > 0 && styles.rowDivided]}>
                  <BookCover title={book.title} thumbnail={book.thumbnail} author={book.author} size={40} />
                  <View style={styles.rowText}>
                    <ThemedText numberOfLines={2} style={styles.rowTitle}>
                      {book.title}
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={styles.rowAuthor}>
                      {book.author}
                    </ThemedText>
                  </View>
                  {typeof book.days === 'number' ? (
                    <ThemedText style={styles.rowDays}>{`${book.days} day${book.days === 1 ? '' : 's'}`}</ThemedText>
                  ) : null}
                </View>
              ))
            ) : (
              <ThemedText style={styles.empty}>{`Nothing finished in ${MONTHS[openMonth]}.`}</ThemedText>
            )}
          </View>
        </View>

        {genre ? (
          <View style={styles.block}>
            <ThemedText style={styles.blockTitle}>What you read</ThemedText>
            <ThemedText style={styles.say}>
              {genre.lead}
              <ThemedText style={styles.sayFigure}>{genre.figure}</ThemedText>
              {genre.tail}
            </ThemedText>
            <View style={styles.genreBar}>
              {stats.genres.slice(0, RAMP.length).map((entry, position) => (
                <View
                  key={entry.genre}
                  style={{ flexGrow: entry.count, flexShrink: 1, flexBasis: 0, borderRadius: 3, backgroundColor: RAMP[position] }}
                />
              ))}
            </View>
            <View style={styles.legend}>
              {stats.genres.slice(0, RAMP.length).map((entry, position) => (
                <View key={entry.genre} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: RAMP[position] }]} />
                  <ThemedText style={styles.legendText}>
                    {`${entry.genre} `}
                    <ThemedText style={styles.legendCount}>{entry.count}</ThemedText>
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <ThemedText style={styles.blockTitle}>Lending</ThemedText>
          <ThemedText style={styles.say}>
            {lending.lead}
            <ThemedText style={styles.sayFigure}>{lending.figure}</ThemedText>
            {lending.tail}
          </ThemedText>
        </View>

        <View style={styles.rightNow}>
          <ThemedText style={styles.blockTitle}>Right now</ThemedText>

          {showing.length ? (
            <View style={styles.nowList}>
              {showing.map((loan, position) => {
                const status = loanStatus(loan, now);
                const sent = nudged.includes(loan.id);
                return (
                  <View key={loan.id} style={[styles.out, position > 0 && styles.rowDivided]}>
                    <View style={styles.avatar}>
                      <ThemedText style={styles.avatarText}>{initials(loan.borrower?.name ?? '?')}</ThemedText>
                    </View>
                    <View style={styles.rowText}>
                      <ThemedText numberOfLines={1} style={styles.outTitle}>
                        {`${loan.borrower?.name} has ${loan.book?.title}`}
                      </ThemedText>
                      <ThemedText style={[styles.outStatus, status.late && styles.outLate]}>{status.text}</ThemedText>
                    </View>
                    {status.late ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={sent ? 'Reminder sent' : `Nudge ${loan.borrower?.name}`}
                        disabled={sent}
                        onPress={() => nudge(loan)}
                        style={({ pressed }) => [styles.nudge, sent && styles.nudgeSent, pressed && styles.pressed]}>
                        <Icon name={sent ? 'check' : 'bell'} color={sent ? Colors.text : Colors.textOnDark} size={16} />
                        <ThemedText style={[styles.nudgeLabel, sent && styles.nudgeLabelSent]}>
                          {sent ? 'Sent' : 'Nudge'}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <ThemedText style={styles.empty}>Nothing is out on loan.</ThemedText>
          )}

          {data.overview.activeLoans > showing.length ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/loans')} style={styles.allRow}>
              <ThemedText style={styles.link}>{`See all ${data.overview.activeLoans} lent out`}</ThemedText>
            </Pressable>
          ) : null}

          {unread > 0 ? (
            <>
              <ThemedText style={[styles.say, styles.unread]}>
                <ThemedText style={styles.sayFigure}>{unread}</ThemedText>
                {` of your ${data.overview.books.toLocaleString('en-GB')} books are unread.`}
              </ThemedText>
              {paceLine(unread, stats.count) ? (
                <ThemedText style={styles.sub}>{paceLine(unread, stats.count)}</ThemedText>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <ShareSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        stats={stats}
        handle="bookmack.com"
        title={`${firstName}’s ${stats.year}`}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { gap: Spacing.three, padding: Spacing.three },
  content: {
    paddingHorizontal: Spacing.three + 8,
    paddingTop: 2,
    paddingBottom: 128,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: -10 },
  yearRow: { flexDirection: 'row', alignItems: 'center' },
  step: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepDim: { opacity: 0.25 },
  yearValue: { fontFamily: Fonts.bodyBold, fontSize: 15, lineHeight: 20, minWidth: 44, textAlign: 'center' },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingLeft: 13,
    paddingRight: 16,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  shareLabel: { fontFamily: Fonts.bodyBold, fontSize: 14, lineHeight: 18, color: Colors.text },

  label: { fontFamily: Fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: Colors.textSecondary, marginTop: 20 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  bigNumber: { fontFamily: Fonts.display, fontSize: 104, lineHeight: 96, letterSpacing: -4, color: Colors.text },
  bigOf: { fontFamily: Fonts.bodySemiBold, fontSize: 22, lineHeight: 28, color: Colors.textSecondary },

  goalTrack: { marginTop: 18, height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.text },
  caption: { fontFamily: Fonts.body, fontSize: 14.5, lineHeight: 21, color: Colors.textSecondary, marginTop: 12 },
  captionLink: { marginTop: 14 },
  link: { fontFamily: Fonts.bodyBold, fontSize: 14, lineHeight: 20, color: Colors.brand },

  trio: {
    flexDirection: 'row',
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  trioCell: { flex: 1 },
  trioValue: { fontFamily: Fonts.heading, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: Colors.text },
  trioLabel: { fontFamily: Fonts.body, fontSize: 12.5, lineHeight: 18, color: Colors.textSecondary },

  block: { marginTop: 42 },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  blockTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  selected: { fontFamily: Fonts.bodyBold, fontSize: 14, lineHeight: 18, color: Colors.text },

  list: { marginTop: 16, minHeight: 80 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10 },
  rowDivided: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, lineHeight: 19, color: Colors.text },
  rowAuthor: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  rowDays: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, color: Colors.textSecondary, paddingLeft: 10 },
  empty: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 20, color: FAINT, paddingVertical: 12 },

  say: {
    fontFamily: Fonts.heading,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: Colors.text,
    marginTop: 8
  },
  sayFigure: { color: Colors.brand },
  genreBar: { flexDirection: 'row', gap: 3, height: 10, marginTop: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  legendCount: { fontFamily: Fonts.bodyBold, color: Colors.text },

  rightNow: { marginTop: 46, paddingTop: 24, borderTopWidth: 1, borderTopColor: Colors.border },
  nowList: { marginTop: 6 },
  out: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontFamily: Fonts.bodyBold, fontSize: 13, lineHeight: 18, color: Colors.text },
  outTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, lineHeight: 19, color: Colors.text },
  outStatus: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  outLate: { fontFamily: Fonts.bodySemiBold, color: Colors.danger },
  nudge: {
    marginLeft: 'auto',
    height: 36,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    backgroundColor: Colors.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  nudgeSent: { backgroundColor: Colors.brandTint },
  nudgeLabel: { fontFamily: Fonts.bodyBold, fontSize: 13.5, lineHeight: 18, color: Colors.textOnDark },
  nudgeLabelSent: { color: Colors.text },
  allRow: { height: 40, justifyContent: 'center', marginTop: 6 },
  unread: { marginTop: 22 },
  sub: { fontFamily: Fonts.body, fontSize: 14.5, lineHeight: 21, color: Colors.textSecondary, marginTop: 6 },

  pressed: { opacity: 0.85 }
});
