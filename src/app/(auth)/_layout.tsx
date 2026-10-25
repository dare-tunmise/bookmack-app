import { Stack, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session';
import { AuthShelf, type ShelfStep } from '@/components/auth-shelf';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

import { ShelfCelebrateContext, ShelfStepContext } from '@/components/shelf-context';

// Everything a signed-out person sees, with one shelf mounted above all of it.
//
// The shelf lives here rather than in any screen because it has to survive the route change —
// that continuity is the whole idea. Screens slide underneath it; it glides from the middle of
// the welcome screen into the header and stays there.

// Where the shelf is the hero rather than a header mark. The welcome screen is this group's
// index, so its path is "/" — which is also the path the app launches at, and the reason it is
// the index: a redirect into a group needs something concrete to land on, and "/welcome" left
// nothing resolving at "/" at all.
const HERO_ROUTES = ['/'];

// Which screen this group falls back to when something sends you here without naming a screen.
export const unstable_settings = { anchor: 'index', initialRouteName: 'index' };

export default function AuthLayout() {
  const { status, user } = useSession();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [step, setStep] = useState<ShelfStep>(-1);
  // Set by the screen that has just finished verifying, so the shelf comes home for it.
  const [celebrating, setCelebrating] = useState(false);

  const signedIn = status === 'signedIn';
  const unverified = signedIn && !user?.isVerified;
  const hero = HERO_ROUTES.includes(pathname) || celebrating;

  // Memoised: the shelf's loop holds this across its whole run, and a new function on every
  // render would restart the effect that drives it.
  const onStep = useCallback((next: ShelfStep) => setStep(next), []);

  return (
    <ThemedView style={styles.flex}>
      {/* The lime wash behind the welcome screen, which fades as the shelf shrinks away. */}
      <View style={[styles.glow, !hero && styles.glowQuiet]} pointerEvents="none" />

      <View style={[styles.shelfLayer, { paddingTop: insets.top }]} pointerEvents="none">
        <AuthShelf
          mode={hero ? 'hero' : 'compact'}
          animate={hero && !celebrating}
          onStep={onStep}
          cheer={celebrating}
        />
      </View>

      <ShelfCelebrateContext value={setCelebrating}>
      <ShelfStepContext value={step}>
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.transparent, animation: 'fade' }}>
          {/* Verifying is its own state: signed in, but nothing in the app is reachable yet. */}
          <Stack.Protected guard={unverified}>
            <Stack.Screen name="verify-email" />
          </Stack.Protected>

          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="forgot-password" />
          </Stack.Protected>
        </Stack>
      </ShelfStepContext>
      </ShelfCelebrateContext>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  transparent: {
    backgroundColor: 'transparent'
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
