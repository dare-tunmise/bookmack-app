import { StyleSheet, View, type DimensionValue } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type SkeletonProps = {
  width: DimensionValue;
  height: number;
  radius?: number;
};

// A gray placeholder block shown while content loads.
export function Skeleton({ width, height, radius = 8 }: SkeletonProps) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: Colors.skeleton }} />;
}

// Loading placeholder for the bookshelf: a label and a row of covers, repeated.
export function ShelfSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading books" style={styles.shelves}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.shelf}>
          <Skeleton width={120} height={16} />
          <View style={styles.covers}>
            {[0, 1, 2].map((cover) => (
              <View key={cover} style={styles.cover} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// Loading placeholder for lists: a round image and two lines of text per row.
export function ListRowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" style={styles.rows}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.row}>
          <Skeleton width={44} height={44} radius={Radius.pill} />
          <View style={styles.rowText}>
            <Skeleton width={row % 2 ? '50%' : '60%'} height={14} />
            <Skeleton width={row % 2 ? '35%' : '40%'} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Loading placeholder for a book: a cover and two lines, centered.
export function DetailsSkeleton() {
  return (
    <View accessibilityLabel="Loading" style={styles.details}>
      <Skeleton width={120} height={170} radius={Radius.cover} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="50%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  shelves: {
    gap: 32
  },
  shelf: {
    gap: 12
  },
  covers: {
    flexDirection: 'row',
    gap: 16
  },
  cover: {
    flex: 1,
    maxWidth: 100,
    aspectRatio: 2 / 3,
    borderRadius: Radius.cover,
    backgroundColor: Colors.skeleton
  },
  rows: {
    gap: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rowText: {
    flex: 1,
    gap: 6
  },
  details: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12
  }
});
