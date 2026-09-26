import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  // Shows the confirm action in red, e.g. for deleting.
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmation dialog from the navigation design: title, one line of text, Cancel and the action.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cancel" style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText style={styles.body}>{message}</ThemedText>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
              <ThemedText style={[styles.action, styles.cancel]}>Cancel</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onConfirm}>
              <ThemedText style={[styles.action, destructive ? styles.destructive : styles.cancel]}>
                {confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.backdrop
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    gap: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textBody
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20
  },
  action: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22
  },
  cancel: {
    color: Colors.brand
  },
  destructive: {
    color: Colors.danger
  }
});
