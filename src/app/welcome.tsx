import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/auth-background';
import { AUTH_CONTENT_WIDTH } from '@/components/auth-screen';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Typography } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

const VALUE_POINTS: { icon: IconName; text: string }[] = [
  { icon: 'scan', text: 'Scan a barcode or snap the cover' },
  { icon: 'users', text: 'Lend books and know who has them' },
  { icon: 'bell', text: "Friendly reminders when they're due" }
];

// First screen for signed-out users.
export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.flex}>
      <AuthBackground />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.top}>
            <View style={styles.brand}>
              <BrandMark size={36} />
              <ThemedText style={styles.wordmark}>BookMack</ThemedText>
            </View>
            <Image
              source={dicebearUrl('notionists', 'bookmack-welcome', '9fe870')}
              style={styles.hero}
              accessibilityIgnoresInvertColors
            />
            <ThemedText type="title" accessibilityRole="header">
              Your books, always within reach
            </ThemedText>
            <View style={styles.points}>
              {VALUE_POINTS.map((point) => (
                <View key={point.text} style={styles.point}>
                  <View style={styles.pointIcon}>
                    <Icon name={point.icon} color={Colors.text} size={20} />
                  </View>
                  <ThemedText style={styles.pointText}>{point.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <Button title="Create account" onPress={() => router.push('/sign-up')} />
            <Button title="Log in" variant="secondary" onPress={() => router.push('/sign-in')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const HERO_SIZE = 140;
const POINT_ICON_SIZE = 40;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    width: '100%',
    maxWidth: AUTH_CONTENT_WIDTH,
    alignSelf: 'center'
  },
  top: {
    gap: 24
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: Radius.pill
  },
  points: {
    gap: 14
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  pointIcon: {
    width: POINT_ICON_SIZE,
    height: POINT_ICON_SIZE,
    borderRadius: POINT_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  pointText: {
    ...Typography.body,
    flex: 1,
    color: Colors.textBody
  },
  actions: {
    gap: 12
  }
});
