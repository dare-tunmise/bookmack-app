import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/app-bar';
import { AuthBackground } from '@/components/auth-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

export const AUTH_CONTENT_WIDTH = 480;

type AuthScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  // DiceBear notionists illustration shown above the title.
  illustration: { seed: string; backgroundColor: string };
}>;

// Layout for signed-out screens: vector background, illustration, title, and a scrollable form
// kept clear of the keyboard. Shows a back arrow when there's a screen to go back to.
export function AuthScreen({ title, subtitle, illustration, children }: AuthScreenProps) {
  const canGoBack = router.canGoBack();

  return (
    <ThemedView style={styles.flex}>
      <AuthBackground />
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          {canGoBack ? <IconButton icon="arrowLeft" label="Go back" onPress={() => router.back()} /> : null}
        </View>
        {/* See FormScreen: `undefined` on Android is a no-op, and edge-to-edge means the window
            is not resized for the keyboard either. */}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Image
              source={dicebearUrl('notionists', illustration.seed, illustration.backgroundColor)}
              style={styles.illustration}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.heading}>
              <ThemedText type="subtitle" accessibilityRole="header">
                {title}
              </ThemedText>
              {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            </View>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const ILLUSTRATION_SIZE = 96;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  topBar: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: AUTH_CONTENT_WIDTH,
    alignSelf: 'center'
  },
  illustration: {
    width: ILLUSTRATION_SIZE,
    height: ILLUSTRATION_SIZE,
    borderRadius: Radius.pill
  },
  heading: {
    gap: 4,
    marginBottom: 8
  }
});
