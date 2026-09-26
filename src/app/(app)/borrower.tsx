import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BorrowerAvatar } from '@/components/borrower-row';
import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoanRow, LoanSheet } from '@/components/loan-sheet';
import { SettingsRow, SettingsSection } from '@/components/settings-list';
import { DetailsSkeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { FieldError } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radius } from '@/constants/theme';

type Borrower = Schemas['Borrower'];
type Loan = Schemas['Loan'];
type Details = { borrower: Borrower; active: Loan[]; returned: Loan[] };

const ACTIVE_LIMIT = 50;
const HISTORY_LIMIT = 20;

const bookCount = (count: number) => `${count} ${count === 1 ? 'book' : 'books'}`;

// Opened with ?id= from the borrowers list.
export default function BorrowerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snackbar = useSnackbar();
  const [details, setDetails] = useState<Details | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [share, setShare] = useState<Schemas['ShelfShareInfo'] | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const load = useCallback(async () => {
    try {
      const [borrowerResult, activeResult, returnedResult] = await Promise.all([
        api.GET('/borrowers/{id}', { params: { path: { id } } }),
        api.GET('/loans', { params: { query: { borrowerId: id, status: 'active', limit: ACTIVE_LIMIT } } }),
        api.GET('/loans', { params: { query: { borrowerId: id, status: 'returned', limit: HISTORY_LIMIT } } })
      ]);
      if (!borrowerResult.data) throw toApiError(borrowerResult.error);
      if (!activeResult.data) throw toApiError(activeResult.error);
      if (!returnedResult.data) throw toApiError(returnedResult.error);

      setDetails({
        borrower: borrowerResult.data.data,
        active: activeResult.data.data,
        returned: returnedResult.data.data
      });
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }

    // Whether this person can already see the shelf. Optional: the page works without it.
    api
      .GET('/borrowers/{id}/share', { params: { path: { id } } })
      .then(({ data }) => data && setShare(data.data))
      .catch(() => {});
  }, [id]);

  // Reload when coming back, e.g. after editing them or lending them a book.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!details) {
    return (
      <ThemedView style={styles.centered}>
        {loadError ? (
          <>
            <FieldError message={loadError} />
            <Button title="Try again" variant="secondary" onPress={load} />
          </>
        ) : (
          <DetailsSkeleton />
        )}
      </ThemedView>
    );
  }

  const { borrower, active, returned } = details;
  const booksOut = active.length;

  // Creates the link if there isn't one, then hands it to the system share sheet, so it goes
  // straight into whatever the two of them already use to talk.
  const sendLink = async () => {
    setSharing(true);
    try {
      const { data, error } = await api.POST('/borrowers/{id}/share', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      setShare(data.data);

      if (data.data.url) {
        await Share.share({
          message: `I shared my bookshelf with you on BookMack — have a look and ask for anything you fancy: ${data.data.url}`
        });
      }
    } catch (err) {
      snackbar.show(errorMessage(err));
    } finally {
      setSharing(false);
    }
  };

  const stopSharing = async () => {
    setConfirmingRevoke(false);
    try {
      const { error, response } = await api.DELETE('/borrowers/{id}/share', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
      setShare({ shared: false, url: null, sharedAt: null, lastViewedAt: null });
      snackbar.show(`${borrower.name}'s link no longer works`);
    } catch (err) {
      snackbar.show(errorMessage(err));
    }
  };

  const deleteBorrower = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error, response } = await api.DELETE('/borrowers/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
      router.back();
      snackbar.show(`Deleted ${borrower.name}`);
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <BorrowerAvatar email={borrower.email} name={borrower.name} size={88} />
          <ThemedText type="h2" accessibilityRole="header" style={styles.center}>
            {borrower.name}
          </ThemedText>
        </View>

        <SettingsSection>
          <SettingsRow
            icon="mail"
            label="Email"
            value={borrower.email}
            onPress={() => Linking.openURL(`mailto:${borrower.email}`)}
          />
          {borrower.phone ? (
            <SettingsRow
              icon="phone"
              label="Phone"
              value={borrower.phone}
              onPress={() => Linking.openURL(`tel:${borrower.phone}`)}
            />
          ) : null}
        </SettingsSection>

        <View style={styles.stats}>
          <StatCard value={booksOut} label={booksOut === 1 ? 'Book out' : 'Books out'} />
          <StatCard
            value={borrower.loans.total}
            label={borrower.loans.total === 1 ? 'Loan in total' : 'Loans in total'}
          />
        </View>

        <View style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Your shelf
          </ThemedText>
          {share?.shared ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {`${borrower.name} can see your shelf${share.lastViewedAt ? ', and has looked' : ' but hasn’t looked yet'}. Books you mark hidden never appear.`}
              </ThemedText>
              <ButtonGroup
                actions={[
                  { label: 'Send the link again', onPress: sendLink, loading: sharing },
                  { label: 'Stop sharing', tone: 'danger', onPress: () => setConfirmingRevoke(true) }
                ]}
              />
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {`Let ${borrower.name} browse what you have and ask to borrow. You decide every time.`}
              </ThemedText>
              <Button title="Share my shelf" variant="secondary" onPress={sendLink} loading={sharing} />
            </>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title="Lend a book"
            onPress={() => router.push({ pathname: '/pick-book', params: { borrowerId: borrower.id } })}
          />
          <Button
            title="Recommend a book"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/pick-book', params: { borrowerId: borrower.id, for: 'recommend' } })
            }
          />
          <ButtonGroup
            actions={[
              {
                label: 'Edit',
                onPress: () => router.push({ pathname: '/borrower-form', params: { id: borrower.id } })
              },
              {
                label: 'Delete',
                tone: 'danger',
                onPress: () => setConfirmingDelete(true),
                loading: deleting,
                disabled: booksOut > 0
              }
            ]}
          />
          {booksOut > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`They still have ${bookCount(booksOut)}. Mark ${booksOut === 1 ? 'it' : 'them'} returned before deleting.`}
            </ThemedText>
          ) : null}
          {deleteError ? <FieldError message={deleteError} /> : null}
        </View>

        <LoanList title="Has now" loans={active} empty="Nothing borrowed right now." onPress={setSelectedLoan} />
        <LoanList title="History" loans={returned} empty="No returned books yet." onPress={setSelectedLoan} />
      </ScrollView>

      <LoanSheet
        loan={selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onReturned={() => {
          setSelectedLoan(null);
          load();
        }}
      />

      <ConfirmDialog
        visible={confirmingRevoke}
        title="Stop sharing your shelf?"
        message={`${borrower.name}'s link stops working straight away. You can share again later, and they'll get a new link.`}
        confirmLabel="Stop sharing"
        destructive
        onConfirm={stopSharing}
        onCancel={() => setConfirmingRevoke(false)}
      />

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete this borrower?"
        message={`"${borrower.name}" will be removed. Their past loans stay in your history.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteBorrower}
        onCancel={() => setConfirmingDelete(false)}
      />
    </ThemedView>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <ThemedText style={styles.statValue}>{String(value)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

type LoanListProps = {
  title: string;
  loans: Loan[];
  empty: string;
  onPress: (loan: Loan) => void;
};

function LoanList({ title, loans, empty, onPress }: LoanListProps) {
  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {loans.length > 0 ? (
        loans.map((loan) => (
          <LoanRow key={loan.id} loan={loan} showBorrower={false} onPress={() => onPress(loan)} />
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmpty}>
          {empty}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    padding: 24
  },
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center'
  },
  profile: {
    alignItems: 'center',
    gap: 10
  },
  center: {
    textAlign: 'center'
  },
  stats: {
    flexDirection: 'row',
    gap: 12
  },
  statCard: {
    flex: 1,
    gap: 2,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  statValue: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.text
  },
  actions: {
    gap: 8
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    paddingHorizontal: 4,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  sectionEmpty: {
    paddingHorizontal: 4
  }
});
