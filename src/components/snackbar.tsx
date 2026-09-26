import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

const VISIBLE_MS = 4000;

type SnackbarAction = { label: string; onPress: () => void };
type Snackbar = { id: number; message: string; action?: SnackbarAction };

type SnackbarContextValue = {
  snackbar: Snackbar | null;
  show: (message: string, action?: SnackbarAction) => void;
  dismiss: () => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

// Short confirmations ("Reminder sent to Chidi") at the bottom of the screen, with an optional action.
export function SnackbarProvider({ children }: PropsWithChildren) {
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, action?: SnackbarAction) => {
    nextId.current += 1;
    setSnackbar({ id: nextId.current, message, action });
  }, []);

  const dismiss = useCallback(() => setSnackbar(null), []);

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(
      () => setSnackbar((current) => (current?.id === snackbar.id ? null : current)),
      VISIBLE_MS
    );
    return () => clearTimeout(timer);
  }, [snackbar]);

  const value = useMemo(() => ({ snackbar, show, dismiss }), [snackbar, show, dismiss]);

  return (
    <SnackbarContext value={value}>
      {children}
      <SnackbarHost />
    </SnackbarContext>
  );
}

export function useSnackbar() {
  const value = use(SnackbarContext);
  if (!value) throw new Error('useSnackbar must be used inside <SnackbarProvider>');
  return { show: value.show };
}

// Draws the current snackbar. The provider renders one; modals (bottom sheets) render their own so
// snackbars stay visible above them.
export function SnackbarHost() {
  const value = use(SnackbarContext);
  const insets = useSafeAreaInsets();
  const snackbar = value?.snackbar;
  if (!value || !snackbar) return null;

  return (
    <View pointerEvents="box-none" style={[styles.position, { bottom: insets.bottom + 16 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.snackbar}>
        <ThemedText style={styles.message}>{snackbar.message}</ThemedText>
        {snackbar.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              value.dismiss();
              snackbar.action?.onPress();
            }}>
            <ThemedText style={styles.action}>{snackbar.action.label}</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center'
  },
  snackbar: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18
  },
  message: {
    flexShrink: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textOnDark
  },
  action: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.accent
  }
});
