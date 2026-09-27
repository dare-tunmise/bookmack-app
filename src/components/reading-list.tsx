import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import type { Schemas } from '@/api/client';
import { ReadingRow } from '@/components/reading-row';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type ReadingBook = Schemas['ReadingBook'];
type BookRequest = Schemas['BookRequest'];

type ReadingListProps = {
  rows: ReadingBook[];
  // Who, if anyone, is waiting for a given book. A lookup rather than a prop on each row, so the
  // list stays a list and the screen keeps owning the requests it fetched.
  requestFor: (bookId: string) => BookRequest | null;
  onPressBook: (book: ReadingBook['book']) => void;
  onSetPage: (book: ReadingBook['book'], page: number) => void;
  onHandOver: (request: BookRequest) => void;
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
  requestFor,
  onPressBook,
  onSetPage,
  onHandOver,
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
          request={requestFor(row.book.id)}
          onPress={() => onPressBook(row.book)}
          onSetPage={(page) => onSetPage(row.book, page)}
          onHandOver={onHandOver}
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
