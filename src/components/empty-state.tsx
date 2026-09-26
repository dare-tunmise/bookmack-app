import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius } from '@/constants/theme';
import { BRAND_SHAPE_COLORS, dicebearUrl } from '@/lib/dicebear';

type EmptyStateProps = {
  // Picks the DiceBear illustration; the same seed always gives the same image.
  seed: string;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
};

// Empty state from the navigation design: illustration, title, one line of help, and a button.
export function EmptyState({ seed, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Image
        source={dicebearUrl('shapes', seed, 'eef7e8', BRAND_SHAPE_COLORS)}
        style={styles.image}
        accessibilityIgnoresInvertColors
      />
      <ThemedText type="h3" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      {action ? <Button title={action.label} onPress={action.onPress} style={styles.button} /> : null}
    </View>
  );
}

const IMAGE_SIZE = 96;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.brandTint
  },
  title: {
    marginTop: 8,
    textAlign: 'center'
  },
  center: {
    textAlign: 'center'
  },
  button: {
    marginTop: 8
  }
});
