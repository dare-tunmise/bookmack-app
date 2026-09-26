// Per-weight imports bundle only the weights the app uses; the package roots include every weight.
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession } from '@/auth/session';
import { PlanLimitProvider } from '@/components/plan-limit-sheet';
import { SnackbarProvider } from '@/components/snackbar';
import { Colors } from '@/constants/theme';

// Keep the splash screen up until the fonts are loaded and the saved session has been checked.
SplashScreen.preventAutoHideAsync();

// Navigation surfaces (screens, headers, drawer) use the app palette.
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.brand,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.danger
  }
};

export default function RootLayout() {
  // Names must match Fonts in src/constants/theme.ts.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  // If the fonts fail to load, carry on with the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    // Needed for gesture-driven navigators such as the side drawer.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider value={navigationTheme}>
        <SnackbarProvider>
          <SessionProvider>
            <PlanLimitProvider>
              <RootNavigator />
            </PlanLimitProvider>
          </SessionProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Screens are grouped by session state. When the state changes (sign in, verify, sign out),
// Stack.Protected removes the screens that no longer apply and redirects to one that does.
function RootNavigator() {
  const session = useSession();

  useEffect(() => {
    if (session.status !== 'loading') SplashScreen.hideAsync();
  }, [session.status]);

  if (session.status === 'loading') return null;

  const signedIn = session.status === 'signedIn';
  const verified = signedIn && session.user.isVerified;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={verified}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !verified}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>

      {/* Welcome comes first: signed-out users are redirected to the first screen they can see. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}
