import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { Badge } from '@/components/badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

type Borrower = Schemas['Borrower'];

// A borrower's DiceBear avatar, seeded by email so the same person always gets the same face.
export function BorrowerAvatar({ email, name, size = 44 }: { email: string; name: string; size?: number }) {
  return (
    <Image
      source={dicebearUrl('notionists', email, 'eef7e8')}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.brandTint }}
      accessibilityLabel={name}
    />
  );
}

export const booksOutLabel = (count: number) => `${count} ${count === 1 ? 'book' : 'books'} out`;

export function BorrowerRow({ borrower, onPress }: { borrower: Borrower; onPress: () => void }) {
  const booksOut = borrower.loans.active;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <ThemedView type={pressed ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
          <BorrowerAvatar email={borrower.email} name={borrower.name} />
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {borrower.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {borrower.email}
            </ThemedText>
          </View>
          {booksOut > 0 ? <Badge label={booksOutLabel(booksOut)} tone="accent" style={styles.badge} /> : null}
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 12,
    borderRadius: Radius.card
  },
  text: {
    flex: 1,
    gap: Spacing.half
  },
  badge: {
    alignSelf: 'center'
  }
});
