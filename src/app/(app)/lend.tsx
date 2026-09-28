import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, type Schemas } from '@/api/client';
import { errorMessage, toApiError } from '@/api/errors';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { usePlanLimit } from '@/components/plan-limit-sheet';
import { SegmentedControl } from '@/components/segmented-control';
import { useSnackbar } from '@/components/snackbar';
import { FieldError, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/brand';
import { Radius, Spacing } from '@/constants/theme';
import { useFormErrors } from '@/hooks/use-form-errors';
import { formatDate } from '@/lib/loans';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/validation';

type Book = Schemas['Book'];
type Borrower = Schemas['Borrower'];

const SEARCH_DEBOUNCE_MS = 300;
const BORROWER_LIST_SIZE = 50;
const BORROWER_FIELDS = ['name', 'email', 'phone'] as const;

const DUE_PRESETS = [
  { key: '1-week', label: '1 week', days: 7 },
  { key: '2-weeks', label: '2 weeks', days: 14 },
  { key: '1-month', label: '1 month', days: 30 }
] as const;

// Loans are due at the end of the chosen day, so a book due today isn't overdue until tomorrow.
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const daysFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return endOfDay(date);
};

const EMPTY_BORROWER = { name: '', email: '', phone: '' };

// Opened with ?bookId= from a book's details, or with ?bookId=&borrowerId= from a borrower's page
// (the borrower is then already chosen).
export default function LendScreen() {
  const { bookId, borrowerId } = useLocalSearchParams<{ bookId: string; borrowerId?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [borrowers, setBorrowers] = useState<Borrower[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [addingBorrower, setAddingBorrower] = useState(false);
  const [newBorrower, setNewBorrower] = useState(EMPTY_BORROWER);
  const [savingBorrower, setSavingBorrower] = useState(false);
  const borrowerErrors = useFormErrors(BORROWER_FIELDS, {
    byCode: { BORROWER_EXISTS: { field: 'email', message: 'You already have a borrower with this email' } },
    messages: { email: INVALID_EMAIL_MESSAGE }
  });
  const [dueAt, setDueAt] = useState(() => daysFromToday(14));
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [lending, setLending] = useState(false);
  const [lendError, setLendError] = useState<string | null>(null);
  const snackbar = useSnackbar();
  const { show: showPlanLimit } = usePlanLimit();

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/books/{id}', { params: { path: { id: bookId } } })
      .then(({ data }) => {
        if (!cancelled && data) setBook(data.data);
      })
      // The book header is optional; lending reports any real problem with the book.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!borrowerId) return;
    let cancelled = false;
    api
      .GET('/borrowers/{id}', { params: { path: { id: borrowerId } } })
      .then(({ data }) => {
        if (!cancelled && data) setBorrower(data.data);
      })
      // If the borrower can't be loaded, the list below still lets the user pick them.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [borrowerId]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api
      .GET('/borrowers', { params: { query: { q: query || undefined, limit: BORROWER_LIST_SIZE } } })
      .then(({ data, error: apiError }) => {
        if (!data) throw toApiError(apiError);
        if (cancelled) return;
        setBorrowers(data.data);
        setListError(null);
      })
      .catch((err) => {
        if (!cancelled) setListError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // With no borrowers yet, go straight to adding one.
  const hasNoBorrowers = borrowers !== null && borrowers.length === 0 && !query;
  const showNewBorrowerForm = addingBorrower || hasNoBorrowers;

  const changeNewBorrower = (field: (typeof BORROWER_FIELDS)[number], value: string) => {
    setNewBorrower((current) => ({ ...current, [field]: value }));
    borrowerErrors.clearFieldError(field);
  };

  const checkEmail = () => {
    if (newBorrower.email.trim() && !isValidEmail(newBorrower.email)) {
      borrowerErrors.setFieldError('email', INVALID_EMAIL_MESSAGE);
    }
  };

  const addBorrower = async () => {
    borrowerErrors.clearErrors();
    if (!isValidEmail(newBorrower.email)) {
      borrowerErrors.setFieldError('email', INVALID_EMAIL_MESSAGE);
      return;
    }

    setSavingBorrower(true);
    try {
      const { data, error: apiError } = await api.POST('/borrowers', {
        body: {
          name: newBorrower.name.trim(),
          email: newBorrower.email.trim(),
          phone: newBorrower.phone.trim() || null
        }
      });
      if (!data) throw toApiError(apiError);
      setBorrower(data.data);
      setAddingBorrower(false);
      setNewBorrower(EMPTY_BORROWER);
    } catch (err) {
      borrowerErrors.showError(err);
    } finally {
      setSavingBorrower(false);
    }
  };

  const onDatePicked = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) setDueAt(endOfDay(date));
  };

  const pickDate = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: dueAt, mode: 'date', minimumDate: new Date(), onChange: onDatePicked });
    } else {
      setIosPickerOpen((open) => !open);
    }
  };

  const lend = async () => {
    if (!borrower) return;
    setLending(true);
    setLendError(null);
    try {
      const { data, error: apiError } = await api.POST('/loans', {
        body: { bookId, borrowerId: borrower.id, dueAt: dueAt.toISOString() }
      });
      if (!data) throw toApiError(apiError);
      router.back();
      snackbar.show(`Lent to ${borrower.name}`);
    } catch (err) {
      // A plan limit opens the upgrade sheet rather than showing a dead-end message.
      if (!showPlanLimit(err)) setLendError(errorMessage(err));
      setLending(false);
    }
  };

  return (
    <FormScreen title="Lend this book" edges={['bottom', 'left', 'right']}>
      {book ? (
        <View style={styles.bookRow}>
          <BookCover title={book.title} thumbnail={book.thumbnail} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {book.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {book.author}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold">{"Who's borrowing it?"}</ThemedText>

        {borrower ? (
          <ThemedView type="backgroundElement" style={styles.borrower}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{borrower.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {borrower.email}
              </ThemedText>
            </View>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setBorrower(null)}>
              <ThemedText type="smallBold" style={styles.link}>
                Change
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : showNewBorrowerForm ? (
          <View style={styles.section}>
            <TextField
              label="Name"
              value={newBorrower.name}
              onChangeText={(name) => changeNewBorrower('name', name)}
              error={borrowerErrors.fieldErrors.name}
              autoCapitalize="words"
              autoComplete="name"
            />
            <TextField
              label="Email"
              value={newBorrower.email}
              onChangeText={(email) => changeNewBorrower('email', email)}
              onBlur={checkEmail}
              error={borrowerErrors.fieldErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              hint="They'll get an email confirming the loan, and any reminders you send."
            />
            <TextField
              label="Phone (optional)"
              value={newBorrower.phone}
              onChangeText={(phone) => changeNewBorrower('phone', phone)}
              error={borrowerErrors.fieldErrors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Button
              title="Save borrower"
              onPress={addBorrower}
              loading={savingBorrower}
              disabled={!newBorrower.name.trim() || !newBorrower.email.trim()}
            />
            {borrowerErrors.formError ? <FieldError message={borrowerErrors.formError} /> : null}
            {hasNoBorrowers ? null : (
              <Button title="Choose an existing borrower" variant="secondary" onPress={() => setAddingBorrower(false)} />
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <TextField
              label="Search borrowers"
              value={search}
              onChangeText={setSearch}
              placeholder="Name or email"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {listError ? (
              <FieldError message={listError} />
            ) : borrowers === null ? (
              <ActivityIndicator />
            ) : borrowers.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {`No borrowers match "${query}".`}
              </ThemedText>
            ) : (
              // The search field stays put above while the list scrolls on its own.
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.borrowerList}
                contentContainerStyle={styles.borrowerListContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {borrowers.map((item) => (
                  <BorrowerRow key={item.id} borrower={item} onPress={() => setBorrower(item)} />
                ))}
              </ScrollView>
            )}
            <Button title="Add a new borrower" variant="secondary" onPress={() => setAddingBorrower(true)} />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Due back</ThemedText>
        <SegmentedControl
          accessibilityLabel="Due back"
          options={DUE_PRESETS}
          // No preset is selected after picking a custom date.
          value={DUE_PRESETS.find((preset) => daysFromToday(preset.days).getTime() === dueAt.getTime())?.key ?? null}
          onChange={(key) => {
            const preset = DUE_PRESETS.find((option) => option.key === key);
            if (preset) setDueAt(daysFromToday(preset.days));
          }}
        />
        <Button title={`Pick a date · ${formatDate(dueAt)}`} variant="secondary" onPress={pickDate} />
        {iosPickerOpen ? (
          <DateTimePicker value={dueAt} mode="date" display="inline" minimumDate={new Date()} onChange={onDatePicked} />
        ) : null}
      </View>

      <Button
        title={borrower ? `Lend to ${borrower.name}` : 'Lend'}
        onPress={lend}
        loading={lending}
        disabled={!borrower}
      />
      {lendError ? <FieldError message={lendError} /> : null}
      {borrower ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {`We'll email ${borrower.name} to confirm the loan and when it's due.`}
        </ThemedText>
      ) : null}
    </FormScreen>
  );
}

function BorrowerRow({ borrower, onPress }: { borrower: Borrower; onPress: () => void }) {
  const booksOut = borrower.loans.active;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <ThemedView type={pressed ? 'backgroundSelected' : 'backgroundElement'} style={styles.borrower}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{borrower.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {borrower.email}
            </ThemedText>
          </View>
          {booksOut > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`${booksOut} ${booksOut === 1 ? 'book' : 'books'} out`}
            </ThemedText>
          ) : null}
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  bookRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center'
  },
  section: {
    gap: Spacing.two
  },
  borrower: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card
  },
  link: {
    color: Brand.primary
  },
  borrowerList: {
    // About four rows; longer lists scroll inside this area.
    maxHeight: 300
  },
  borrowerListContent: {
    gap: Spacing.two
  },
  center: {
    textAlign: 'center'
  }
});
