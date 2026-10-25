import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Schemas } from '@/api/client';
import { useSession } from '@/auth/session';
import { BrandMark } from '@/components/brand-mark';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

type Borrower = Schemas['Borrower'];

// The sidebar, and on a phone the drawer — one component, not two.
//
// It follows the same rules as the bottom bar: one icon family, outline at rest and filled when
// chosen, and a selected state you can see rather than infer. There are no borders on rows and no
// dividers between them; shape and space do the separating, which is what keeps a list this long
// calm.
//
// The account moved off the top and down to the bottom row, where it reads as "you" rather than as
// a header. What belongs at the top is the product's name and the one control you reach for most.

const PEOPLE_SHOWN = 3;

// Android needs this switched on before LayoutAnimation does anything.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Route =
  | 'index'
  | 'wanted'
  | 'loans'
  | 'borrowers'
  | 'requests'
  | 'stats'
  | 'activity'
  | 'account'
  | 'plan';

type Item = { route: Route; label: string; icon: IconName };

// The Library's own tabs, opened in place rather than hidden behind the screen. These keys are
// the Library screen's, not this file's: it reads them off the route param, so a name invented
// here would land on a screen that quietly ignored it.
const LIBRARY_TABS = [
  { key: 'recent', label: 'Recent' },
  { key: 'all', label: 'My books' },
  { key: 'reading', label: 'Reading' },
  { key: 'lent', label: 'Lent out' }
] as const;

const ITEMS: Item[] = [
  { route: 'wanted', label: 'Wanted', icon: 'wanted' },
  { route: 'loans', label: 'Loans', icon: 'loans' },
  { route: 'borrowers', label: 'Borrowers', icon: 'users' },
  { route: 'requests', label: 'Requests', icon: 'requests' },
  { route: 'stats', label: 'Stats', icon: 'stats' },
  { route: 'activity', label: 'Activity', icon: 'clock' },
  { route: 'plan', label: 'Plan & limits', icon: 'card' }
];

export function AppDrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index]?.name;
  // Signing out used to happen on the first tap. It is a one-tap action with no undo sitting
  // directly under the last navigation row, which is a place thumbs land by accident.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [people, setPeople] = useState<Borrower[]>([]);
  const [overdueBy, setOverdueBy] = useState<Set<string>>(() => new Set());
  const { count: pending, more: morePending, refresh: refreshPending } = usePendingRequests();

  // The drawer stays mounted, so without this everything in it would be whatever it was at
  // sign-in. Moving around the app is the cheapest honest trigger.
  useEffect(() => {
    refreshPending();
  }, [state.index, refreshPending]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [borrowers, overdue] = await Promise.all([
          api.GET('/borrowers', { params: { query: { limit: 20 } } }),
          api.GET('/loans', { params: { query: { status: 'overdue', limit: 50 } } })
        ]);
        if (cancelled) return;
        // Whoever is holding something, busiest first. The rest are not shown at all: a sidebar
        // is not the borrower list, it is a shortcut to the people currently involved.
        setPeople(
          (borrowers.data?.data ?? [])
            .filter((borrower) => borrower.loans.active > 0)
            .sort((a, b) => b.loans.active - a.loans.active)
        );
        setOverdueBy(
          new Set((overdue.data?.data ?? []).map((loan) => loan.borrower?.id).filter(Boolean) as string[])
        );
      } catch {
        // A sidebar that cannot show people is still a sidebar.
        if (!cancelled) setPeople([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.index]);

  const goTo = (route: Route) => {
    navigation.navigate(route);
  };

  const openLibraryTab = (tab: string) => {
    navigation.navigate('index', { tab });
  };

  const toggleLibrary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setLibraryOpen((open) => !open);
  };

  return (
    // The panel runs to the screen edge, so its own footer has to clear the gesture area itself.
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.head}>
        <BrandMark size={34} />
        <ThemedText style={styles.wordmark}>BookMack</ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search your books"
        onPress={() => {
          navigation.closeDrawer();
          router.push('/search');
        }}
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
        <Icon name="search" color={Colors.textSecondary} size={20} />
        <ThemedText style={styles.searchText}>Search</ThemedText>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Eyebrow>Your library</Eyebrow>

        <Row
          icon="library"
          label="Library"
          active={currentRoute === 'index'}
          onPress={toggleLibrary}
          trailing={
            <Icon
              name={libraryOpen ? 'chevronUp' : 'chevronDown'}
              color={Colors.textSecondary}
              size={16}
            />
          }
        />

        {libraryOpen ? (
          <View style={styles.tree}>
            {LIBRARY_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                onPress={() => openLibraryTab(tab.key)}
                style={({ pressed }) => [styles.sub, pressed && styles.subPressed]}>
                <View style={styles.subTick} />
                <ThemedText style={styles.subLabel}>{tab.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {ITEMS.map((item) => (
          <Row
            key={item.route}
            icon={item.icon}
            label={item.label}
            active={currentRoute === item.route}
            onPress={() => goTo(item.route)}
            trailing={
              item.route === 'requests' && pending > 0 ? (
                <Count hot>{morePending ? `${pending}+` : String(pending)}</Count>
              ) : null
            }
          />
        ))}

        {people.length ? (
          <>
            <View style={styles.rule} />
            <Eyebrow
              action={{
                label: 'Add a borrower',
                onPress: () => {
                  navigation.closeDrawer();
                  router.push('/borrower-form');
                }
              }}>
              People
            </Eyebrow>

            {people.slice(0, PEOPLE_SHOWN).map((person) => {
              const late = overdueBy.has(person.id);
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${person.name}, ${late ? 'has an overdue book' : `has ${person.loans.active}`}`}
                  onPress={() => {
                    navigation.closeDrawer();
                    router.push({ pathname: '/borrower', params: { id: person.id } });
                  }}
                  style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
                  <View>
                    <Image
                      source={dicebearUrl('notionists', person.name, 'eef7e8')}
                      style={styles.personAvatar}
                      accessibilityLabel={person.name}
                    />
                    {/* Green holds a book, red is past its due date. The one dot says which of the
                        two things you might act on is true. */}
                    <View style={[styles.dot, { backgroundColor: late ? Colors.danger : '#3E9B27' }]} />
                  </View>
                  <ThemedText style={styles.personName} numberOfLines={1}>
                    {person.name}
                  </ThemedText>
                  <ThemedText style={styles.personStatus}>
                    {late ? 'Overdue' : person.loans.active === 1 ? 'Has a book' : `Has ${person.loans.active}`}
                  </ThemedText>
                </Pressable>
              );
            })}
          </>
        ) : null}

        <View style={styles.rule} />
        <Row icon="logOut" label="Sign out" active={false} danger onPress={() => setConfirmingSignOut(true)} />
      </ScrollView>

      {user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          onPress={() => goTo('account')}
          style={({ pressed }) => [styles.me, pressed && styles.pressed]}>
          <Image
            source={dicebearUrl('notionists', user.name, '9fe870')}
            style={styles.meAvatar}
            accessibilityLabel={user.name}
          />
          <View style={styles.meWho}>
            <ThemedText style={styles.meName} numberOfLines={1}>
              {user.name}
            </ThemedText>
            <ThemedText style={styles.mePlan}>
              {user.plan === 'premium' ? 'PREMIUM PLAN' : 'BASIC PLAN'}
            </ThemedText>
          </View>
          <Icon name="chevronRight" color={Colors.textSecondary} size={16} />
        </Pressable>
      ) : null}

      <ThemedText style={styles.version}>{`v${Constants.expoConfig?.version ?? ''}`}</ThemedText>

      {/* The drawer stays open behind the dialog, so cancelling puts you back exactly where you
          were rather than on whichever screen was underneath. */}
      <ConfirmDialog
        visible={confirmingSignOut}
        title="Sign out?"
        message="Your library stays on your account — you will just need to sign in again."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setConfirmingSignOut(false);
          navigation.closeDrawer();
          signOut();
        }}
        onCancel={() => setConfirmingSignOut(false)}
      />
    </View>
  );
}

function Eyebrow({
  children,
  action
}: {
  children: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.eyebrow}>
      <ThemedText style={styles.eyebrowText}>{children.toUpperCase()}</ThemedText>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8} onPress={action.onPress}>
          <Icon name="plus" color={Colors.textSecondary} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Row({
  icon,
  label,
  active,
  onPress,
  trailing = null,
  danger = false
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}>
      <Icon
        name={icon}
        // The chosen row fills its icon, the same rule the bottom bar follows. Nothing else in the
        // sidebar is ever filled.
        filled={active}
        color={danger ? Colors.danger : active ? Colors.brand : Colors.textSecondary}
        size={22}
      />
      <ThemedText style={[styles.rowLabel, active && styles.rowLabelActive, danger && styles.rowLabelDanger]}>
        {label}
      </ThemedText>
      {trailing}
    </Pressable>
  );
}

function Count({ children, hot = false }: { children: string; hot?: boolean }) {
  return (
    <View style={[styles.count, hot && styles.countHot]}>
      <ThemedText style={[styles.countText, hot && styles.countTextHot]}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 6,
    paddingBottom: 18
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: Colors.text
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 46,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14
  },
  searchText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14.5,
    color: Colors.textSecondary
  },
  scroll: {
    paddingBottom: 12
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
    paddingHorizontal: 12
  },
  eyebrowText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 15
  },
  rowActive: {
    backgroundColor: Colors.brandTint
  },
  pressed: {
    opacity: 0.65
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14.5,
    lineHeight: 20,
    color: Colors.textSecondary
  },
  rowLabelActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.text
  },
  rowLabelDanger: {
    color: Colors.danger
  },
  count: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: '#F1F3EF',
    alignItems: 'center'
  },
  countHot: {
    backgroundColor: Colors.accent
  },
  countText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.textSecondary
  },
  countTextHot: {
    color: Colors.text
  },
  // The tree hangs off a single rule, with a tick out to each child — the shape of an outline,
  // which is what it is.
  tree: {
    marginLeft: 24,
    marginTop: 2,
    marginBottom: 6,
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.border
  },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12
  },
  subPressed: {
    backgroundColor: Colors.brandTint
  },
  subTick: {
    position: 'absolute',
    left: -15,
    width: 10,
    height: 1.5,
    backgroundColor: Colors.border
  },
  subLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13.5,
    color: Colors.textSecondary
  },
  rule: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
    marginHorizontal: 6
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14
  },
  personAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.brandTint
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.surface
  },
  personName: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.text
  },
  personStatus: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.textSecondary
  },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border
  },
  meAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent
  },
  meWho: {
    flex: 1,
    minWidth: 0
  },
  meName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.text
  },
  mePlan: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.textSecondary
  },
  version: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.disabledText,
    textAlign: 'center',
    paddingTop: 8
  }
});
