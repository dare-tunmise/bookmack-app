import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/app-bar';
import { SHELF_COMPACT_BOTTOM } from '@/components/auth-shelf';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

export const AUTH_CONTENT_WIDTH = 480;

// The back-arrow row above the scrolling content.
const TOP_BAR_HEIGHT = 48;
// Clears the parked shelf with room to spare, rather than guessing at a number that has to be
// kept in step with it by hand.
const SHELF_CLEARANCE = 16;
const CONTENT_TOP = Math.round(SHELF_COMPACT_BOTTOM - TOP_BAR_HEIGHT + SHELF_CLEARANCE);

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
          {/* Title and subtitle are one block: they belong together at 8px, and the 20px rhythm
              below applies between blocks, not inside this one. */}
          <Animated.View entering={rise(1)} style={styles.head}>
            <ThemedText accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
          </Animated.View>
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
    height: TOP_BAR_HEIGHT,
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
    // Starts below the shelf the layout parks above this, derived from the shelf's own geometry.
    paddingTop: CONTENT_TOP,
    // The rhythm between blocks, set here so no screen can forget it. It used to be each
    // screen's own business, and the one screen that supplied no margins at all — forgot
    // password — rendered its heading, field and button touching each other. The value is the
    // design's own: `.or { margin: 20px 0 }`.
    rowGap: 20
  },
  head: {
    gap: Spacing.two
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
    color: Colors.textSecondary
  }
});
