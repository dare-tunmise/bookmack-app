import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/app-bar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

export const AUTH_CONTENT_WIDTH = 480;

// Everything in the flow rises 55ms after the thing above it. One cadence across five screens is
// most of why they read as one place rather than five pages.
const STAGGER = 55;
export const rise = (index: number) => FadeInDown.delay(120 + index * STAGGER).springify().damping(16);

type AuthScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

// The shell every signed-out screen sits in: a back arrow, room for the shelf, then the heading.
//
// The illustration that used to sit above the title is gone. The shelf parked in the corner by
// the layout is the illustration now, and it is the same object on every screen — a second
// picture here would be two things competing to be what you look at.
export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.topBar}>
        {canGoBack ? <IconButton icon="arrowLeft" label="Go back" onPress={() => router.back()} /> : null}
      </View>

      {/* See FormScreen: `undefined` on Android is a no-op, and edge-to-edge means the window is
          not resized for the keyboard either. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={rise(1)}>
            <ThemedText accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
          </Animated.View>
          {subtitle ? (
            <Animated.View entering={rise(2)}>
              <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
            </Animated.View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  topBar: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: AUTH_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingBottom: 30,
    // Clears the shelf, which the layout parks in this corner at a third of its size.
    paddingTop: 56
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: Colors.text
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginTop: Spacing.two
  }
});
