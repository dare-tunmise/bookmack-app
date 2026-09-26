import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useRedFlash } from '@/hooks/use-red-flash';
import { setPendingCoverPhoto } from '@/lib/cover-photo';
import { isbnFromBarcode } from '@/lib/isbn';

// Enough of the wanted list to match against without paging; the server caps it at 200.
const WANTED_LIMIT = 100;

// What the shelf already knows about the barcode just scanned.
type Known =
  // `id` and `author` are carried so a lost copy can be recorded as the one a replacement
  // replaces, without another round trip to fetch the book again.
  | { kind: 'owned'; id: string; title: string; author: string; status: string; isbn: string }
  | { kind: 'wanted'; id: string; title: string; isbn: string };

// Barcodes are read live and are free to look up. Only when there's no barcode does the user
// take a photo of the front cover, which is read by AI and counts toward the monthly scan limit.
//
// Every scan is checked against what you already have before the add screen opens, because the
// question worth answering in a bookshop is "do I have this?", and it has to be answered at the
// camera so the next book can be scanned without leaving the viewfinder.
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [focused, setFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [known, setKnown] = useState<Known | null>(null);
  // The title of a book already on the shelf. Shown over the viewfinder and flashed red rather
  // than put in a card: there is nothing to decide, so there should be nothing to dismiss.
  const [owned, setOwned] = useState<string | null>(null);
  // Barcode events arrive many times per second; handle only the first good one.
  const handled = useRef(false);
  // The last barcode we warned about, so keeping the camera on the same book does not strobe.
  const lastWarned = useRef<string | null>(null);
  // How long the warning holds the scanner before it re-arms itself.
  const RESUME_MS = 1200;
  // The wanted list, keyed by every ISBN form it carries. Fetched once when the screen opens
  // rather than per scan: it is small and capped, and a shop is exactly where a round trip per
  // barcode would be felt.
  const wanted = useRef(new Map<string, { id: string; title: string }>());
  const frame = useRedFlash();

  // Scan only while this screen is visible, and start fresh when coming back to it.
  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      lastWarned.current = null;
      setHint(null);
      setKnown(null);
      setOwned(null);
      setFocused(true);

      let cancelled = false;
      api
        .GET('/wanted', { params: { query: { limit: WANTED_LIMIT } } })
        .then(({ data }) => {
          if (cancelled || !data) return;
          const byIsbn = new Map<string, { id: string; title: string }>();
          for (const entry of data.data) {
            for (const code of [entry.isbn13, entry.isbn10, entry.isbn]) {
              if (code) byIsbn.set(code, { id: entry.id, title: entry.title });
            }
          }
          wanted.current = byIsbn;
        })
        // Without it the scan still checks what you own; it just cannot say "this is on your list".
        .catch(() => {});

      return () => {
        cancelled = true;
        setFocused(false);
        setCameraReady(false);
      };
    }, [])
  );

  const resume = () => {
    setKnown(null);
    handled.current = false;
  };

  const openAddScreen = (isbn: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.push({ pathname: '/add-book', params: { isbn } });
  };

  const check = async (isbn: string) => {
    const onList = wanted.current.get(isbn);
    if (onList) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setKnown({ kind: 'wanted', id: onList.id, title: onList.title, isbn });
      return;
    }

    setChecking(true);
    try {
      // `q` matches the stored ISBN and its derived isbn13, so the barcode finds the copy.
      const { data } = await api.GET('/books', { params: { query: { q: isbn, limit: 1 } } });
      const mine = data?.data[0];
      if (mine) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

        // A copy you lost is the one case where owning it is an offer rather than a warning, so
        // it keeps the card and its action.
        if (mine.status === 'Lost') {
          setKnown({
            kind: 'owned',
            id: mine.id,
            title: mine.title,
            author: mine.author,
            status: mine.status,
            isbn
          });
          return;
        }

        // Already on the shelf: flash the frame and the title red. Nothing to tap, and the
        // scanner re-arms itself, so the next book can be scanned straight away.
        setOwned(mine.title);
        lastWarned.current = isbn;
        frame.flash(2);
        setTimeout(() => {
          handled.current = false;
        }, RESUME_MS);
        return;
      }
    } catch {
      // Not being able to check is no reason to stop someone adding a book. Fall through and
      // look it up; the server refuses a genuine duplicate anyway.
    } finally {
      setChecking(false);
    }

    openAddScreen(isbn);
  };

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;

    const isbn = isbnFromBarcode(data);
    if (!isbn) {
      setHint("That barcode isn't a book's ISBN. Try the barcode on the back cover.");
      frame.flash();
      return;
    }

    // Already warned about this exact book; stay armed for the next one without strobing.
    if (isbn === lastWarned.current) return;

    handled.current = true;
    setOwned(null);
    void check(isbn);
  };

  // You are holding the copy you meant to buy: put it straight on the shelf.
  const boughtIt = async (entry: Extract<Known, { kind: 'wanted' }>) => {
    setChecking(true);
    try {
      const { data, error } = await api.POST('/wanted/{id}/bought', {
        params: { path: { id: entry.id } }
      });
      if (!data) throw toApiError(error);
      for (const [code, row] of wanted.current) {
        if (row.id === entry.id) wanted.current.delete(code);
      }
      setHint(`"${data.data.title}" is on your shelf`);
      resume();
    } catch (err) {
      setHint(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  // Your copy is lost and you are standing in front of another one. Recording it as a replacement
  // for that copy is what makes buying it later put the book back on the shelf rather than add a
  // second one — so this posts to the wanted list, it does not open the add-book flow, which
  // would try to add a duplicate of a book you still own and be refused.
  const wantAgain = async (entry: Extract<Known, { kind: 'owned' }>) => {
    setChecking(true);
    try {
      const { data, error } = await api.POST('/wanted', {
        body: {
          title: entry.title,
          author: entry.author,
          isbn: entry.isbn,
          reason: 'replacement',
          replaces: entry.id
        }
      });
      if (!data) throw toApiError(error);
      // So scanning it again says "on your wanted list" rather than offering to add it twice.
      wanted.current.set(entry.isbn, { id: data.data.id, title: data.data.title });
      setHint(`"${entry.title}" is on your wanted list`);
      resume();
    } catch (err) {
      setHint(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const snapCover = async () => {
    if (!camera.current || capturing) return;

    setCapturing(true);
    setHint(null);
    // Ignore barcodes while the photo is being taken.
    handled.current = true;
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9 });
      // The cover scan screen shrinks and uploads it. Not passed as a route param: see
      // setPendingCoverPhoto.
      setPendingCoverPhoto(picture.uri);
      router.push('/cover-scan');
    } catch {
      handled.current = false;
      setHint("Couldn't take the photo. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) return <View style={styles.flex} />;

  if (!permission.granted) {
    return (
      <FormScreen
        title="Camera access"
        subtitle="BookMack uses your camera to read a book's barcode or cover."
        edges={['bottom', 'left', 'right']}>
        {permission.canAskAgain ? (
          <Button title="Allow camera access" onPress={requestPermission} />
        ) : (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
        <AddWithoutCamera />
      </FormScreen>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused}
        onCameraReady={() => setCameraReady(true)}
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={focused ? onBarcodeScanned : undefined}
      />
      <Animated.View pointerEvents="none" style={[styles.frame, frame.style]} />
      <SafeAreaView style={styles.overlay} edges={['bottom', 'left', 'right']} pointerEvents="box-none">
        {known ? (
          <View style={styles.card}>
            {known.kind === 'wanted' ? (
              <>
                <ThemedText type="smallBold">On your wanted list</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {known.title}
                </ThemedText>
                <Button title="I bought it" loading={checking} onPress={() => boughtIt(known)} />
              </>
            ) : (
              <>
                <ThemedText type="smallBold">
                  {known.status === 'Lost' ? 'You had this one' : 'You already own this'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {known.title}
                  {known.status === 'Loaned' ? ' — currently lent out' : ''}
                  {known.status === 'Lost' ? ' — marked lost' : ''}
                </ThemedText>
                {known.status === 'Lost' ? (
                  <Button
                    title="Add to my wanted list"
                    loading={checking}
                    onPress={() => wantAgain(known)}
                  />
                ) : null}
              </>
            )}
            <Button title="Keep scanning" variant="secondary" onPress={resume} />
          </View>
        ) : (
          <>
            {owned ? (
              <View style={styles.owned}>
                <ThemedText type="small" style={styles.overlayText}>
                  Already on your shelf
                </ThemedText>
                <Animated.Text style={[styles.ownedTitle, frame.textStyle]} numberOfLines={2}>
                  {owned}
                </Animated.Text>
              </View>
            ) : null}

            <ThemedText style={styles.overlayText}>
              Point the camera at the barcode on the back. No barcode? Snap the front cover.
            </ThemedText>
            {checking ? (
              <ThemedText type="small" style={styles.overlayText}>
                Checking your shelf…
              </ThemedText>
            ) : null}
            {hint ? (
              <ThemedText type="small" style={styles.overlayText}>
                {hint}
              </ThemedText>
            ) : null}

            <View style={styles.shutterArea}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo of the front cover"
                accessibilityState={{ disabled: !cameraReady || capturing, busy: capturing }}
                disabled={!cameraReady || capturing}
                onPress={snapCover}
                style={({ pressed }) => [styles.shutter, (pressed || !cameraReady) && styles.shutterDimmed]}>
                <View style={styles.shutterInner}>{capturing ? <ActivityIndicator color="#000000" /> : null}</View>
              </Pressable>
              <ThemedText type="small" style={styles.overlayText}>
                Snap the cover
              </ThemedText>
            </View>

            <AddWithoutCamera />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function AddWithoutCamera() {
  return (
    <ButtonGroup
      actions={[
        { label: 'Search by title', onPress: () => router.push('/search') },
        { label: 'Type it in', onPress: () => router.push('/book-form') }
      ]}
    />
  );
}

const SHUTTER_SIZE = 72;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#000000'
  },
  frame: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: '80%',
    maxWidth: 360,
    height: 160,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: Spacing.three
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    gap: Spacing.three,
    padding: Spacing.four
  },
  overlayText: {
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 4
  },
  owned: {
    alignItems: 'center',
    gap: Spacing.one
  },
  // No colour of its own: the flash animation supplies it, and a static one would fight it.
  ownedTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 4
  },
  // An opaque card rather than text over the viewfinder: this is an answer to read, not a caption.
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface
  },
  shutterArea: {
    alignItems: 'center',
    gap: Spacing.one
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  shutterDimmed: {
    opacity: 0.6
  },
  shutterInner: {
    width: SHUTTER_SIZE - 16,
    height: SHUTTER_SIZE - 16,
    borderRadius: (SHUTTER_SIZE - 16) / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
