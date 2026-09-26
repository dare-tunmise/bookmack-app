import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ListRowSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth } from '@/constants/theme';
import { describeActivity, type ActivityEntry } from '@/lib/activity';

type Activity = Schemas['Activity'];
type Row = ActivityEntry & { id: string; createdAt: string };
type LoadMode = 'initial' | 'refresh' | 'background' | 'more';

const PAGE_SIZE = 40;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "Today", "Yesterday", "12 Sep", or "12 Sep 2025" for other years.
const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
  });
};

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// Group readable entries into days, newest first (the API already sorts newest first).
const toSections = (activities: Activity[]) => {
  const sections: { title: string; data: Row[] }[] = [];
  for (const activity of activities) {
    const entry = describeActivity(activity);
    if (!entry) continue;
    const title = dayLabel(activity.createdAt);
    const row = { ...entry, id: activity.id, createdAt: activity.createdAt };
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(row);
    else sections.push({ title, data: [row] });
  }
  return sections;
};

export default function ActivityScreen() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadMode | null>('initial');
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const latestRequest = useRef(0);

  const load = useCallback(async (mode: LoadMode, cursor?: string) => {
    const requestId = ++latestRequest.current;
    const isCurrent = () => requestId === latestRequest.current;

    setLoading(mode);
    setError(null);
    try {
      const { data, error: apiError } = await api.GET('/activity', { params: { query: { limit: PAGE_SIZE, cursor } } });
      if (!isCurrent()) return;
      if (!data) throw toApiError(apiError);
      setActivities((current) => (mode === 'more' ? [...current, ...data.data] : data.data));
      setNextCursor(data.meta.nextCursor);
    } catch (err) {
      if (isCurrent()) setError(errorMessage(err));
    } finally {
      if (isCurrent()) setLoading(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current ? 'background' : 'initial');
      loadedOnce.current = true;
    }, [load])
  );

  const loadMore = () => {
    if (nextCursor && !loading && !error) load('more', nextCursor);
  };

  const sections = toSections(activities);
  // Any load with nothing to show yet, not just an 'initial' one: see the library screen.
  const initialLoading = loading !== null && activities.length === 0;

  return (
    <ThemedView style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 && !initialLoading ? styles.emptyContent : styles.content}
        refreshControl={
          <RefreshControl refreshing={loading === 'refresh'} onRefresh={() => load('refresh')} colors={[Colors.brand]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderSectionHeader={({ section }) => (
          <ThemedText accessibilityRole="header" style={styles.day}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, index, section }) => (
          <ActivityRow row={item} last={index === section.data.length - 1} />
        )}
        ListEmptyComponent={
          initialLoading ? (
            <ListRowSkeleton rows={6} />
          ) : error ? (
            <View style={styles.message}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {error}
              </ThemedText>
              <Button title="Try again" variant="secondary" onPress={() => load('initial')} />
            </View>
          ) : (
            <EmptyState
              seed="no-activity"
              title="No activity yet"
              message="Books you add, lend, and get back show up here."
            />
          )
        }
        ListFooterComponent={
          loading === 'more' ? <ActivityIndicator color={Colors.brand} style={styles.footer} /> : null
        }
      />
    </ThemedView>
  );
}

function ActivityRow({ row, last }: { row: Row; last: boolean }) {
  return (
    <View accessible accessibilityLabel={`${row.text}, ${timeLabel(row.createdAt)}`} style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.iconCircle, row.problem && styles.iconCircleProblem]}>
          <Icon name={row.icon} color={row.problem ? Colors.danger : Colors.text} size={16} />
        </View>
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={styles.rowText}>
        <ThemedText type="small" style={row.problem ? styles.problemText : styles.text}>
          {row.text}
        </ThemedText>
        <ThemedText style={styles.time}>{timeLabel(row.createdAt)}</ThemedText>
      </View>
    </View>
  );
}

const ICON_SIZE = 32;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  day: {
    paddingTop: 20,
    paddingBottom: 10,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  rail: {
    alignItems: 'center',
    width: ICON_SIZE
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  iconCircleProblem: {
    backgroundColor: Colors.dangerTint
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: Colors.border
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingTop: 6,
    paddingBottom: 16
  },
  text: {
    color: Colors.textBody
  },
  problemText: {
    color: Colors.danger
  },
  time: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary
  },
  message: {
    alignItems: 'center',
    gap: 16
  },
  center: {
    textAlign: 'center'
  },
  footer: {
    paddingVertical: 16
  }
});
