import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SnackbarHost } from '@/components/snackbar';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';

const OPEN_DURATION_MS = 260;
const CLOSE_DURATION_MS = 200;

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
}>;

// A sheet that slides up over a fading backdrop. Tapping the backdrop or the back button closes
// it. Content taller than the screen should scroll inside (the sheet caps its height).
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // Stays mounted while the close animation runs, then unmounts the modal.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(400);
  const [progress] = useState(() => new Animated.Value(0));
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The modal is drawn over the status and navigation bars, so Android treats it as full screen
  // and never resizes it for the keyboard: a field inside the sheet would sit behind it. Lifting
  // the sheet by the keyboard's own height keeps what you are typing in view.
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  // Start sliding up once the modal is on screen, so the first frame doesn't jump.
  const slideUp = () => {
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={slideUp}
      onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable accessibilityLabel="Close" style={styles.fill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetPosition,
            { marginTop: insets.top + Spacing.five, marginBottom: keyboardHeight, transform: [{ translateY }] }
          ]}
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}>
          {/* The navigation bar is behind the keyboard, so its inset only applies without one. */}
          <ThemedView type="surface" style={[styles.sheet, { paddingBottom: (keyboardHeight ? 0 : insets.bottom) + 24 }]}>
            <View style={styles.handle} />
            {children}
          </ThemedView>
        </Animated.View>

        {/* Snackbars shown while the sheet is open appear above it. */}
        <SnackbarHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(22, 51, 0, 0.4)'
  },
  fill: {
    flex: 1
  },
  sheetPosition: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexShrink: 1
  },
  sheet: {
    flexShrink: 1,
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    ...Shadows.sheet
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border
  }
});
