import { StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Candidate = Schemas['BookCandidate'];

// Large cover and details for a catalog match, before it's added to the library.
export function BookPreview({ candidate }: { candidate: Candidate }) {
  const details = [
    candidate.publisher,
    candidate.publishedDate?.slice(0, 4),
    candidate.pageCount ? `${candidate.pageCount} pages` : null
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <BookCover title={candidate.title} thumbnail={candidate.thumbnail} size="large" />
      <ThemedText type="h2" style={[styles.center, styles.title]}>
        {candidate.title}
      </ThemedText>
      {candidate.subtitle ? (
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {candidate.subtitle}
        </ThemedText>
      ) : null}
      {candidate.authors.length > 0 ? (
        <ThemedText style={styles.center}>{candidate.authors.join(', ')}</ThemedText>
      ) : null}
      {details ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {details}
        </ThemedText>
      ) : null}
      {candidate.isbn13 ? (
        <ThemedText type="small" themeColor="textSecondary">
          ISBN {candidate.isbn13}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two
  },
  center: {
    textAlign: 'center'
  },
  title: {
    marginTop: Spacing.two
  }
});
