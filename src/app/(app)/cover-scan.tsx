import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { ApiError, errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { CandidateRow, candidateKey } from '@/components/candidate-row';
import { usePlanLimit } from '@/components/plan-limit-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { base64ToBytes } from '@/lib/base64';
import { coverPhotoJpegBase64, pendingCoverPhoto } from '@/lib/cover-photo';

type CoverScan = Schemas['CoverScan'];

type ScanState =
  | { status: 'scanning' }
  | { status: 'done'; scan: CoverScan }
  | { status: 'error'; message: string; code: string | null };

// Sending the same photo again won't help with these; a new photo might.
const RETAKE_CODES = new Set(['NOT_A_BOOK_COVER', 'INVALID_IMAGE', 'SCAN_DECLINED', 'UPLOAD_ERROR', 'NO_PHOTO']);
// Retrying can't succeed until something changes on the account or the server.
const FINAL_CODES = new Set(['PLAN_LIMIT_REACHED', 'SCANNING_UNAVAILABLE']);

const uploadCoverPhoto = async (uri: string): Promise<CoverScan> => {
  const { data, error } = await api.POST('/lookup/cover', {
    body: { photo: await coverPhotoJpegBase64(uri) },
    bodySerializer: ({ photo }) => {
      const bytes = base64ToBytes(photo);
      // Expo's fetch sends any object with bytes() as a file part. It rejects React Native's
      // { uri, name, type } objects, and reading the file through expo-file-system was rejected
      // in Expo Go, so the photo is sent from memory.
      const part = { name: 'cover.jpg', type: 'image/jpeg', bytes: async () => bytes };
      const form = new FormData();
      form.append('photo', part as unknown as Blob);
      return form;
    }
  });
  if (!data) throw toApiError(error);
  return data.data;
};

// Opened from the scan screen, which leaves the photo in setPendingCoverPhoto. Reads the cover,
// then lists the catalog matches to pick from.
export default function CoverScanScreen() {
  // Read once, so retries send the same photo.
  const [photo] = useState(pendingCoverPhoto);
  const [state, setState] = useState<ScanState>(() =>
    photo
      ? { status: 'scanning' }
      : { status: 'error', message: 'There is no photo to scan. Take another photo.', code: 'NO_PHOTO' }
  );
  // Every scan counts toward the monthly limit, so send each photo once unless the user retries.
  const started = useRef(false);
  const { show: showPlanLimit } = usePlanLimit();

  const scan = useCallback(async () => {
    if (!photo) return;
    try {
      const result = await uploadCoverPhoto(photo);
      setState({ status: 'done', scan: result });
    } catch (err) {
      // Out of scans for the month: the sheet offers a way to upgrade, and the message stays
      // on screen behind it.
      showPlanLimit(err);
      setState({ status: 'error', message: errorMessage(err), code: err instanceof ApiError ? err.code : null });
    }
  }, [photo, showPlanLimit]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    scan();
  }, [scan]);

  const tryAgain = () => {
    setState({ status: 'scanning' });
    scan();
  };

  const takeAnother = () => router.back();

  const typeItIn = (extracted?: CoverScan['extracted']) => {
    const params: Record<string, string> = {};
    if (extracted?.title) params.title = extracted.title;
    if (extracted?.authors.length) params.author = extracted.authors.join(', ');
    if (extracted?.isbn) params.isbn = extracted.isbn;
    router.replace({ pathname: '/book-form', params });
  };

  const candidates = state.status === 'done' ? state.scan.candidates : [];

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={candidates}
        keyExtractor={candidateKey}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            {photo ? (
              <Image source={photo} style={styles.photo} contentFit="cover" accessibilityLabel="Your cover photo" />
            ) : null}

            {state.status === 'scanning' ? (
              <View style={styles.message}>
                <ActivityIndicator size="large" />
                <ThemedText themeColor="textSecondary">Reading the cover…</ThemedText>
              </View>
            ) : null}

            {state.status === 'done' ? (
              <View style={styles.message}>
                <ThemedText type="smallBold">
                  {candidates.length > 0 ? 'Is it one of these?' : "We couldn't find this book"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {describeExtracted(state.scan.extracted)}
                  {candidates.length === 0 ? ' No catalog has a match, but you can type in its details.' : ''}
                </ThemedText>
              </View>
            ) : null}

            {state.status === 'error' ? (
              <View style={styles.message}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {state.message}
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CandidateRow
            candidate={item}
            onPress={() => router.push({ pathname: '/add-book', params: { candidate: JSON.stringify(item) } })}
          />
        )}
        ListFooterComponent={
          state.status === 'scanning' ? null : (
            <View style={styles.footer}>
              {state.status === 'error' && !RETAKE_CODES.has(state.code ?? '') && !FINAL_CODES.has(state.code ?? '') ? (
                <Button title="Try again" onPress={tryAgain} />
              ) : null}
              <Button
                title={state.status === 'done' && candidates.length > 0 ? 'None of these: type it in' : 'Type it in'}
                variant={state.status === 'done' && candidates.length === 0 ? 'primary' : 'secondary'}
                onPress={() => typeItIn(state.status === 'done' ? state.scan.extracted : undefined)}
              />
              <Button title="Take another photo" variant="secondary" onPress={takeAnother} />
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const describeExtracted = ({ title, authors }: CoverScan['extracted']) => {
  const byline = authors.length > 0 ? authors.join(', ') : null;
  if (title) return `Read from the cover: “${title}”${byline ? ` by ${byline}` : ''}.`;
  if (byline) return `Read from the cover: a book by ${byline}.`;
  return "We couldn't read the title on this cover.";
};

const PHOTO_WIDTH = 120;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    gap: Spacing.two,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  header: {
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two
  },
  photo: {
    width: PHOTO_WIDTH,
    height: PHOTO_WIDTH * 1.5,
    borderRadius: Spacing.two
  },
  message: {
    alignItems: 'center',
    gap: Spacing.two
  },
  center: {
    textAlign: 'center'
  },
  footer: {
    gap: Spacing.three,
    marginTop: Spacing.three
  }
});
