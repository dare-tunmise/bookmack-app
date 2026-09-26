import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { CandidateRow, candidateKey } from '@/components/candidate-row';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Candidate = Schemas['BookCandidate'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    try {
      const { data, error: apiError } = await api.GET('/lookup/search', { params: { query: { q, limit: 20 } } });
      if (!data) throw toApiError(apiError);
      setResults(data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={results ?? []}
        keyExtractor={candidateKey}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Title, author, or ISBN"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={search}
              autoFocus
            />
            <Button title="Search" onPress={search} loading={searching} disabled={!query.trim()} />
            {error ? (
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            ) : null}
            {searching ? <ActivityIndicator /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <CandidateRow
            candidate={item}
            onPress={() => router.push({ pathname: '/add-book', params: { candidate: JSON.stringify(item) } })}
          />
        )}
        ListEmptyComponent={
          results && !searching && !error ? (
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                No matches. Try different words, or type the book in yourself.
              </ThemedText>
              <Button title="Type it in" variant="secondary" onPress={() => router.replace('/book-form')} />
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four
  },
  center: {
    textAlign: 'center'
  }
});
