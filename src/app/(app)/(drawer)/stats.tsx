import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useAppActions } from '@/components/app-actions';
import { Button } from '@/components/button';
import { GenreSheet, type GenreSelection } from '@/components/genre-sheet';
import { Skeleton } from '@/components/skeleton';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chart, Colors, Fonts, MaxContentWidth, Radius } from '@/constants/theme';

type Overview = Schemas['StatsOverview'];
type MonthlyCount = Schemas['MonthlyCount'];
type Year = Schemas['YearInBooks'];
type Facets = Schemas['BookFacets'];
type Genres = Schemas['GenreBreakdown'];
type ActivityDay = Schemas['ActivityDay'];
type Loaded = {
  overview: Overview;
  months: MonthlyCount[];
  year: Year;
  facets: Facets;
  genres: Genres;
  activity: ActivityDay[];
};

const MONTHS = 12;
// How many theme bars the card shows before "See all".
const THEME_ROWS = 6;
// The heatmap's span, and the identity slots the donut has before the tail folds into Other.
const WEEKS = 18;
const GENRE_SLOTS = 5;

// "2026-09" → a date mid-month, so a local time zone cannot shift it into another month.
const monthDate = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 15);
};

type Range = 'year' | 'all';

export default function StatsScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>('year');
  // The slice that was tapped. Its colour travels into the sheet, so the two screens read as the
  // same thing rather than two views that happen to share a word.
  const [openGenre, setOpenGenre] = useState<GenreSelection | null>(null);
  const { openAdd } = useAppActions();

  const load = useCallback(async () => {
    try {
      const [overview, months, year, facets, genres, activity] = await Promise.all([
        api.GET('/stats'),
        api.GET('/stats/loans-by-month', { params: { query: { months: MONTHS } } }),
        api.GET('/stats/year', { params: { query: {} } }),
        api.GET('/books/facets'),
        api.GET('/stats/genres'),
        api.GET('/stats/activity', { params: { query: { weeks: WEEKS } } })
      ]);
      if (!overview.data) throw toApiError(overview.error);
      if (!months.data) throw toApiError(months.error);
      if (!year.data) throw toApiError(year.error);
      if (!facets.data) throw toApiError(facets.error);
      if (!genres.data) throw toApiError(genres.error);
      if (!activity.data) throw toApiError(activity.error);
      setData({
        overview: overview.data.data,
        months: months.data.data,
        year: year.data.data,
        facets: facets.data.data,
        genres: genres.data.data,
        activity: activity.data.data
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
      <ThemedView style={[styles.screen, styles.loading]}>
        {error ? (
          <>
            <FieldError message={error} />
            <Button title="Try again" variant="secondary" onPress={load} />
          </>
        ) : (
          <>
            <Skeleton width="100%" height={132} radius={Radius.card} />
            <Skeleton width="100%" height={156} radius={Radius.card} />
            <Skeleton width="100%" height={188} radius={Radius.card} />
          </>
        )}
      </ThemedView>
    );
  }

  const { overview, months, year, facets, genres, activity } = data;

  // No zeroed charts: an empty donut reads as broken rather than as new, so a shelf with almost
  // nothing on it gets one illustration and one way forward.
  if (overview.books < 3 && overview.booksRead === 0) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyStats onAdd={openAdd} />
      </ThemedView>
    );
  }

  const thisYear = range === 'year';
  const finished = thisYear ? year.booksFinished : overview.booksRead;
  const pages = thisYear ? year.pagesRead : overview.pagesRead;
  const unread = Math.max(0, overview.books - overview.booksRead - overview.booksReading);
  const themes = facets.themes.slice(0, THEME_ROWS);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.chips}>
        <Chip label="This year" on={thisYear} onPress={() => setRange('year')} />
        <Chip label="All time" on={!thisYear} onPress={() => setRange('all')} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
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
        {/* Leads with the one number the range is about. */}
        <View style={styles.hero}>
          <ThemedText style={styles.heroFigure}>{finished.toLocaleString()}</ThemedText>
          <ThemedText style={styles.heroLabel}>
            {`${finished === 1 ? 'book' : 'books'} finished ${thisYear ? 'this year' : 'all time'}`}
          </ThemedText>
          <ThemedText style={styles.heroSub}>
            {`${pages.toLocaleString()} pages${thisYear ? ` · ${year.booksAdded.toLocaleString()} added this year` : ''}`}
          </ThemedText>
        </View>

        {/* Overdue is the only tile that changes colour, and it says the word as well as wearing
            the tint — the colour is never the only signal. */}
        <View style={styles.tiles}>
          <Tile value={overview.books} label="Books owned" />
          <Tile value={overview.booksReading} label="Reading now" />
          <Tile value={overview.activeLoans} label="Lent out" />
          <Tile value={overview.overdueLoans} label="Overdue" danger={overview.overdueLoans > 0} />
        </View>

        {/* A 4-step sequential ramp of one hue: darker means more pages that day. */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <ThemedText style={styles.cardTitle}>Reading activity</ThemedText>
            <ThemedText style={styles.cardNote}>{`Last ${WEEKS} weeks`}</ThemedText>
          </View>
          <ActivityHeatmap days={activity} />
        </View>

        {/* Ordinal, not categorical: unread → reading → read has an order, so it takes one hue in
            three steps and the order is visible in the colour. */}
        {overview.books > 0 ? (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Where your books stand</ThemedText>
            <StateBar read={overview.booksRead} reading={overview.booksReading} unread={unread} />
          </View>
        ) : null}

        {/* The one place identity colour is spent. Every slice is also named and numbered in the
            legend, so colour is never the only channel. */}
        {genres.genres.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <ThemedText style={styles.cardTitle}>Genre</ThemedText>
            </View>
            <GenreDonut breakdown={genres} onSelect={setOpenGenre} />
          </View>
        ) : null}

        {themes.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <ThemedText style={styles.cardTitle}>Themes</ThemedText>
            </View>
            <ThemedText style={styles.cardNote}>
              {`A book usually carries several, so these don't add up to ${overview.books.toLocaleString()}.`}
            </ThemedText>
            <View style={styles.themeRows}>
              {themes.map((theme) => (
                <ThemeBar
                  key={theme.name}
                  label={theme.name}
                  count={theme.count}
                  max={themes[0].count}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <ThemedText style={styles.cardTitle}>Loans by month</ThemedText>
          </View>
          <LoansChart months={months} />
          <ThemedText style={styles.cardNote}>This month is still in progress, shown a step lighter.</ThemedText>
        </View>

        {overview.onTimeReturnRate !== null ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <ThemedText style={styles.cardTitle}>Returned on time</ThemedText>
              <ThemedText style={styles.cardFigure}>{`${Math.round(overview.onTimeReturnRate * 100)}%`}</ThemedText>
            </View>
            {/* A meter, not a chart: one ratio against a limit is a number. */}
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${Math.round(overview.onTimeReturnRate * 100)}%` }]} />
            </View>
            {overview.averageLoanDays !== null ? (
              <ThemedText style={styles.cardNote}>
                {`Books come back in ${overview.averageLoanDays} days on average.`}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <GenreSheet genre={openGenre} libraryTotal={genres.total} onClose={() => setOpenGenre(null)} />
    </ThemedView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
      <ThemedText style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</ThemedText>
    </Pressable>
  );
}

function Tile({ value, label, danger = false }: { value: number; label: string; danger?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.tile, danger && styles.tileDanger]}>
      <ThemedText style={[styles.tileValue, danger && styles.tileValueDanger]}>
        {value.toLocaleString()}
      </ThemedText>
      <ThemedText style={[styles.tileLabel, danger && styles.tileLabelDanger]}>{label}</ThemedText>
    </View>
  );
}

// Three steps of one hue, darkest for read. Segments are separated by a 2px gap in the surface
// colour rather than a stroke around each mark.
const STATE_STEPS = [
  { key: 'Read', colour: Chart.ramp[4] },
  { key: 'Reading', colour: Chart.ramp[2] },
  { key: 'Unread', colour: Chart.ramp[1] }
] as const;

function StateBar({ read, reading, unread }: { read: number; reading: number; unread: number }) {
  const counts = [read, reading, unread];
  const present = counts.map((count, index) => ({ count, index })).filter(({ count }) => count > 0);

  return (
    <>
      <View
        accessible
        accessibilityLabel={`${read} read, ${reading} reading, ${unread} unread`}
        style={styles.stateBar}>
        {present.map(({ count, index }, position) => (
          <View
            key={STATE_STEPS[index].key}
            style={[
              { flexGrow: count, backgroundColor: STATE_STEPS[index].colour },
              styles.stateSegment,
              position === 0 && styles.stateSegmentFirst,
              position === present.length - 1 && styles.stateSegmentLast
            ]}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {STATE_STEPS.map((step, index) => (
          <View key={step.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: step.colour }]} />
            <ThemedText style={styles.legendName}>{step.key}</ThemedText>
            <ThemedText style={styles.legendValue}>{counts[index].toLocaleString()}</ThemedText>
          </View>
        ))}
      </View>
    </>
  );
}

// One measure, one hue: colouring these by length would spend the identity channel re-stating what
// bar length already shows, and imply the themes belong to different families when they don't.
function ThemeBar({ label, count, max }: { label: string; count: number; max: number }) {
  const share = max > 0 ? Math.max(0.04, count / max) : 0;

  return (
    <View accessible accessibilityLabel={`${label}: ${count} books`} style={styles.themeRow}>
      <View style={styles.themeHead}>
        <ThemedText style={styles.themeLabel} numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText style={styles.themeCount}>{count.toLocaleString()}</ThemedText>
      </View>
      <View style={styles.themeTrack}>
        <View style={[styles.themeFill, { width: `${share * 100}%` }]} />
      </View>
    </View>
  );
}

// The design's proportions, scaled to whatever width the card gives it.
const CHART_VB_WIDTH = 352;
const CHART_VB_HEIGHT = 134;
const BASELINE = 108;
const AXIS_GUTTER = 20;
const BAR_WIDTH = 16;

function LoansChart({ months }: { months: MonthlyCount[] }) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...months.map((month) => month.count));
  // A round top tick, so the axis reads in whole numbers rather than at the data's exact ceiling.
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const band = (CHART_VB_WIDTH - AXIS_GUTTER) / Math.max(1, months.length);
  const y = (value: number) => BASELINE - (value / top) * BASELINE;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={(width * CHART_VB_HEIGHT) / CHART_VB_WIDTH} viewBox={`0 0 ${CHART_VB_WIDTH} ${CHART_VB_HEIGHT}`}>
          {[0, top / 2, top].map((value) => (
            <Line
              key={value}
              x1={AXIS_GUTTER}
              y1={y(value)}
              x2={CHART_VB_WIDTH}
              y2={y(value)}
              stroke={value === 0 ? Colors.border : Chart.gridline}
              strokeWidth={1}
            />
          ))}
          {[0, top / 2, top].map((value) => (
            <SvgText
              key={`label-${value}`}
              x={AXIS_GUTTER - 6}
              y={y(value) + 3.5}
              textAnchor="end"
              fontFamily={Fonts.bodySemiBold}
              fontSize={10}
              fill={Colors.disabledText}>
              {String(value)}
            </SvgText>
          ))}
          {months.map((month, index) => {
            const current = index === months.length - 1;
            const centre = AXIS_GUTTER + band * index + band / 2;
            const left = centre - BAR_WIDTH / 2;
            const height = month.count === 0 ? 0 : Math.max(3, BASELINE - y(month.count));
            const radius = Math.min(4, height);
            return (
              <Path
                key={month.month}
                // Rounded at the value end, square at the baseline.
                d={`M${left} ${BASELINE}V${BASELINE - height + radius}a${radius} ${radius} 0 0 1 ${radius} -${radius}h${BAR_WIDTH - radius * 2}a${radius} ${radius} 0 0 1 ${radius} ${radius}V${BASELINE}Z`}
                fill={current ? Chart.ramp[2] : Colors.brand}
              />
            );
          })}
          {months.length > 0 && months[months.length - 1].count > 0 ? (
            <SvgText
              x={AXIS_GUTTER + band * (months.length - 1) + band / 2}
              y={y(months[months.length - 1].count) - 6}
              textAnchor="middle"
              fontFamily={Fonts.bodyBold}
              fontSize={11}
              fill={Colors.text}>
              {String(months[months.length - 1].count)}
            </SvgText>
          ) : null}
          {months.map((month, index) => (
            <SvgText
              key={`month-${month.month}`}
              x={AXIS_GUTTER + band * index + band / 2}
              y={123}
              textAnchor="middle"
              fontFamily={Fonts.bodySemiBold}
              fontSize={10}
              fill={Colors.textSecondary}>
              {monthDate(month.month).toLocaleDateString(undefined, { month: 'short' })}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- genre donut

const DONUT_BOX = 232;
const DONUT_C = 116;
const OUTER_R = 100;
const INNER_R = 62;
// Segments are separated by a gap in the surface colour, never by a stroke around a mark. Measured
// at the outer edge, where the eye reads it, so it sits slightly narrower on the inner curve.
const DONUT_GAP = 2;
const GAP_ANGLE = DONUT_GAP / OUTER_R;

const polar = (radius: number, angle: number) => ({
  x: DONUT_C + radius * Math.cos(angle),
  y: DONUT_C + radius * Math.sin(angle)
});

const ringSegment = (from: number, to: number) => {
  const large = to - from > Math.PI ? 1 : 0;
  const o1 = polar(OUTER_R, from);
  const o2 = polar(OUTER_R, to);
  const i2 = polar(INNER_R, to);
  const i1 = polar(INNER_R, from);
  return `M${o1.x} ${o1.y}A${OUTER_R} ${OUTER_R} 0 ${large} 1 ${o2.x} ${o2.y}`
    + `L${i2.x} ${i2.y}A${INNER_R} ${INNER_R} 0 ${large} 0 ${i1.x} ${i1.y}Z`;
};

// Five identity hues, then one neutral tail. A seventh genre folds into Other rather than getting a
// generated hue, and the uncategorised remainder folds in with it — which is why the ring always adds
// up to the shelf total in the middle.
const foldGenres = (breakdown: Genres) => {
  const named = breakdown.genres.slice(0, GENRE_SLOTS).map((genre, index) => ({
    ...genre,
    colour: Chart.genre[index]
  }));
  const tail = breakdown.total - named.reduce((sum, genre) => sum + genre.count, 0);
  return tail > 0 ? [...named, { name: 'Other', count: tail, colour: Chart.genreOther }] : named;
};

type DrawnSlice = {
  name: string;
  count: number;
  colour: string;
  from: number;
  to: number;
  // A single genre filling the ring; an arc whose ends coincide draws nothing.
  whole: boolean;
};

function GenreDonut({
  breakdown,
  onSelect
}: {
  breakdown: Genres;
  onSelect: (slice: GenreSelection) => void;
}) {
  const slices = foldGenres(breakdown);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const [width, setWidth] = useState(0);
  const size = Math.min(DONUT_BOX, width || DONUT_BOX);

  // Threaded through a reduce rather than accumulated in a mutable binding: the running angle is
  // derived from the slices before it, and a `let` mutated inside map() is both a reassignment after
  // render (which the hooks compiler rejects) and a dependence on map's iteration order.
  const drawn = slices.reduce<{ offset: number; segments: DrawnSlice[] }>(
    ({ offset, segments }, slice) => {
      const sweep = total > 0 ? (slice.count / total) * Math.PI * 2 : 0;
      const from = offset + GAP_ANGLE / 2;
      // Clamped so a sliver narrower than the gap cannot invert into a backwards arc.
      const to = Math.max(from, offset + sweep - GAP_ANGLE / 2);
      return {
        offset: offset + sweep,
        segments: [...segments, { ...slice, from, to, whole: sweep >= Math.PI * 2 - GAP_ANGLE }]
      };
    },
    // Twelve o'clock.
    { offset: -Math.PI / 2, segments: [] }
  ).segments;

  return (
    <>
      <View style={styles.donutBox} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {size > 0 ? (
          <Svg width={size} height={size} viewBox={`0 0 ${DONUT_BOX} ${DONUT_BOX}`}>
            {drawn.map((slice) =>
              // One genre filling the ring sweeps a full turn, where the arc's start and end points
              // coincide and the path collapses to nothing. A stroked circle is the honest ring.
              slice.whole ? (
                <Circle
                  key={slice.name}
                  cx={DONUT_C}
                  cy={DONUT_C}
                  r={(OUTER_R + INNER_R) / 2}
                  stroke={slice.colour}
                  strokeWidth={OUTER_R - INNER_R}
                  fill="none"
                />
              ) : (
                <Path
                  key={slice.name}
                  d={ringSegment(slice.from, slice.to)}
                  fill={slice.colour}
                  onPress={() => onSelect({ name: slice.name, count: slice.count, colour: slice.colour })}
                />
              )
            )}
            <SvgText
              x={DONUT_C}
              y={DONUT_C - 4}
              textAnchor="middle"
              fontFamily={Fonts.display}
              fontSize={40}
              fill={Colors.text}>
              {breakdown.total.toLocaleString()}
            </SvgText>
            <SvgText
              x={DONUT_C}
              y={DONUT_C + 20}
              textAnchor="middle"
              fontFamily={Fonts.bodySemiBold}
              fontSize={13}
              fill={Colors.textSecondary}>
              {breakdown.total === 1 ? 'book' : 'books'}
            </SvgText>
          </Svg>
        ) : null}
      </View>

      <View style={styles.genreRows}>
        {/* The legend is the real target: a 38px-wide arc is a poor one, and every row here already
            names and numbers its slice. */}
        {slices.map((slice) => (
          <Pressable
            key={slice.name}
            accessibilityRole="button"
            accessibilityLabel={`${slice.name}: ${slice.count} books. Open the list`}
            onPress={() => onSelect({ name: slice.name, count: slice.count, colour: slice.colour })}
            style={({ pressed }) => [styles.genreRow, pressed && styles.pressed]}>
            <View style={[styles.swatch, { backgroundColor: slice.colour }]} />
            <ThemedText style={styles.genreName} numberOfLines={1}>
              {slice.name}
            </ThemedText>
            <ThemedText style={styles.genreCount}>{slice.count.toLocaleString()}</ThemedText>
            <ThemedText style={styles.genrePercent}>
              {`${total > 0 ? Math.round((slice.count / total) * 100) : 0}%`}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ---------------------------------------------------------------- activity heatmap

const CELL = 15;
const CELL_GAP = 4;
const PITCH = CELL + CELL_GAP;
const GUTTER = 22;
const GRID_TOP = 14;
// A margin past the last cell, so a month label on the final column is not clipped by the viewBox.
const HEAT_MARGIN = 4;
// 18 columns and 7 rows at this pitch, plus the weekday gutter, the month strip and that margin:
// 22 + 342 − 4 + 4 = 364 wide and 14 + 133 − 4 + 6 = 149 tall, which is the design's own canvas.
const HEAT_WIDTH = GUTTER + WEEKS * PITCH - CELL_GAP + HEAT_MARGIN;
const HEAT_HEIGHT = GRID_TOP + 7 * PITCH - CELL_GAP + 6;

// The bands the ramp stands for. Darker means more pages that day.
const rampFor = (pages: number) => {
  if (pages <= 0) return Chart.ramp[0];
  if (pages <= 15) return Chart.ramp[1];
  if (pages <= 35) return Chart.ramp[2];
  if (pages <= 60) return Chart.ramp[3];
  return Chart.ramp[4];
};

// Monday of the week containing this date, in UTC — the same calendar the API buckets by.
const mondayUtc = (date: Date) => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const [width, setWidth] = useState(0);
  const pages = new Map(days.map((day) => [day.date, day.pages]));
  const firstMonday = mondayUtc(new Date());
  firstMonday.setUTCDate(firstMonday.getUTCDate() - (WEEKS - 1) * 7);

  const columns = Array.from({ length: WEEKS }, (_, week) => {
    const monday = new Date(firstMonday);
    monday.setUTCDate(monday.getUTCDate() + week * 7);
    return { week, monday };
  });

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg
            width={width}
            height={(width * HEAT_HEIGHT) / HEAT_WIDTH}
            viewBox={`0 0 ${HEAT_WIDTH} ${HEAT_HEIGHT}`}>
            {/* Monday, Wednesday, Friday only: seven letters down the side is noise. */}
            {[0, 2, 4].map((row) => (
              <SvgText
                key={row}
                x={0}
                y={GRID_TOP + row * PITCH + 11}
                fontFamily={Fonts.bodyBold}
                fontSize={9}
                fill={Colors.disabledText}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'][row]}
              </SvgText>
            ))}
            {/* A month is labelled on the first column that falls inside it. */}
            {columns.map(({ week, monday }, index) =>
              index === 0 || monday.getUTCMonth() !== columns[index - 1].monday.getUTCMonth() ? (
                <SvgText
                  key={`month-${week}`}
                  x={GUTTER + week * PITCH}
                  y={8}
                  fontFamily={Fonts.bodySemiBold}
                  fontSize={9.5}
                  fill={Colors.textSecondary}>
                  {monday.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}
                </SvgText>
              ) : null
            )}
            {columns.map(({ week, monday }) =>
              Array.from({ length: 7 }, (_, row) => {
                const date = new Date(monday);
                date.setUTCDate(date.getUTCDate() + row);
                const read = pages.get(isoDay(date)) ?? 0;
                return (
                  <Rect
                    key={`${week}-${row}`}
                    x={GUTTER + week * PITCH}
                    y={GRID_TOP + row * PITCH}
                    width={CELL}
                    height={CELL}
                    rx={4}
                    fill={rampFor(read)}
                  />
                );
              })
            )}
          </Svg>
          <View style={styles.rampKey}>
            <ThemedText style={styles.rampKeyLabel}>Fewer pages</ThemedText>
            {Chart.ramp.map((colour) => (
              <View key={colour} style={[styles.rampSwatch, { backgroundColor: colour }]} />
            ))}
            <ThemedText style={styles.rampKeyLabel}>More</ThemedText>
          </View>
        </>
      ) : null}
    </View>
  );
}

// Shown when there is nothing worth counting. One illustration, one sentence, one way forward.
function EmptyStats({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <Svg width={150} height={126} viewBox="0 0 150 126" fill="none">
        <Circle cx={75} cy={66} r={50} fill={Colors.brandTint} />
        <Path
          d="M75 46c-10-7.5-23-9.5-34-7.5v50c11-2 24 0 34 7.5 10-7.5 23-9.5 34-7.5v-50c-11-2-24 0-34 7.5z"
          fill={Colors.surface}
          stroke={Colors.brand}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        <Path d="M75 46v50" stroke={Colors.brand} strokeWidth={2.6} strokeLinecap="round" />
        <Path
          d="M53 56h13M53 67h13M84 56h13M84 67h13"
          stroke={Colors.accent}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
        <Path d="M118 22l2.4 6.1 6.1 2.4-6.1 2.4-2.4 6.1-2.4-6.1-6.1-2.4 6.1-2.4z" fill={Colors.accent} />
        <Path
          d="M29 34l1.6 4.1 4.1 1.6-4.1 1.6L29 45.4l-1.6-4.1-4.1-1.6 4.1-1.6z"
          fill={Colors.brand}
          opacity={0.45}
        />
      </Svg>
      <ThemedText style={styles.emptyTitle}>Nothing to count yet</ThemedText>
      <ThemedText style={styles.emptyBody}>
        Add a few books and log what you&apos;re reading — your themes, reading states and loans show up here.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
        <ThemedText style={styles.emptyButtonLabel}>Add a book</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  loading: {
    gap: 16,
    padding: 20
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4
  },
  chip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipOn: {
    backgroundColor: Colors.text,
    borderColor: Colors.text
  },
  chipLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.text
  },
  chipLabelOn: {
    color: Colors.accent
  },
  pressed: {
    opacity: 0.7
  },
  scroll: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  hero: {
    gap: 6,
    padding: 22,
    borderRadius: Radius.card,
    backgroundColor: Colors.text
  },
  heroFigure: {
    fontFamily: Fonts.display,
    fontSize: 52,
    lineHeight: 54,
    color: Colors.accent
  },
  heroLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: Chart.onInk
  },
  heroSub: {
    marginTop: 4,
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: Chart.onInkMuted
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  tile: {
    // Two per row, with the gap taken out of the width.
    width: '48%',
    flexGrow: 1,
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  tileDanger: {
    borderColor: '#F2CFCB',
    backgroundColor: Colors.dangerTint
  },
  tileValue: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.text
  },
  tileValueDanger: {
    color: Colors.danger
  },
  tileLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textSecondary
  },
  tileLabelDanger: {
    fontFamily: Fonts.bodyBold,
    color: Colors.danger
  },
  card: {
    gap: 14,
    padding: 20,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10
  },
  cardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.text
  },
  cardFigure: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.text
  },
  cardNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary
  },
  stateBar: {
    flexDirection: 'row',
    height: 26,
    gap: 2
  },
  stateSegment: {
    height: 26
  },
  stateSegmentFirst: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8
  },
  stateSegmentLast: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3
  },
  legendName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textBody
  },
  legendValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums']
  },
  donutBox: {
    alignItems: 'center'
  },
  genreRows: {
    gap: 11
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  genreName: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textBody
  },
  genreCount: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
    fontVariant: ['tabular-nums']
  },
  genrePercent: {
    width: 34,
    textAlign: 'right',
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums']
  },
  rampKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12
  },
  rampKeyLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textSecondary
  },
  rampSwatch: {
    width: 13,
    height: 13,
    borderRadius: 3
  },
  themeRows: {
    gap: 10
  },
  themeRow: {
    gap: 5
  },
  themeHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10
  },
  themeLabel: {
    flexShrink: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.textBody
  },
  themeCount: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums']
  },
  themeTrack: {
    height: 12,
    borderRadius: 0
  },
  themeFill: {
    height: 12,
    // Square at the baseline, rounded at the value end.
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: Chart.genre[0]
  },
  meterTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brandTint,
    overflow: 'hidden'
  },
  meterFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 36
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text
  },
  emptyBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textSecondary
  },
  emptyButton: {
    height: 52,
    marginTop: 8,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text
  },
  emptyButtonLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.textOnDark
  }
});
