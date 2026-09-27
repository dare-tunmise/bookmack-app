import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import type { Schemas } from '@/api/client';
import { ReadingRow } from '@/components/reading-row';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type ReadingBook = Schemas['ReadingBook'];

type ReadingListProps = {
  rows: ReadingBook[];
  onPressBook: (book: ReadingBook['book']) => void;
  onSetPage: (book: ReadingBook['book'], page: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  empty: ReactElement | null;
  bottomInset?: number;
};

// The books on the go, one card each. Props mirror Bookshelf's so the library screen can swap
// between the two without the surrounding screen knowing which it is showing.
//
// No pagination: the endpoint is unpaged because this is a handful of books, not a collection.
export function ReadingList({
  rows,
  onPressBook,
  onSetPage,
  refreshing,
  onRefresh,
  empty,
  bottomInset = 0
}: ReadingListProps) {
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.book.id}
      contentContainerStyle={
        rows.length === 0 ? styles.emptyContent : [styles.content, { paddingBottom: bottomInset }]
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand]} />}
      ListEmptyComponent={empty}
      renderItem={({ item: row }) => (
        <ReadingRow
          row={row}
          onPress={() => onPressBook(row.book)}
          onSetPage={(page) => onSetPage(row.book, page)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four
  }
});
