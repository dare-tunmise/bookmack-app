import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type FormScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  // Screens under a navigation header should leave out 'top'.
  edges?: Edge[];
}>;

// Layout for form screens: centered, scrollable, and kept clear of the keyboard. Errors belong under
// their fields (see useFormErrors), not in a banner here.
export function FormScreen({ title, subtitle, edges, children }: FormScreenProps) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={edges}>
        {/* Android needs a behavior too. This resolved to `undefined` there, which makes
            KeyboardAvoidingView do nothing at all — and since Expo puts Android in edge-to-edge,
            the window is no longer resized for the keyboard either, so nothing was compensating
            and fields simply sat behind it. */}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <ThemedText type="subtitle">{title}</ThemedText>
              {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            </View>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  heading: {
    gap: Spacing.one,
    marginBottom: Spacing.two
  }
});
