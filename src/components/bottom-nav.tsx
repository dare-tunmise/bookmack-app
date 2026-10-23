import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppActions } from '@/components/app-actions';
import { Badge } from '@/components/badge';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

// A floating bar: inset from all four edges, one radius the whole way round, and a shadow instead
// of a hairline — so it reads as a surface resting over the page rather than a strip welded to the
// screen edge. It clears the gesture area rather than painting behind it.
const BAR_HEIGHT = 72;
const BAR_PADDING_TOP = 12;

// How far the bar sits in from the screen's sides, and above the safe-area inset.
const SIDE_INSET = 12;
const BAR_LIFT = 10;

// The add button breaches the bar's top edge by this much.
const BUTTON = 60;
const BUTTON_RING = 64;
const OVERHANG = 22;

// The slot the button sits in. Nothing lays out under it.
const CENTRE_GAP = 84;

// What the drawer layout reserves in flow so no screen ends with content under the bar. The bar
// floats, so this is its height plus the gap beneath it; the safe-area inset is added by the
// layout, not here. These two move together — shrink one without the other and content hides.
export const BOTTOM_NAV_BODY = BAR_HEIGHT + BAR_LIFT;

// The side menu reads these so it ends on the same line as the bar, with the same corner. The two
// overlap once the menu is open, and sharing a bottom edge and a radius is what makes that overlap
// read as one surface rather than two stacked sheets of the same colour.
export const BOTTOM_NAV_GAP = BAR_LIFT;
export const BOTTOM_NAV_RADIUS = Radius.sheet;

type NavItemProps = {
  label: string;
  icon: IconName;
  active?: boolean;
  badge?: string | null;
  onPress: () => void;
};

// Every item is named, not only the current one. Four labels and a centred action is what the design
// asks for, and at 11px they sit under the icons without crowding them.
function NavItem({ label, icon, active = false, badge = null, onPress }: NavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View>
        <Icon name={icon} color={active ? Colors.brand : Colors.textSecondary} size={24} filled={active} />
        {badge ? (
          <View style={styles.badge}>
            <Badge label={badge} tone="danger" />
          </View>
        ) : null}
      </View>
      <ThemedText numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// Three of the five slots are destinations; the centre "+" and "Read next" open sheets, which is why
// this is a plain component rather than a Tabs navigator — a navigator wants every slot to be a route.
//
// The container is deliberately taller than the bar: the button overhangs the top edge, and Android
// does not deliver touches to a child drawn outside its parent's bounds, so a button placed above the
// container would draw perfectly and then ignore taps on its upper half.
export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { openAdd, openPickRead } = useAppActions();
  const { count: pending, more } = usePendingRequests();

  const go = (href: Href) => router.navigate(href);

  return (
    // box-none: the strip above the bar is not a touch target, so taps there reach the content behind
    // it while the bar and the button still work.
    <View
      style={[styles.container, { height: OVERHANG + BOTTOM_NAV_BODY + insets.bottom }]}
      pointerEvents="box-none">
      <View style={[styles.bar, { height: BAR_HEIGHT, bottom: insets.bottom + BAR_LIFT }]}>
        <NavItem label="Library" icon="library" active={pathname === '/'} onPress={() => go('/')} />
        <NavItem
          label="Requests"
          icon="requests"
          active={pathname === '/requests'}
          badge={pending > 0 ? (more ? `${pending}+` : String(pending)) : null}
          onPress={() => go('/requests')}
        />
        <View style={styles.centreGap} />
        <NavItem label="Read next" icon="ask" onPress={openPickRead} />
        <NavItem label="Stats" icon="stats" active={pathname === '/stats'} onPress={() => go('/stats')} />
      </View>

      {/* The ring is the page colour showing through, which is what separates the button from the bar
          without painting a hole in it. */}
      <View
        style={[styles.ring, { bottom: insets.bottom + BAR_LIFT + BAR_HEIGHT - BUTTON_RING / 2 }]}
        pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a book"
          hitSlop={8}
          onPress={openAdd}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Icon name="plus" color={Colors.accent} size={28} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent'
  },
  bar: {
    position: 'absolute',
    left: SIDE_INSET,
    right: SIDE_INSET,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: BAR_PADDING_TOP,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sheet,
    // The shadow does the separating now that there is no hairline and no shared edge with the
    // screen. Kept soft: this lifts the bar off the page, it does not announce itself.
    shadowColor: Colors.text,
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3
  },
  pressed: {
    opacity: 0.7
  },
  label: {
    // Bold throughout rather than only when selected. At 11px a semibold reads as grey mush next
    // to the glyph above it, and the selected item is already told apart by its colour and by
    // being filled rather than outlined — it does not also need to be the only bold thing.
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textSecondary
  },
  labelActive: {
    color: Colors.brand
  },
  // Sits off the icon's top-right corner.
  badge: {
    position: 'absolute',
    top: -7,
    left: 14
  },
  centreGap: {
    width: CENTRE_GAP
  },
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    width: BUTTON_RING,
    height: BUTTON_RING,
    borderRadius: BUTTON_RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background
  },
  add: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    shadowColor: Colors.text,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10
  },
  addPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }]
  }
});
