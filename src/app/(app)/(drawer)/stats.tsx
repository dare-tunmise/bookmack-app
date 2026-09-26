import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/loans';

type Overview = Schemas['StatsOverview'];
type MonthlyCount = Schemas['MonthlyCount'];
type Year = Schemas['YearInBooks'];
type Loaded = { overview: Overview; months: MonthlyCount[]; year: Year };

const MONTHS = 12;
const CHART_HEIGHT = 140;

// "2026-09" → a date in the middle of that month, so local time zones can't shift it to another month.
const monthDate = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 15);
};

export default function StatsScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [overviewResult, monthsResult, yearResult] = await Promise.all([
        api.GET('/stats'),
        api.GET('/stats/loans-by-month', { params: { query: { months: MONTHS } } }),
        api.GET('/stats/year', { params: { query: {} } })
      ]);
      if (!overviewResult.data) throw toApiError(overviewResult.error);
      if (!monthsResult.data) throw toApiError(monthsResult.error);
      if (!yearResult.data) throw toApiError(yearResult.error);
      setData({
        overview: overviewResult.data.data,
        months: monthsResult.data.data,
        year: yearResult.data.data
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

  if (!data) {
    return (
      <ThemedView style={[styles.flex, styles.loading]}>
        {error ? (
          <>
            <FieldError message={error} />
            <Button title="Try again" variant="secondary" onPress={load} />
          </>
        ) : (
          <>
            <Skeleton width="100%" height={196} radius={Radius.card} />
            {/* One block, like the figures it stands in for: four rows of two. */}
            <Skeleton width="100%" height={368} radius={Radius.card} />
            <Skeleton width="100%" height={220} radius={Radius.card} />
          </>
        )}
      </ThemedView>
    );
  }

  const { overview, months, year } = data;
  const nothingYet = overview.books === 0 && overview.borrowers === 0 && months.every((month) => month.count === 0);

  // Ordered so the pairs that sit side by side belong together: what you own beside who borrows,
  // what is out beside what is late, and the two rates that only exist after a return last.
  const figures: Omit<FigureProps, 'style'>[] = [
    { value: overview.books.toLocaleString(), label: 'Books' },
    { value: overview.borrowers.toLocaleString(), label: 'Borrowers' },
    { value: overview.activeLoans.toLocaleString(), label: 'Lent out' },
    { value: overview.overdueLoans.toLocaleString(), label: 'Overdue', danger: overview.overdueLoans > 0 },
    { value: overview.booksReading.toLocaleString(), label: 'Reading now' },
    { value: overview.booksAddedThisMonth.toLocaleString(), label: 'Added this month' },
    {
      value: overview.averageLoanDays === null ? '—' : `${overview.averageLoanDays}`,
      unit: overview.averageLoanDays === null ? undefined : overview.averageLoanDays === 1 ? 'day' : 'days',
      label: 'Average loan',
      note: overview.averageLoanDays === null ? 'After your first return' : undefined
    },
    {
      value: overview.onTimeReturnRate === null ? '—' : `${Math.round(overview.onTimeReturnRate * 100)}%`,
      label: 'On-time returns',
      note: overview.onTimeReturnRate === null ? 'After your first return' : undefined
    }
  ];

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, nothingYet && styles.emptyContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[Colors.brand]}
          />
        }>
        {nothingYet ? (
          <EmptyState
            seed="no-stats"
            title="Nothing to show yet"
            message="Add books and lend them out, and your numbers will show up here."
          />
        ) : (
          <>
            <YearCard year={year} shelfSize={overview.books} />
            <Highlights year={year} />

            <View style={styles.figures}>
              {figures.map((figure, index) => (
                <Figure
                  key={figure.label}
                  {...figure}
                  // Lines between, never around: the block already has its own border, and a cell
                  // drawing its own edges would double every interior rule.
                  style={[index >= 2 && styles.figureRule, index % 2 === 1 && styles.figureColumnRule]}
                />
              ))}
            </View>

            <LoansChart months={months} />
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const RING_SIZE = 92;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// How much of the shelf has actually been read. A ratio that is already true, rather than
// progress towards a target: nobody set a reading goal, and inventing one to fill a ring would
// be the gamified nonsense this app is meant to avoid.
function ShelfRing({ read, total }: { read: number; total: number }) {
  const fraction = total > 0 ? Math.min(1, read / total) : 0;

  return (
    <View
      accessible
      accessibilityLabel={`${read} of ${total} books on your shelf read`}
      style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={Colors.brandTint}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {fraction > 0 ? (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={Colors.brand}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${fraction * RING_LENGTH} ${RING_LENGTH}`}
            // Start at the top rather than three o'clock.
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCentre} pointerEvents="none">
        <ThemedText style={styles.ringValue}>{total > 0 ? `${Math.round(fraction * 100)}%` : '—'}</ThemedText>
      </View>
    </View>
  );
}

function YearCard({ year, shelfSize }: { year: Year; shelfSize: number }) {
  return (
    <View style={styles.hero}>
      <ThemedText type="h3">{`Your ${year.year} in books`}</ThemedText>

      <View style={styles.heroBody}>
        <ShelfRing read={year.booksFinished} total={shelfSize} />
        <View style={styles.heroFigures}>
          <View style={styles.valueRow}>
            <ThemedText style={styles.heroValue}>{year.booksFinished.toLocaleString()}</ThemedText>
            <ThemedText style={styles.unit}>{year.booksFinished === 1 ? 'book' : 'books'}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {shelfSize > 0 ? `finished, of ${shelfSize.toLocaleString()} on your shelf` : 'finished this year'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.heroSplit}>
        <View style={styles.heroHalf}>
          <ThemedText style={styles.splitValue}>{year.pagesRead.toLocaleString()}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Pages read
          </ThemedText>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroHalf}>
          <ThemedText style={styles.splitValue}>{year.booksAdded.toLocaleString()}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Added this year
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

type Highlight = { icon: IconName; label: string; value: string; detail?: string };

// Only what the year actually contains: an empty row would be worse than a shorter card.
function Highlights({ year }: { year: Year }) {
  const rows: Highlight[] = [];

  if (year.topAuthor) {
    rows.push({
      icon: 'users',
      label: 'Most read',
      value: year.topAuthor.author,
      detail: `${year.topAuthor.count} ${year.topAuthor.count === 1 ? 'book' : 'books'}`
    });
  }
  if (year.longestBook) {
    rows.push({
      icon: 'stats',
      label: 'Longest',
      value: year.longestBook.title,
      detail: `${year.longestBook.pageCount.toLocaleString()} pages`
    });
  }
  if (year.highestRated) {
    rows.push({
      icon: 'star',
      label: 'Rated highest',
      value: year.highestRated.title,
      detail: '★'.repeat(year.highestRated.rating)
    });
  }
  if (year.mostNeglected) {
    rows.push({
      icon: 'clock',
      label: 'Waiting longest',
      value: year.mostNeglected.title,
      detail: `since ${formatDate(year.mostNeglected.addedAt)}`
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.row, index > 0 && styles.rowDivided]}>
          <Icon name={row.icon} color={Colors.brand} size={20} />
          <View style={styles.rowText}>
            <ThemedText type="small" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <ThemedText style={styles.rowValue} numberOfLines={1}>
              {row.value}
            </ThemedText>
          </View>
          {row.detail ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowDetail}>
              {row.detail}
            </ThemedText>
          ) : null}
        </View>
      ))}

      {year.longOwnedUnread > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          {year.longOwnedUnread === 1
            ? 'One book has been on your shelf over two years, still unread.'
            : `${year.longOwnedUnread} books have been on your shelf over two years, still unread.`}
        </ThemedText>
      ) : null}
    </View>
  );
}

type FigureProps = {
  value: string;
  label: string;
  unit?: string;
  note?: string;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
};

// One cell of the figures block. It draws no border of its own; the rules between cells are the
// caller's job, because only the caller knows which edges are interior.
function Figure({ value, label, unit, note, danger = false, style }: FigureProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={[styles.figure, style]}>
      <View style={styles.valueRow}>
        <ThemedText style={[styles.value, danger && styles.danger]}>{value}</ThemedText>
        {unit ? <ThemedText style={styles.unit}>{unit}</ThemedText> : null}
      </View>
      <ThemedText type="small" style={danger ? styles.danger : styles.label}>
        {label}
      </ThemedText>
      {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}
    </View>
  );
}

function LoansChart({ months }: { months: MonthlyCount[] }) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(0);
  const max = Math.max(1, ...months.map((month) => month.count));
  const total = months.reduce((sum, month) => sum + month.count, 0);

  useEffect(() => {
    grow.set(withTiming(1, { duration: reduceMotion ? 0 : 500, easing: Easing.out(Easing.cubic) }));
  }, [grow, reduceMotion]);

  // One style shared by every bar: they grow up from the baseline together.
  const barGrowth = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.get() }] }));

  return (
    <View style={styles.card}>
      <View style={styles.chartHeader}>
        <ThemedText type="h3">Loans by month</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`${total.toLocaleString()} in the last ${MONTHS} months`}
        </ThemedText>
      </View>

      <View style={styles.chart}>
        {months.map((month, index) => {
          const current = index === months.length - 1;
          const date = monthDate(month.month);
          const height = month.count === 0 ? 2 : Math.max(6, (month.count / max) * CHART_HEIGHT);
          return (
            <View
              key={month.month}
              accessible
              accessibilityLabel={`${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${month.count} ${month.count === 1 ? 'loan' : 'loans'}`}
              style={styles.column}>
              <ThemedText style={styles.count}>{month.count > 0 ? String(month.count) : ''}</ThemedText>
              <Animated.View
                style={[
                  styles.bar,
                  { height, backgroundColor: month.count === 0 ? Colors.border : current ? Colors.accent : Colors.brand },
                  barGrowth
                ]}
              />
              <ThemedText style={[styles.month, current && styles.monthCurrent]}>
                {date.toLocaleDateString(undefined, { month: 'narrow' })}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  loading: {
    gap: 16,
    padding: 20
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  // One block rather than eight cards: the numbers are a single set, and eight separate borders
  // made the screen read as eight unrelated things. overflow keeps the cells inside the radius.
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden'
  },
  // An exact half rather than a grown flex basis, so the interior rules line up down the block.
  figure: {
    width: '50%',
    gap: 2,
    padding: 16
  },
  figureRule: {
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  figureColumnRule: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border
  },
  card: {
    gap: 2,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  hero: {
    gap: Spacing.three,
    padding: 20,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE
  },
  ringCentre: {
    // Written out rather than spreading StyleSheet.absoluteFill, which is a registered style ID
    // in this version, not an object.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ringValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.text
  },
  heroFigures: {
    flex: 1,
    gap: 2
  },
  heroValue: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: Colors.text
  },
  heroSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  heroHalf: {
    flex: 1,
    gap: 2
  },
  heroDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.three,
    backgroundColor: Colors.border
  },
  splitValue: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  rowText: {
    flex: 1,
    gap: 1
  },
  rowValue: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text
  },
  rowDetail: {
    flexShrink: 0
  },
  footnote: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  value: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.text
  },
  unit: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  label: {
    color: Colors.textSecondary
  },
  danger: {
    color: Colors.danger
  },
  note: {
    marginTop: 2,
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.disabledText
  },
  chartHeader: {
    gap: 2,
    marginBottom: 16
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4
  },
  count: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textSecondary
  },
  bar: {
    alignSelf: 'stretch',
    borderRadius: 4,
    // Grow up from the baseline.
    transformOrigin: 'bottom'
  },
  month: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary
  },
  monthCurrent: {
    fontFamily: Fonts.bodyBold,
    color: Colors.text
  }
});
