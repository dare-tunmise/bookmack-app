import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius } from '@/constants/theme';

const CONFIRM_WORD = 'DELETE';

const REMOVED = [
  'Your books and their details',
  'Your borrowers and loan history',
  'Your recommendations and activity',
  'Any paid subscription (it is cancelled first)'
];

export default function DeleteAccountScreen() {
  const { signOut } = useSession();
  const snackbar = useSnackbar();
  const [typed, setTyped] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setConfirming(false);
    setDeleting(true);
    setError(null);
    try {
      const { error: apiError, response } = await api.DELETE('/me');
      if (!response.ok) throw toApiError(apiError);
      snackbar.show('Your account was deleted');
      // The account is gone, so signing out just clears this device and returns to the welcome screen.
      await signOut();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <FormScreen
      title="Delete your account?"
      subtitle="This permanently deletes your BookMack account. It can't be undone."
      edges={['bottom', 'left', 'right']}>
      <View style={styles.card}>
        <View style={styles.warningIcon}>
          <Icon name="trash" color={Colors.danger} size={24} />
        </View>
        <ThemedText type="smallBold">What gets deleted</ThemedText>
        {REMOVED.map((item) => (
          <View key={item} style={styles.item}>
            <View style={styles.dot} />
            <ThemedText type="small" style={styles.itemText}>
              {item}
            </ThemedText>
          </View>
        ))}
      </View>

      <TextField
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button
        title="Delete my account"
        variant="danger"
        onPress={() => setConfirming(true)}
        loading={deleting}
        disabled={typed.trim() !== CONFIRM_WORD}
      />
      {error ? <FieldError message={error} /> : null}

      <ConfirmDialog
        visible={confirming}
        title="Delete your account?"
        message="Your books, borrowers, and history will be deleted for good."
        confirmLabel="Delete"
        destructive
        onConfirm={deleteAccount}
        onCancel={() => setConfirming(false)}
      />
    </FormScreen>
  );
}

const WARNING_ICON_SIZE = 48;

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 20,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  warningIcon: {
    width: WARNING_ICON_SIZE,
    height: WARNING_ICON_SIZE,
    borderRadius: WARNING_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerTint,
    marginBottom: 4
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger
  },
  itemText: {
    flex: 1
  }
});
