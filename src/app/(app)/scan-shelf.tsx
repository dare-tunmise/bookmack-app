import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { usePlanLimit } from '@/components/plan-limit-sheet';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useRedFlash } from '@/hooks/use-red-flash';
import { addBooks } from '@/lib/add-books';
import { isbnFromBarcode } from '@/lib/isbn';
import { newBookFromCandidate } from '@/lib/new-book';

type Candidate = Schemas['BookCandidate'];

// The camera is the only thing on screen, so a buzz is how you know a book registered. Devices
// without a vibrator just reject the call.
const buzz = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

type Entry =
  | { isbn: string; status: 'looking' }
  | { isbn: string; status: 'found'; candidate: Candidate }
  | { isbn: string; status: 'notFound' }
  | { isbn: string; status: 'error'; message: string };

// Scan one barcode after another without leaving the camera. Each ISBN is looked up in the
// background (free and cached), and everything found is added in one go at the end.
export default function ScanShelfScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedSoFar, setAddedSoFar] = useState(0);
  const snackbar = useSnackbar();
  const planLimit = usePlanLimit();
  const frame = useRedFlash();
  // Scanning a shelf takes minutes of holding up books, so don't let the screen lock.
  useKeepAwake();

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  const update = useCallback((isbn: string, entry: Entry) => {
    setEntries((current) => current.map((item) => (item.isbn === isbn ? entry : item)));
  }, []);

  const lookUp = useCallback(
    async (isbn: string) => {
      try {
        const { data, error, response } = await api.GET('/lookup/isbn/{isbn}', { params: { path: { isbn } } });
        if (data) update(isbn, { isbn, status: 'found', candidate: data.data });
        else if (response.status === 404) update(isbn, { isbn, status: 'notFound' });
        else throw toApiError(error);
      } catch (err) {
        update(isbn, { isbn, status: 'error', message: errorMessage(err) });
      }
    },
    [update]
  );

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (adding) return;

    const isbn = isbnFromBarcode(data);
    if (!isbn) {
      setHint("That barcode isn't a book's ISBN. Try the barcode on the back cover.");
      frame.flash();
      return;
    }

    let isNew = false;
    setEntries((current) => {
      if (current.some((entry) => entry.isbn === isbn)) return current;
      isNew = true;
      // Newest first, so the last book scanned is the one on screen.
      return [{ isbn, status: 'looking' }, ...current];
    });

    if (isNew) {
      buzz(Haptics.NotificationFeedbackType.Success);
      setHint(null);
      lookUp(isbn);
    } else {
      // A different buzz for a book already in the queue, so you don't scan it twice over.
      buzz(Haptics.NotificationFeedbackType.Warning);
      setHint('Already in the list.');
    }
  };

  // Scanning is fast and imprecise: you catch a neighbour's barcode, or an ISBN resolves to a
  // different edition than the book in your hand. Taking one back out has to be as quick as
  // putting it in, and nothing has been added to the library yet.
  const removeEntry = useCallback((isbn: string) => {
    setEntries((current) => current.filter((entry) => entry.isbn !== isbn));
    // The same pulse as a refused barcode: something was taken back out.
    frame.flash();
    // frame.flash rather than frame: the hook returns a new object each render, so depending on
    // the object would rebuild this callback every time and memoize nothing.
  }, [frame.flash]);

  const found = entries.filter((entry): entry is Extract<Entry, { status: 'found' }> => entry.status === 'found');
  const missing = entries.filter((entry) => entry.status === 'notFound' || entry.status === 'error').length;

  const addAll = async () => {
    if (found.length === 0 || adding) return;

    setAdding(true);
    setAddedSoFar(0);
    try {
      const result = await addBooks(found.map((entry) => newBookFromCandidate(entry.candidate)), (progress) =>
        setAddedSoFar(progress.added)
      );
      router.dismissTo('/');
      snackbar.show(addedMessage(result.added, result.skipped));
    } catch (err) {
      setAdding(false);
      // A plan limit gets its own sheet with a way to upgrade; anything else is just a message.
      if (planLimit.show(err)) {
        if (addedSoFar > 0) setEntries([]);
      } else {
        setHint(errorMessage(err));
      }
    }
  };

  if (!permission) return <View style={styles.flex} />;

  if (!permission.granted) {
    return (
      <FormScreen
        title="Camera access"
        subtitle="BookMack uses your camera to read the barcodes on your books."
        edges={['bottom', 'left', 'right']}>
        {permission.canAskAgain ? (
          <Button title="Allow camera access" onPress={requestPermission} />
        ) : (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
      </FormScreen>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={focused}
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={focused && !adding ? onBarcodeScanned : undefined}
        />
        <Animated.View pointerEvents="none" style={[styles.frame, frame.style]} />
        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'left', 'right']} pointerEvents="none">
          <ThemedText style={styles.overlayText}>
            {entries.length === 0
              ? 'Point at a barcode, then move on to the next book.'
              : `${entries.length} scanned · keep going`}
          </ThemedText>
          {hint ? (
            <ThemedText type="small" style={styles.overlayText}>
              {hint}
            </ThemedText>
          ) : null}
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.list} edges={['bottom', 'left', 'right']}>
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.isbn}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="scanShelf" color={Colors.disabledText} size={32} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Books you scan appear here. Nothing is added until you tap the button below.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => <EntryRow entry={item} onRemove={() => removeEntry(item.isbn)} />}
        />

        <View style={styles.footer}>
          {missing > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {missing === 1 ? "1 book wasn't found and won't be added." : `${missing} books weren't found and won't be added.`}
            </ThemedText>
          ) : null}
          <Button
            title={
              adding
                ? `Adding… ${addedSoFar} of ${found.length}`
                : found.length === 1
                  ? 'Add 1 book'
                  : `Add ${found.length} books`
            }
            onPress={addAll}
            loading={adding}
            disabled={found.length === 0}
          />
          <Button title="Done" variant="secondary" onPress={() => router.back()} disabled={adding} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function EntryRow({ entry, onRemove }: { entry: Entry; onRemove: () => void }) {
  const title = entry.status === 'found' ? entry.candidate.title : `ISBN ${entry.isbn}`;
  const subtitle =
    entry.status === 'found'
      ? entry.candidate.authors.join(', ') || 'Unknown author'
      : entry.status === 'looking'
        ? 'Looking it up…'
        : entry.status === 'notFound'
          ? 'Not in the catalogs'
          : entry.message;

  return (
    <View style={styles.row}>
      {entry.status === 'found' ? (
        <BookCover title={entry.candidate.title} thumbnail={entry.candidate.thumbnail} size={COVER_WIDTH} />
      ) : (
        <View style={styles.placeholder}>
          {entry.status === 'looking' ? <ActivityIndicator color={Colors.brand} /> : null}
        </View>
      )}
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={entry.status === 'found' ? 'textSecondary' : 'disabledText'}
          numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${title} from the list`}
        hitSlop={10}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}>
        <Icon name="close" color={Colors.textSecondary} size={18} />
      </Pressable>
    </View>
  );
}

const addedMessage = (added: number, skipped: number) => {
  const books = added === 1 ? '1 book' : `${added} books`;
  if (skipped === 0) return `Added ${books}`;
  return `Added ${books} · ${skipped} already in your library`;
};

const COVER_WIDTH = 40;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  camera: {
    flex: 1,
    backgroundColor: '#000000'
  },
  frame: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    width: '80%',
    maxWidth: 360,
    height: 120,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: Spacing.three
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-start',
    gap: Spacing.one,
    padding: Spacing.four
  },
  overlayText: {
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 4
  },
  list: {
    flex: 1,
    backgroundColor: Colors.background
  },
  listContent: {
    gap: Spacing.two,
    padding: Spacing.three
  },
  emptyBox: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four
  },
  empty: {
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three
  },
  placeholder: {
    width: COVER_WIDTH,
    height: COVER_WIDTH * 1.5,
    borderRadius: Radius.input,
    backgroundColor: Colors.skeleton,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowText: {
    flex: 1,
    gap: Spacing.half
  },
  remove: {
    padding: Spacing.two,
    borderRadius: Radius.pill
  },
  removePressed: {
    backgroundColor: Colors.backgroundSelected
  },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  center: {
    textAlign: 'center',
    fontFamily: Fonts.body
  }
});
