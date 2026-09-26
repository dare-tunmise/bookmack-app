import { Pressable, StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

type Candidate = Schemas['BookCandidate'];

export const candidateKey = (candidate: Candidate, index: number) =>
  `${candidate.source}:${candidate.sourceId ?? index}`;

type CandidateRowProps = {
  candidate: Candidate;
  onPress: () => void;
};

// A catalog match in a list: cover, title, authors, and year.
export function CandidateRow({ candidate, onPress }: CandidateRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <ThemedView type={pressed ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
          <BookCover title={candidate.title} thumbnail={candidate.thumbnail} />
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {candidate.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {[candidate.authors.join(', '), candidate.publishedDate?.slice(0, 4)].filter(Boolean).join(' · ')}
            </ThemedText>
          </View>
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.card,
    alignItems: 'center'
  },
  text: {
    flex: 1,
    gap: Spacing.half
  }
});
