import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const [busy, setBusy] = useState<'return' | 'remind' | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    marginTop: Spacing.two
  }
});
