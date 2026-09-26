import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

const OPTIONS: { title: string; description: string; href: Href; icon: IconName }[] = [
  {
    title: 'Scan a book',
    description: 'Scan the barcode on the back, or snap a photo of the front cover.',
    href: '/scan',
    icon: 'scan'
  },
  {
    title: 'Scan a shelf',
    description: 'Keep scanning barcode after barcode, then add them all at once.',
    href: '/scan-shelf',
    icon: 'scanShelf'
  },
  {
    title: 'Search by title',
    description: 'Find it by title, author, or ISBN.',
    href: '/search',
    icon: 'search'
  },
  {
    title: 'Type it in',
    description: 'Enter the title and author yourself.',
    href: '/book-form',
    icon: 'edit'
  }
];

type AddBookSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// The ways to add a book, in a slide-up sheet (list-of-options variant from the navigation design).
export function AddBookSheet({ visible, onClose }: AddBookSheetProps) {
  const choose = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ThemedText type="h2" accessibilityRole="header">
        Add a book
      </ThemedText>

      <View>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.title}
            accessibilityRole="button"
            onPress={() => choose(option.href)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={styles.optionIcon}>
              <Icon name={option.icon} color={Colors.text} size={22} />
            </View>
            <View style={styles.optionText}>
              <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
              <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const OPTION_ICON_SIZE = 48;

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: Radius.input
  },
  pressed: {
    backgroundColor: Colors.background
  },
  optionIcon: {
    width: OPTION_ICON_SIZE,
    height: OPTION_ICON_SIZE,
    borderRadius: OPTION_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandTint
  },
  optionText: {
    flex: 1
  },
  optionTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text
  },
  optionDescription: {
    marginTop: 2,
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary
  }
});
