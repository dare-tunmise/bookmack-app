import { Drawer } from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppActionsProvider } from '@/components/app-actions';
import { AppBar } from '@/components/app-bar';
import { AppDrawerContent } from '@/components/app-drawer-content';
import { BOTTOM_NAV_BODY, BottomNav } from '@/components/bottom-nav';
import { PendingRequestsProvider } from '@/components/pending-requests';
import { Colors } from '@/constants/theme';

// Main sections, reached from the bottom bar or the side menu (☰ or a swipe from the left edge).
// The two overlap on purpose: the bar carries the handful of things worth a thumb, the menu
// carries everything.
export default function DrawerLayout() {
  const insets = useSafeAreaInsets();

  // Wraps the whole drawer so both consumers share one count: the menu itself, which is rendered
  // through drawerContent, and the requests screen below, which answers requests and says so.
  return (
    <PendingRequestsProvider>
      <AppActionsProvider>
        {/* The bar floats over the navigator so the content runs up to its cut edge and the add
            button overhangs with nothing painted behind it. The spacer below is what keeps that
            honest: it reserves the bar's strip in flow, so no section has content hidden under it. */}
        <View style={styles.root}>
          <Drawer
            drawerContent={(props) => <AppDrawerContent {...props} />}
            screenOptions={{
              header: ({ options, navigation }) => (
                <AppBar
                  title={options.title}
                  left={{ icon: 'menu', label: 'Open menu', onPress: () => navigation.openDrawer() }}
                />
              ),
              drawerType: 'front',
              drawerStyle: styles.drawer,
              overlayColor: Colors.backdrop
            }}>
            <Drawer.Screen name="index" options={{ title: 'Library' }} />
            {/* Next to the Library on purpose: what you own and what you mean to own are the
                same question asked twice. */}
            <Drawer.Screen name="wanted" options={{ title: 'Wanted' }} />
            <Drawer.Screen name="loans" options={{ title: 'Loans' }} />
            <Drawer.Screen name="borrowers" options={{ title: 'Borrowers' }} />
            <Drawer.Screen name="requests" options={{ title: 'Requests' }} />
            <Drawer.Screen name="stats" options={{ title: 'Stats' }} />
            <Drawer.Screen name="activity" options={{ title: 'Activity' }} />
            <Drawer.Screen name="account" options={{ title: 'Account & settings' }} />
            <Drawer.Screen name="plan" options={{ title: 'Plan & limits' }} />
          </Drawer>

          {/* Reserves the bar's own strip in flow, so no screen has content hidden behind it.
              The bar itself floats on top of everything, and only the button crosses this line. */}
          <View style={{ height: BOTTOM_NAV_BODY + insets.bottom }} />
          <BottomNav />
        </View>
      </AppActionsProvider>
    </PendingRequestsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  drawer: {
    width: 330,
    backgroundColor: Colors.surface,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden'
  }
});
