import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookPreview } from '@/components/book-preview';
import { Button } from '@/components/button';
import { usePlanLimit } from '@/components/plan-limit-sheet';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/brand';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { newBookFromCandidate } from '@/lib/new-book';

type Candidate = Schemas['BookCandidate'];

type LookupState =
  | { status: 'loading' }
  | { status: 'found'; candidate: Candidate }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

// Opened with ?isbn= (from a barcode scan) or ?candidate= (a search result, as JSON).
export default function AddBookScreen() {
  const { isbn, candidate: candidateParam } = useLocalSearchParams<{ isbn?: string; candidate?: string }>();
  const [lookup, setLookup] = useState<LookupState>(() => stateFromCandidateParam(candidateParam));
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const snackbar = useSnackbar();
  const { show: showPlanLimit } = usePlanLimit();

  const lookUpIsbn = useCallback(async () => {
    if (!isbn) return;
    setLookup({ status: 'loading' });
    try {
      const { data, error, response } = await api.GET('/lookup/isbn/{isbn}', {
        params: { path: { isbn } }
      });
      if (data) setLookup({ status: 'found', candidate: data.data });
      else if (response.status === 404) setLookup({ status: 'notFound' });
      else throw toApiError(error);
    } catch (err) {
      setLookup({ status: 'error', message: errorMessage(err) });
    }
  }, [isbn]);

  useEffect(() => {
    if (isbn) lookUpIsbn();
  }, [isbn, lookUpIsbn]);

  const add = async (candidate: Candidate) => {
    setAdding(true);
    setAddError(null);
    try {
      const { data, error } = await api.POST('/books', { body: newBookFromCandidate(candidate) });
      if (!data) throw toApiError(error);
      // Back to the library, which refreshes when it comes into view.
      router.dismissTo('/');
      const bookId = data.data.id;
      snackbar.show('Added to your library', {
        label: 'Lend it',
        onPress: () => router.push({ pathname: '/lend', params: { bookId } })
      });
    } catch (err) {
      // A plan limit opens the upgrade sheet rather than showing a dead-end message.
      if (!showPlanLimit(err)) setAddError(errorMessage(err));
      setAdding(false);
    }
  };

  const typeItIn = () => router.replace({ pathname: '/book-form', params: isbn ? { isbn } : {} });

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {lookup.status === 'loading' ? (
            <View style={styles.message}>
              <ActivityIndicator size="large" />
              <ThemedText themeColor="textSecondary">Looking up ISBN {isbn}…</ThemedText>
            </View>
          ) : null}

          {lookup.status === 'found' ? (
            <>
              <BookPreview candidate={lookup.candidate} />
              {addError ? (
                <ThemedText type="small" accessibilityRole="alert" style={styles.error}>
                  {addError}
                </ThemedText>
              ) : null}
              <Button title="Add to library" onPress={() => add(lookup.candidate)} loading={adding} />
              <Button title="Not this book" variant="secondary" onPress={() => router.back()} />
            </>
          ) : null}

          {lookup.status === 'notFound' ? (
            <>
              <View style={styles.message}>
                <ThemedText type="smallBold">We couldn't find this book</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  ISBN {isbn} isn't in the book catalogs yet. You can type in its details instead.
                </ThemedText>
              </View>
              <Button title="Type it in" onPress={typeItIn} />
              <Button title="Scan again" variant="secondary" onPress={() => router.back()} />
            </>
          ) : null}

          {lookup.status === 'error' ? (
            <>
              <View style={styles.message}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {lookup.message}
                </ThemedText>
              </View>
              {isbn ? <Button title="Try again" onPress={lookUpIsbn} /> : null}
              <Button title="Type it in" variant="secondary" onPress={typeItIn} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const stateFromCandidateParam = (candidateParam?: string): LookupState => {
  if (!candidateParam) return { status: 'loading' };
  try {
    return { status: 'found', candidate: JSON.parse(candidateParam) as Candidate };
  } catch {
    return { status: 'error', message: "Couldn't open that book. Try searching again." };
  }
};

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  message: {
    alignItems: 'center',
    gap: Spacing.two
  },
  center: {
    textAlign: 'center'
  },
  error: {
    color: Brand.danger,
    textAlign: 'center'
  }
});
