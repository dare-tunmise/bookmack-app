import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { ButtonGroup } from '@/components/button-group';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/brand';
import { Radius, Spacing } from '@/constants/theme';
import { formatDate, loanDueText } from '@/lib/loans';

type Loan = Schemas['Loan'];

type LoanCardProps = {
  loan: Loan;
  onReturned: (loan: Loan) => void;
};

// Who has the book and when it's due, with the actions for a loan that's still open.
export function LoanCard({ loan, onReturned }: LoanCardProps) {
  const [busy, setBusy] = useState<'return' | 'remind' | 'reminders' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Held locally: the parents of this card care whether the loan came back, not whether its
  // reminders are on, so flipping the switch doesn't need to travel back up.
  const [remindersOn, setRemindersOn] = useState(loan.reminder.enabled);
  const snackbar = useSnackbar();
  const borrowerName = loan.borrower?.name ?? 'a deleted borrower';
  const overdue = loan.status === 'overdue';

  const markReturned = async () => {
    setBusy('return');
    setError(null);
    try {
      const { data, error: apiError } = await api.POST('/loans/{id}/return', { params: { path: { id: loan.id } } });
      if (!data) throw toApiError(apiError);
      onReturned(data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const sendReminder = async () => {
    setBusy('remind');
    setError(null);
    try {
      const { error: apiError, response } = await api.POST('/loans/{id}/reminder/send', {
        params: { path: { id: loan.id } }
      });
      if (!response.ok) throw toApiError(apiError);
      snackbar.show(`Reminder sent to ${borrowerName}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // The automatic ladder runs from two days before the due date to a month past it, then stops of
  // its own accord (see config/reminderSchedule.mjs in bookmack-api). This is the switch for
  // giving up on a loan sooner — a book you know is not coming back, or a borrower you would
  // rather chase yourself.
  const toggleReminders = async () => {
    const turningOff = remindersOn;
    setBusy('reminders');
    setError(null);
    try {
      const { error: apiError, response } = turningOff
        ? await api.DELETE('/loans/{id}/reminder', { params: { path: { id: loan.id } } })
        : await api.PUT('/loans/{id}/reminder', { params: { path: { id: loan.id } }, body: {} });
      if (!response.ok) throw toApiError(apiError);
      setRemindersOn(!turningOff);
      snackbar.show(
        turningOff
          ? `No more automatic reminders to ${borrowerName} about this book`
          : `Automatic reminders back on for ${borrowerName}`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    // Loan cards sit inside white sheets, so they use the app background to stand out.
    <ThemedView type="background" style={styles.card}>
      <ThemedText type="smallBold">Lent to {borrowerName}</ThemedText>
      {loan.borrower ? (
        <ThemedText type="small" themeColor="textSecondary">
          {loan.borrower.email}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        <ThemedText type="smallBold" style={overdue ? styles.danger : undefined}>
          {loanDueText(loan)}
        </ThemedText>
        {` · lent ${formatDate(loan.borrowedAt)}`}
      </ThemedText>

      {error ? (
        <ThemedText type="small" accessibilityRole="alert" style={styles.danger}>
          {error}
        </ThemedText>
      ) : null}

      {remindersOn ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          Automatic reminders are off for this loan.
        </ThemedText>
      )}

      {loan.returnedAt ? null : (
        <View style={styles.actions}>
          <ButtonGroup
            actions={[
              {
                label: 'Mark returned',
                tone: 'primary',
                onPress: markReturned,
                loading: busy === 'return',
                disabled: busy !== null
              },
              {
                label: 'Send reminder',
                onPress: sendReminder,
                loading: busy === 'remind',
                disabled: busy !== null || !loan.borrower
              }
            ]}
          />
          {/* A third segment in the group above would truncate at this card's width, and this is a
              quieter decision than the two beside it, so it sits under them as plain text. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy !== null, busy: busy === 'reminders' }}
            accessibilityLabel={
              remindersOn
                ? 'Stop sending automatic reminders for this loan'
                : 'Turn automatic reminders back on for this loan'
            }
            disabled={busy !== null}
            onPress={toggleReminders}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
              {remindersOn ? 'Stop automatic reminders' : 'Turn automatic reminders on'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card
  },
  danger: {
    color: Brand.danger
  },
  actions: {
    marginTop: Spacing.two,
    gap: Spacing.two
  },
  toggle: {
    alignSelf: 'center'
  },
  pressed: {
    opacity: 0.6
  },
  underline: {
    textDecorationLine: 'underline'
  }
});
