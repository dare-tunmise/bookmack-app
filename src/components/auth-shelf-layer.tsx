import { usePathname } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthShelf, type ShelfStep } from '@/components/auth-shelf';
import { ShelfCelebrateContext, ShelfStepContext } from '@/components/shelf-context';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

// The glow, the one travelling shelf, and the state the signed-out screens read from it.
//
// It wraps the navigator rather than sitting in a route group of its own. The group version
// needed an index screen to have something to land on, which put a second route at "/" — the
// drawer's index was already there — and the router could not say which one it meant: tapping
// Create account went to a grey screen, or out to the launcher. A layout component has no route
// of its own, so there is nothing to collide.
//
// Order here is paint order: glow, then the screens, then the shelf above them. The shelf layer
// is inert, so a tap lands on the form underneath it.

// Where the shelf is the hero rather than a mark in the header.
const HERO_ROUTES = ['/welcome'];

type Props = {
  // Off once the account is verified: the app's own screens are opaque and want no shelf over
  // them, and the loop should not be running behind them either.
  active: boolean;
  children: ReactNode;
};

export function AuthShelfLayer({ active, children }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [step, setStep] = useState<ShelfStep>(-1);
  // Set by the screen that has just finished verifying, so the shelf comes home for it.
  const [celebrating, setCelebrating] = useState(false);

  const hero = HERO_ROUTES.includes(pathname) || celebrating;

  // Memoised: the shelf's loop holds this across its whole run, and a new function on every
  // render would restart the effect that drives it.
  const onStep = useCallback((next: ShelfStep) => setStep(next), []);

  if (!active) return <>{children}</>;

  return (
    <ShelfCelebrateContext value={setCelebrating}>
      <ShelfStepContext value={step}>
        <ThemedView style={styles.flex}>
          {/* The lime wash behind the welcome screen, which fades as the shelf shrinks away. */}
          <View style={[styles.glow, !hero && styles.glowQuiet]} pointerEvents="none" />

          {children}

          <View style={[styles.shelfLayer, { paddingTop: insets.top }]} pointerEvents="none">
            <AuthShelf
              mode={hero ? 'hero' : 'compact'}
              animate={hero && !celebrating}
              onStep={onStep}
              cheer={celebrating}
            />
          </View>
        </ThemedView>
      </ShelfStepContext>
    </ShelfCelebrateContext>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  shelfLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 2
  },
  glow: {
    position: 'absolute',
    left: '50%',
    top: -140,
    width: 620,
    height: 520,
    marginLeft: -310,
    borderRadius: 310,
    backgroundColor: Colors.accent,
    opacity: 0.28
  },
  glowQuiet: {
    opacity: 0.12,
    transform: [{ translateY: -190 }, { scale: 0.7 }]
  }
});
