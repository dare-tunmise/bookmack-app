import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { CARDS, CARD_HEIGHT, CARD_WIDTH, type CardData } from '@/components/share-cards';
import { useSnackbar } from '@/components/snackbar';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

// Two finished cards and one button. There is nothing to configure: you choose which card, and
// that is the only decision — which is the point. The editor this replaces had four themes, two
// sizes, two layouts and a source picker, and most of the combinations were worse than the first.
const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH / CARD_WIDTH) * CARD_HEIGHT);
const GAP = 14;
const STRIDE = PREVIEW_WIDTH + GAP;
const SCALE = PREVIEW_WIDTH / CARD_WIDTH;

type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  stats: CardData;
  handle: string;
  // Printed on the card itself: "Dare's 2026" from Stats, "Dare's picks" from Library.
  title: string;
  // The sheet's own heading. Defaults to the year, which is what Stats wants.
  heading?: string;
  // Which cards to offer. Library offers Covers alone: the Numbers card is about a year, and a
  // handful of books picked by hand is not one.
  only?: readonly ('Covers' | 'Numbers')[];
};

export function ShareSheet({ visible, onClose, stats, handle, title, heading, only }: ShareSheetProps) {
  const snackbar = useSnackbar();
  const shotRef = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cards = only ? CARDS.filter((card) => only.includes(card.name)) : CARDS;
  const chosen = cards[index] ?? cards[0];
  const cardProps = { stats, handle, title };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / STRIDE);
    if (next !== index && next >= 0 && next < cards.length) setIndex(next);
  };

  // Saving and sharing fail on the device rather than at the API, so their own messages are shown
  // as they are: routed through a generic handler they all became "Something went wrong", which
  // is what makes a real Save failure impossible to diagnose from a screenshot.
  const localError = (err: unknown) => (err instanceof Error && err.message ? err.message : 'That did not work. Please try again.');

  const capture = async () => {
    if (!shotRef.current) return null;
    return captureRef(shotRef, { format: 'png', quality: 1, width: CARD_WIDTH, height: CARD_HEIGHT });
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      // writeOnly: this only ever adds one picture. Asked at the moment of saving rather than on
      // the way in, because a permission prompt before anyone has made anything gets denied.
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) throw new Error('BookMack needs permission to save to your photos.');
      const uri = await capture();
      if (!uri) throw new Error('The card could not be rendered.');
      await MediaLibrary.saveToLibraryAsync(uri);
      snackbar.show('Saved to your photos');
    } catch (err) {
      setError(localError(err));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    setError(null);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const uri = await capture();
      if (!uri) throw new Error('The card could not be rendered.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Share your ${stats.year}` });
    } catch (err) {
      setError(localError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {heading ?? `Share your ${stats.year}`}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Icon name="close" color={Colors.text} size={22} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={cards.map((_, position) => position * STRIDE)}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.carousel}>
        {cards.map(({ name, Card }, position) => (
          <View
            key={name}
            accessibilityLabel={`${name} card`}
            style={[styles.preview, position !== index && styles.previewDim]}>
            {/* The card is drawn at its real 1080×1350 and scaled down, so the preview and the
                captured image are the same component rather than two that can drift apart. */}
            <View style={styles.previewInner}>
              <Card {...cardProps} />
            </View>
          </View>
        ))}
      </ScrollView>

      {cards.length > 1 ? (
        <>
          <View style={styles.dots}>
            {cards.map(({ name }, position) => (
              <View key={name} style={[styles.dot, position === index && styles.dotOn]} />
            ))}
          </View>
          <ThemedText style={styles.cardName}>{chosen.name}</ThemedText>
        </>
      ) : null}

      {error ? <FieldError message={error} /> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={save}
          style={({ pressed }) => [styles.action, styles.actionSecondary, pressed && styles.pressed]}>
          {busy === 'save' ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <>
              <Icon name="save" color={Colors.text} size={20} />
              <ThemedText style={styles.actionLabel}>Save</ThemedText>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={share}
          style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}>
          {busy === 'share' ? (
            <ActivityIndicator color={Colors.textOnDark} />
          ) : (
            <>
              <Icon name="share" color={Colors.textOnDark} size={20} />
              <ThemedText style={[styles.actionLabel, styles.actionLabelOnDark]}>Share</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* Mounted whenever the sheet is open, not only while saving. It used to mount on the busy
          flag and captureRef ran in the same tick, before the view had been laid out — shotRef was
          null and every Save failed. Off screen and inert, so it costs only a layout. */}
      <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
        <View ref={shotRef} collapsable={false}>
          <chosen.Card {...cardProps} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    paddingTop: Spacing.one
  },
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: Colors.text },
  close: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },

  carousel: { gap: GAP, paddingHorizontal: 56, paddingTop: 14, paddingBottom: 18 },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.background
  },
  previewDim: { opacity: 0.55 },
  previewInner: { width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale: SCALE }], transformOrigin: 'top left' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D3DACD' },
  dotOn: { width: 20, backgroundColor: Colors.text },
  cardName: { textAlign: 'center', fontSize: 13, lineHeight: 20, color: Colors.textSecondary, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  action: {
    flex: 1,
    height: 54,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  actionPrimary: { backgroundColor: Colors.buttonPrimary },
  actionSecondary: { backgroundColor: Colors.brandTint },
  actionLabel: { fontFamily: Fonts.bodyBold, fontSize: 16, lineHeight: 20, color: Colors.text },
  actionLabelOnDark: { color: Colors.textOnDark },
  pressed: { opacity: 0.85 },

  offscreen: { position: 'absolute', left: -4000, top: 0, opacity: 0 }
});
