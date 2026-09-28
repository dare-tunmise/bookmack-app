import Constants from 'expo-constants';
import { Image } from 'expo-image';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session';
import { Badge, PlanBadge } from '@/components/badge';
import { BrandMark } from '@/components/brand-mark';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { dicebearUrl } from '@/lib/dicebear';

// The app's sections, in the order from the navigation design.
const ITEMS: {
  route: 'index' | 'wanted' | 'loans' | 'borrowers' | 'requests' | 'stats' | 'activity' | 'account' | 'plan';
  label: string;
  icon: IconName;
}[] = [
  { route: 'index', label: 'Library', icon: 'library' },
  // Directly under the Library: what you own and what you mean to own are the same question
  // asked twice, and the icons are the same shelf with and without the gap.
  { route: 'wanted', label: 'Wanted', icon: 'wanted' },
  { route: 'loans', label: 'Loans', icon: 'loans' },
  { route: 'borrowers', label: 'Borrowers', icon: 'users' },
  { route: 'requests', label: 'Requests', icon: 'requests' },
  { route: 'stats', label: 'Stats', icon: 'stats' },
  { route: 'activity', label: 'Activity', icon: 'clock' },
  { route: 'account', label: 'Account & settings', icon: 'settings' },
  { route: 'plan', label: 'Plan & limits', icon: 'card' }
];

// Side drawer from the navigation design: account header, sections, sign out and version.
export function AppDrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index]?.name;
  const { count: pending, more: morePending, refresh: refreshPending } = usePendingRequests();

  // The drawer stays mounted, so without this the count would be whatever it was at sign-in.
  // Moving around the app is the cheapest honest trigger; answering a request updates it directly.
  useEffect(() => {
    refreshPending();
  }, [state.index, refreshPending]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {user ? (
        <View style={[styles.head, { paddingTop: 28 + insets.top }]}>
          <Image
            source={dicebearUrl('notionists', user.name, '9fe870')}
            style={styles.avatar}
            accessibilityLabel={user.name}
          />
          <View>
            <ThemedText style={styles.name}>{user.name}</ThemedText>
            <ThemedText style={styles.email} numberOfLines={1}>
              {user.email}
            </ThemedText>
            <PlanBadge plan={user.plan} style={styles.planBadge} />
          </View>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.items} contentContainerStyle={styles.itemsContent}>
        {ITEMS.map((item) => {
          const active = currentRoute === item.route;
          return (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [styles.item, (active || pressed) && styles.itemActive]}>
              <Icon name={item.icon} color={Colors.text} size={22} />
              <ThemedText style={styles.itemLabel}>{item.label}</ThemedText>
              {item.route === 'requests' && pending > 0 ? (
                <Badge label={morePending ? `${pending}+` : String(pending)} tone="danger" />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.foot}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            navigation.closeDrawer();
            signOut();
          }}>
          <ThemedText style={styles.signOut}>Sign out</ThemedText>
        </Pressable>
        <View style={styles.brand}>
          <BrandMark size={20} />
          <ThemedText style={styles.version}>{`BookMack v${Constants.expoConfig?.version ?? ''}`}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface
  },
  head: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.accent
  },
  name: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text
  },
  email: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary
  },
  planBadge: {
    marginTop: 4
  },
  items: {
    flex: 1
  },
  itemsContent: {
    paddingVertical: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 12,
    borderTopRightRadius: Radius.pill,
    borderBottomRightRadius: Radius.pill
  },
  itemActive: {
    backgroundColor: Colors.brandTint
  },
  itemLabel: {
    // Takes the slack so a count badge sits against the right edge of the row.
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text
  },
  foot: {
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  signOut: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  version: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.disabledText
  }
});
