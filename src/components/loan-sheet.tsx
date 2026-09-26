import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Schemas } from '@/api/client';
import { BookCover } from '@/components/book-cover';
import { BottomSheet } from '@/components/bottom-sheet';
import { LoanCard } from '@/components/loan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { loanDueText } from '@/lib/loans';

type Loan = Schemas['Loan'];

type LoanRowProps = {
  loan: Loan;
  onPress: () => void;
  // Hide the borrower's name where it's already clear, e.g. on the borrower's own page.
  showBorrower?: boolean;
};

export function LoanRow({ loan, onPress, showBorrower = true }: LoanRowProps) {
  const overdue = loan.status === 'overdue';

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <ThemedView type={pressed ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
          <BookCover title={loan.book?.title ?? '?'} thumbnail={loan.book?.thumbnail ?? null} />
          <View style={styles.rowText}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {loan.book?.title ?? 'Deleted book'}
            </ThemedText>
            {showBorrower ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {loan.borrower?.name ?? 'Deleted borrower'}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={overdue ? styles.overdue : undefined}>
              {loanDueText(loan)}
            </ThemedText>
          </View>
        </ThemedView>
      )}
    </Pressable>
  );
}

type LoanSheetProps = {
  loan: Loan | null;
  onClose: () => void;
  onReturned: () => void;
};

// A loan in a bottom sheet: the book, who has it, and Mark returned / Send reminder.
export function LoanSheet({ loan, onClose, onReturned }: LoanSheetProps) {
  // Keep showing the last loan while the sheet slides closed.
  const [shownLoan, setShownLoan] = useState(loan);
  if (loan && loan !== shownLoan) setShownLoan(loan);

  return (
    <BottomSheet visible={loan !== null} onClose={onClose}>
      {shownLoan ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <BookCover title={shownLoan.book?.title ?? '?'} thumbnail={shownLoan.book?.thumbnail ?? null} size={64} />
            <View style={styles.rowText}>
              <ThemedText accessibilityRole="header" style={styles.sheetTitle}>
                {shownLoan.book?.title ?? 'Deleted book'}
              </ThemedText>
              {shownLoan.book ? <ThemedText style={styles.caption}>{shownLoan.book.author}</ThemedText> : null}
            </View>
          </View>
          <LoanCard key={shownLoan.id} loan={shownLoan} onReturned={onReturned} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.card,
    alignItems: 'center'
  },
  rowText: {
    flex: 1,
    gap: Spacing.half
  },
  overdue: {
    color: Colors.danger
  },
  sheet: {
    gap: 20,
    paddingBottom: Spacing.two
  },
  sheetHeader: {
    flexDirection: 'row',
    gap: 14
  },
  sheetTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text
  },
  caption: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary
  }
});
