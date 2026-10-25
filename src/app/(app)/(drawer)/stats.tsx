import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { AppBar } from '@/components/app-bar';
import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/icon';
import { SegmentedControl } from '@/components/segmented-control';
import { Skeleton } from '@/components/skeleton';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YearShelf } from '@/components/year-shelf';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

type Overview = Schemas['StatsOverview'];
type YearShelfData = Schemas['YearShelf'];
type ActivityDay = Schemas['ActivityDay'];

// Stats that look like what they are measuring.
//
// The year shelf is the only big visual, and it could not belong to any other app because the
// marks are the books. Everything under it is written in sentences — "You've finished 24 books"
// reads like a person talking, "Books: 24" reads like a database — and the sections are divided
// by space and hairlines rather than boxed into cards, which is the thing that makes a screen
// feel like a dashboard instead of a page.
//
// What this replaced: a grid of number tiles, a donut, a heatmap and a loans-per-month bar chart,
// each inside its own card. Every one of them was a chart you have seen in ten other apps.

const WEEKS = 53;
const RIBBON_HEIGHT = 64;
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Genre is a category, so it gets colours that stay apart from one another. Deliberately not the
// jacket palette: those are meant to look like books, and these are meant to look like a key.
const GENRE_COLORS = ['#227E00', '#1A5EC2', '#BB8800', '#812B8F', '#00919F', '#8A9784'];

type Range = 'year' | 'all';

const RANGES = [
  { key: 'year', label: String(new Date().getFullYear()) },
  { key: 'all', label: 'All time' }
] as const satisfies readonly { key: Range; label: string }[];

// `at` is when this was fetched. Everything time-based reads from it rather than calling the
// clock while rendering, so a re-render cannot quietly change the numbers under the reader.
type Loaded = { overview: Overview; shelf: YearShelfData; activity: ActivityDay[]; at: number };

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

export default function StatsScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>('year');
  const [shelfWidth, setShelfWidth] = useState(0);
  const [ribbonWidth, setRibbonWidth] = useState(0);
  // The drawer layout renders one AppBar for every screen. This screen needs the range toggle in
  // it, so it hands the layout a header rather than drawing a second bar underneath the first —
  // which is exactly what made the page start halfway down.
  const navigation = useNavigation();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [overview, shelf, activity] = await Promise.all([
        api.GET('/stats', {}),
        api.GET('/stats/year/shelf', { params: { query: {} } }),
        api.GET('/stats/activity', { params: { query: { weeks: WEEKS } } })
      ]);
      if (!overview.data) throw toApiError(overview.error);
      if (!shelf.data) throw toApiError(shelf.error);
      setData({
        overview: overview.data.data,
        shelf: shelf.data.data,
        // The ribbon is the one part that can be missing without the screen being wrong.
        activity: activity.data?.data ?? [],
        at: Date.now()
      });
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    // The plain action rather than DrawerActions.openDrawer(): @react-navigation/native is a
    // transitive dependency here, and importing from a package this app never declared is how a
    // working build breaks on someone else's install.
    const openDrawer = () => navigation.dispatch({ type: 'OPEN_DRAWER' });

    navigation.setOptions({
      header: () => (
        <AppBar left={{ icon: 'menu', label: 'Open menu', onPress: openDrawer }}>
          <View style={styles.barRow}>
            <ThemedText type="subtitle" accessibilityRole="header" numberOfLines={1} style={styles.barTitle}>
              Stats
            </ThemedText>
            {/* A fixed width, because the control sizes its segments from its own measured width —
                left to flex against a title it collapsed to a sliver. */}
            <View style={styles.range}>
              <SegmentedControl accessibilityLabel="Range" options={RANGES} value={range} onChange={setRange} />
            </View>
          </View>
        </AppBar>
      )
    });
  }, [navigation, range]);

  const weeks = useMemo(() => buildWeeks(data?.activity ?? [], data?.shelf.year, data?.at), [data]);
  const monthPages = useMemo(() => {
    const totals = Array<number>(12).fill(0);
    weeks.forEach((week) => {
      totals[week.month] += week.pages;
    });
    return totals;
  }, [weeks]);

  if (!data) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.loading}>
          {error ? <FieldError message={error} /> : <Skeleton width="100%" height={320} radius={Radius.card} />}
        </View>
      </ThemedView>
    );
  }

  const { overview, shelf } = data;
  const thisYear = range === 'year';
  const books = shelf.books;

  const finished = thisYear ? overview.booksReadThisYear : overview.booksRead;
  const pages = thisYear ? books.reduce((sum, book) => sum + (book.pageCount ?? 0), 0) : overview.pagesRead;
  const daysIn = Math.max(1, Math.round((data.at - Date.UTC(shelf.year, 0, 1)) / 86400000));
  const perDay = thisYear && pages ? Math.round(pages / daysIn) : null;

  // Where each month starts in the ribbon and how many weeks it owns, so its letter can sit over
  // its own bars.
  const monthSpans: { month: number; start: number; weeks: number }[] = [];
  weeks.forEach((week, index) => {
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.month === week.month) last.weeks += 1;
    else monthSpans.push({ month: week.month, start: index, weeks: 1 });
  });

  const bestMonth = monthPages.indexOf(Math.max(...monthPages));
  const hasMonths = monthPages[bestMonth] > 0;
  const peak = Math.max(...weeks.map((week) => week.pages), 1);

  const highlights = buildHighlights(books);
  const genres = buildGenres(books);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} colors={[Colors.brand]} />
        }>
        {error ? <FieldError message={error} /> : null}

        <View
          style={styles.hero}
          onLayout={(event) => setShelfWidth(event.nativeEvent.layout.width - Spacing.three * 2)}>
          <ThemedText type="caption" style={styles.eyebrow}>
            {thisYear ? `${shelf.year} so far` : 'Since you started'}
          </ThemedText>

          <ThemedText style={styles.heroHeadline}>
            You&apos;ve finished{' '}
            <ThemedText style={styles.heroCount}>
              {finished} {plural(finished, 'book')}.
            </ThemedText>
          </ThemedText>

          <ThemedText type="small" style={styles.heroSub}>
            <ThemedText type="small" style={styles.heroSubStrong}>
              {pages.toLocaleString()} pages
            </ThemedText>
            {perDay ? `, about ${perDay.toLocaleString()} a day.` : '.'}
          </ThemedText>

          {thisYear && books.length > 0 ? (
            <>
              {shelfWidth > 0 ? (
                <View style={styles.shelfWrap}>
                  <YearShelf books={books} width={shelfWidth} height={92} labelColor="#9DB48C" />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/poster')}
                style={({ pressed }) => [styles.make, pressed && styles.pressed]}>
                <Icon name="stats" color="#163300" size={19} />
                <ThemedText type="button" style={styles.makeText}>
                  Make a poster of your year
                </ThemedText>
              </Pressable>
              <ThemedText type="caption" style={styles.heroNote}>
                Each spine is a book, as thick as its page count.
              </ThemedText>
            </>
          ) : thisYear ? (
            <ThemedText type="small" style={styles.heroNote}>
              Finish a book and your year starts taking shape here.
            </ThemedText>
          ) : (
            <ThemedText type="caption" style={styles.heroNote}>
              The shelf is drawn one year at a time. Switch to {shelf.year} to see it.
            </ThemedText>
          )}
        </View>

        {thisYear && highlights.length ? (
          <Section eyebrow="Highlights">
            <View style={styles.highlights}>
              {highlights.map((item) => (
                <View key={item.key} style={styles.highlight}>
                  <BookCover title={item.book.title} thumbnail={item.book.thumbnail} size={30} />
                  <View style={styles.highlightText}>
                    <ThemedText type="caption" style={styles.kicker}>
                      {item.key}
                    </ThemedText>
                    <ThemedText type="smallBold" numberOfLines={2}>
                      {item.book.title}
                    </ThemedText>
                  </View>
                  <View style={styles.highlightValue}>
                    <ThemedText style={styles.valueNumber}>{item.value}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {item.unit}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {hasMonths ? (
          <Section eyebrow="When you read">
            <Sentence>
              Your best month was <Em>{MONTH_NAMES[bestMonth]}</Em>, with {monthPages[bestMonth].toLocaleString()}{' '}
              pages.
            </Sentence>
            <View
              style={styles.ribbon}
              onLayout={(event) => setRibbonWidth(event.nativeEvent.layout.width)}>
              {ribbonWidth > 0 ? (
                <>
                  {/* Drawn in real pixels against the measured width. It used to be a viewBox at
                      width="100%", which with the default preserveAspectRatio letterboxes rather
                      than fills — the bars ended up small and floating in the middle of the box. */}
                  <Svg width={ribbonWidth} height={RIBBON_HEIGHT}>
                    {weeks.map((week, index) => {
                      const slot = ribbonWidth / weeks.length;
                      const height = week.pages ? Math.max(2, (week.pages / peak) * (RIBBON_HEIGHT - 4)) : 0;
                      return (
                        <Rect
                          key={index}
                          x={index * slot + slot * 0.12}
                          y={RIBBON_HEIGHT - height}
                          width={Math.max(1.5, slot * 0.76)}
                          height={height}
                          rx={1.5}
                          // One month is coloured because it is the story. Colouring all twelve
                          // would say nothing at all.
                          fill={week.month === bestMonth ? Colors.brand : '#C9D6C0'}
                        />
                      );
                    })}
                  </Svg>

                  {/* A letter sits over the middle of its own weeks, so it points at its bars.
                      Twelve evenly-spaced letters under a ribbon that stops in October lined up
                      with nothing. */}
                  <View style={styles.months}>
                    {monthSpans.map((span) => (
                      <ThemedText
                        key={span.month}
                        type="caption"
                        themeColor="textSecondary"
                        style={[
                          styles.month,
                          { left: (span.start + span.weeks / 2) * (ribbonWidth / weeks.length) - 6 }
                        ]}>
                        {MONTH_LETTERS[span.month]}
                      </ThemedText>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </Section>
        ) : null}

        {thisYear && genres.length ? (
          <Section eyebrow="What you read">
            <Sentence>
              Mostly <Em>{genres[0].name.toLowerCase()}</Em>
              {genres[1]
                ? `, with ${genres[1].count} ${plural(genres[1].count, 'book')} of ${genres[1].name.toLowerCase()}.`
                : '.'}
            </Sentence>

            <View style={styles.genreBar}>
              {genres.map((genre, index) => (
                <View
                  key={genre.name}
                  style={{ flex: genre.count, backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length] }}
                />
              ))}
            </View>

            <View style={styles.genreLegend}>
              {genres.map((genre, index) => (
                <View key={genre.name} style={styles.genreItem}>
                  <View style={[styles.dot, { backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length] }]} />
                  <ThemedText type="small" style={styles.genreName} numberOfLines={1}>
                    {genre.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.genreCount}>
                    {genre.count}
                  </ThemedText>
                </View>
              ))}
            </View>

            {shelf.themes.length ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.themesLead}>
                  The themes that kept coming back
                </ThemedText>
                <View style={styles.themes}>
                  {shelf.themes.map((theme) => (
                    <View key={theme.theme} style={styles.theme}>
                      <ThemedText type="small" numberOfLines={1} style={styles.themeName}>
                        {theme.theme}
                      </ThemedText>
                      <View style={styles.themeTrack}>
                        <View
                          style={[
                            styles.themeFill,
                            { width: `${Math.round((theme.count / shelf.themes[0].count) * 100)}%` }
                          ]}
                        />
                      </View>
                      <ThemedText type="caption" themeColor="textSecondary" style={styles.themeCount}>
                        {theme.count}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </Section>
        ) : null}

        {shelf.lending.loans > 0 ? (
          <Section eyebrow="Lending">
            <Sentence>
              <Em>
                {shelf.lending.friends} {plural(shelf.lending.friends, 'friend')}
              </Em>{' '}
              borrowed {shelf.lending.loans} of your books this year.
            </Sentence>

            {shelf.lending.onTimeRate !== null ? (
              <>
                <View style={styles.meter}>
                  <View style={[styles.meterFill, { width: `${Math.round(shelf.lending.onTimeRate * 100)}%` }]} />
                </View>
                <View style={styles.meterCaption}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {Math.round(shelf.lending.onTimeRate * 100)}% came back on time
                  </ThemedText>
                  {shelf.lending.averageDays !== null ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {Math.round(shelf.lending.averageDays)} days on average
                    </ThemedText>
                  ) : null}
                </View>
              </>
            ) : (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.nothingBack}>
                Nothing has come back yet.
              </ThemedText>
            )}

            <View style={styles.borrowers}>
              {shelf.lending.topBorrowers.map((borrower) => (
                <View key={borrower.name} style={styles.borrower}>
                  <View style={styles.avatar}>
                    <ThemedText type="caption" style={styles.avatarText}>
                      {borrower.name.slice(0, 2).toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={styles.borrowerName} numberOfLines={1}>
                    {borrower.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {borrower.count} {plural(borrower.count, 'book')}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <ThemedText type="caption" themeColor="textSecondary" style={styles.foot}>
          {overview.books.toLocaleString()} on the shelf ·{' '}
          {Math.max(0, overview.books - overview.booksRead).toLocaleString()} not read yet · {overview.activeLoans} out
          right now
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="caption" style={styles.sectionEyebrow}>
        {eyebrow.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function Sentence({ children }: { children: React.ReactNode }) {
  return <ThemedText style={styles.sentence}>{children}</ThemedText>;
}

function Em({ children }: { children: React.ReactNode }) {
  return <ThemedText style={styles.em}>{children}</ThemedText>;
}

// Days to weeks, each week keeping its month so one can be picked out of the ribbon. Weeks with
// no reading stay in as gaps rather than being dropped: a quiet fortnight is part of the shape of
// a year, and closing it up would draw a year nobody had.
function buildWeeks(activity: ActivityDay[], year?: number, now?: number) {
  if (!year || !now) return [];
  const byDay = new Map(activity.map((day) => [day.date, day.pages]));
  const start = Date.UTC(year, 0, 1);
  const weeks: { month: number; pages: number }[] = [];

  for (let index = 0; start + index * 7 * 86400000 <= now && weeks.length < WEEKS; index += 1) {
    const weekStart = new Date(start + index * 7 * 86400000);
    let pages = 0;
    for (let day = 0; day < 7; day += 1) {
      pages += byDay.get(new Date(weekStart.getTime() + day * 86400000).toISOString().slice(0, 10)) ?? 0;
    }
    weeks.push({ month: weekStart.getUTCMonth(), pages });
  }
  return weeks;
}

type Highlight = { key: string; book: YearShelfData['books'][number]; value: string; unit: string };

// Four facts about the year, each anchored to a book you can see. Every one is left out rather
// than faked when what it needs is missing: a "quickest" worked out from books that were never
// started would just be whichever one the catalogue knew least about.
function buildHighlights(books: YearShelfData['books']): Highlight[] {
  if (!books.length) return [];
  const out: Highlight[] = [];

  const withPages = books.filter((book) => book.pageCount);
  if (withPages.length) {
    const longest = [...withPages].sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0))[0];
    out.push({ key: 'Longest', book: longest, value: (longest.pageCount ?? 0).toLocaleString(), unit: 'pages' });
  }

  const timed = books.filter((book) => book.days !== null);
  if (timed.length) {
    const quickest = [...timed].sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
    out.push({
      key: 'Quickest',
      book: quickest,
      value: String(quickest.days),
      unit: plural(quickest.days ?? 0, 'day')
    });

    const slowest = [...timed].sort((a, b) => (b.days ?? 0) - (a.days ?? 0))[0];
    // Only when it is a different book and genuinely took a while: "took its time, 1 month" about
    // the book that was also the quickest is not a highlight.
    if (slowest.id !== quickest.id && (slowest.days ?? 0) >= 30) {
      const months = Math.round((slowest.days ?? 0) / 30);
      out.push({ key: 'Took its time', book: slowest, value: String(months), unit: plural(months, 'month') });
    }
  }

  const lent = [...books].sort((a, b) => b.timesLent - a.timesLent)[0];
  if (lent.timesLent > 0) {
    out.push({
      key: 'Lent the most',
      book: lent,
      value: String(lent.timesLent),
      unit: plural(lent.timesLent, 'time')
    });
  }

  return out;
}

function buildGenres(books: YearShelfData['books']) {
  const counts = new Map<string, number>();
  books.forEach((book) => {
    if (book.category) counts.set(book.category, (counts.get(book.category) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, GENRE_COLORS.length)
    .map(([name, count]) => ({ name, count }));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  loading: {
    padding: Spacing.three
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two
  },
  barTitle: {
    flex: 1,
    minWidth: 0
  },
  range: {
    width: 176,
    flexShrink: 0
  },
  content: {
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },

  hero: {
    backgroundColor: Colors.buttonPrimary,
    borderBottomLeftRadius: Radius.sheet,
    borderBottomRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four
  },
  eyebrow: {
    color: Colors.accent,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 1.4
  },
  heroHeadline: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.2,
    color: '#F2F8EC',
    marginTop: Spacing.two
  },
  heroCount: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.2,
    color: Colors.accent
  },
  heroSub: {
    color: '#A9C29A',
    marginTop: Spacing.two
  },
  heroSubStrong: {
    color: '#F2F8EC',
    fontFamily: Fonts.bodySemiBold
  },
  shelfWrap: {
    marginTop: Spacing.four
  },
  make: {
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four
  },
  pressed: {
    opacity: 0.85
  },
  makeText: {
    color: '#163300'
  },
  heroNote: {
    color: '#89A178',
    textAlign: 'center',
    marginTop: Spacing.three
  },

  section: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five
  },
  sectionEyebrow: {
    color: Colors.brand,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 1.4
  },
  sentence: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: Colors.text,
    marginTop: Spacing.two
  },
  em: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: Colors.brand
  },

  highlights: {
    marginTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border
  },
  highlightText: {
    flex: 1,
    minWidth: 0
  },
  kicker: {
    color: Colors.disabledText,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 1
  },
  highlightValue: {
    alignItems: 'flex-end'
  },
  valueNumber: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 23,
    color: Colors.text
  },

  ribbon: {
    marginTop: Spacing.three
  },
  months: {
    height: 18,
    marginTop: Spacing.one
  },
  month: {
    position: 'absolute',
    width: 12,
    textAlign: 'center'
  },

  genreBar: {
    flexDirection: 'row',
    height: 16,
    gap: 2,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: Spacing.three
  },
  genreLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.two
  },
  genreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '50%',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.two
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 3
  },
  genreName: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold
  },
  genreCount: {
    fontFamily: Fonts.bodySemiBold,
    fontVariant: ['tabular-nums']
  },
  themesLead: {
    marginTop: Spacing.four
  },
  themes: {
    marginTop: Spacing.two,
    gap: Spacing.two
  },
  theme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two
  },
  themeName: {
    width: 120,
    fontFamily: Fonts.bodySemiBold
  },
  themeTrack: {
    flex: 1
  },
  themeFill: {
    height: 6,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: Colors.brand
  },
  themeCount: {
    width: 22,
    textAlign: 'right',
    fontVariant: ['tabular-nums']
  },

  meter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brandTint,
    overflow: 'hidden',
    marginTop: Spacing.three
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.brand
  },
  meterCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two
  },
  nothingBack: {
    marginTop: Spacing.three
  },
  borrowers: {
    marginTop: Spacing.two
  },
  borrower: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: Colors.brand,
    fontFamily: Fonts.bodyBold
  },
  borrowerName: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold
  },

  foot: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five
  }
});
