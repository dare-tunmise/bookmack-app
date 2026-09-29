import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppActions } from '@/components/app-actions';
import { Badge } from '@/components/badge';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Shadows, Spacing } from '@/constants/theme';

const PILL_HEIGHT = 64;
// The gap beneath the pill, between it and the safe area. What makes it read as floating rather
// than as a bar welded to the bottom of the screen.
const GAP = Spacing.three;
const SIDE = Spacing.three;

const BUTTON = 56;
// Drawing room above the pill for the button's overhang. This is inside the container's own bounds
// on purpose — Android does not deliver touches to a child outside its parent, so a button placed
// above the bounds draws perfectly and then ignores taps on its top half.
const OVERHANG = BUTTON / 2 + Spacing.two;

// What the drawer layout reserves in flow, so no screen ends with content under the bar. The
// safe-area inset is added there, not here.
export const BOTTOM_NAV_BODY = PILL_HEIGHT + GAP;

// Inactive icons are white on ink, which reads optically heavier than the same stroke on a light
// background — so they are held back rather than pure white.
const INACTIVE = 'rgba(255, 255, 255, 0.72)';

type NavItemProps = {
  label: string;
  icon: IconName;
  active?: boolean;
  badge?: string | null;
  onPress: () => void;
};

// Inactive: the icon alone. Active: a capsule with the icon and its name side by side.
//
// Only the current section is named. Five labels across a pill is the thing that made the old bar
// feel like a toolbar — and the one place you never need a label is the section you are looking at,
// except that naming it is what tells you where you are. So: name only that one.
function NavItem({ label, icon, active = false, badge = null, onPress }: NavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        active && styles.itemActive,
        pressed && styles.pressed
      ]}>
      <View>
        <Icon name={icon} color={active ? Colors.text : INACTIVE} size={24} filled={active} />
        {badge ? (
          <View style={styles.badge}>
            <Badge label={badge} tone="danger" />
          </View>
        ) : null}
      </View>
      {active ? (
        <ThemedText numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

// A floating pill with the "+" raised out of its top edge.
//
// It replaced a full-width bar with a circular bite cut from its top: that needed an SVG path whose
// shoulder circles were tangent to the notch circle, because a rounded rectangle cannot make a cut
// that flows. None of that is needed once the bar floats — the button simply overlaps a pill that
// stops short of the screen edges, and the geometry is a border radius.
//
// Three of the five slots are destinations; the middle "+" and "Read next" open sheets, which is
// why this is a plain component rather than a Tabs navigator — a navigator wants every slot to be
// a route.
export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { openAdd, openPickRead } = useAppActions();
  const { count: pending, more } = usePendingRequests();

  const go = (href: Href) => router.navigate(href);

  return (
    // box-none: the container is never the touch target, so taps beside the pill reach the content
    // behind it, while the pill and the button still work.
    <View
      style={[styles.container, { height: OVERHANG + BOTTOM_NAV_BODY + insets.bottom }]}
      pointerEvents="box-none">
      <View style={[styles.pill, { bottom: insets.bottom + GAP }]}>
        <NavItem label="Library" icon="library" active={pathname === '/'} onPress={() => go('/')} />
        <NavItem
          label="Requests"
          icon="requests"
          active={pathname === '/requests'}
          badge={pending > 0 ? (more ? `${pending}+` : String(pending)) : null}
          onPress={() => go('/requests')}
        />
        {/* Holds the button's width so nothing slides under it. */}
        <View style={styles.centreGap} />
        <NavItem label="Read next" icon="ask" onPress={openPickRead} />
        <NavItem label="Stats" icon="stats" active={pathname === '/stats'} onPress={() => go('/stats')} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a book"
        hitSlop={10}
        onPress={openAdd}
        style={({ pressed }) => [
          styles.add,
          { bottom: insets.bottom + GAP + PILL_HEIGHT - BUTTON / 2 },
          pressed && styles.addPressed
        ]}>
        <Icon name="plus" color={Colors.text} size={26} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pinned to the bottom and transparent: the only thing painted is the pill itself.
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent'
  },
  pill: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
    ...Shadows.floating
  },
  item: {
    height: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill
  },
  // The current section, named, in the brand's own green.
  itemActive: {
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.accent
  },
  pressed: {
    opacity: 0.7
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text
  },
  // Sits off the icon's top-right corner.
  badge: {
    position: 'absolute',
    top: -7,
    left: 14
  },
  centreGap: {
    width: BUTTON - Spacing.two
  },
  add: {
    position: 'absolute',
    alignSelf: 'center',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderWidth: 4,
    // The ring is the background showing through, which is what separates the button from the pill
    // without painting a hole in it.
    borderColor: Colors.background,
    ...Shadows.floating
  },
  addPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }]
  }
});
