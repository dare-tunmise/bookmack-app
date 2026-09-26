import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAppActions } from '@/components/app-actions';
import { Badge } from '@/components/badge';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

// The bar itself, below the bite. Exported because the bar floats over the screen: the layout
// reserves this much room in flow so the content above ends at the bar's top edge, while the
// button is free to overhang it.
export const BOTTOM_NAV_BODY = 70;
// Drawing room above the bar for the overhanging button. This is inside the overlay's own bounds
// on purpose — Android does not deliver touches to a child outside its parent, so a button placed
// above the bounds would render correctly and then ignore taps on its top half.
const OVERHANG = 46;
const TOP_RADIUS = 26;

const BUTTON = 64;
const BUTTON_R = BUTTON / 2;
// Even gap between the button's edge and the cut edge of the bar. This is the measurement the eye
// actually checks, so it is a constant rather than something that falls out of other numbers.
const GAP = 7;
const NOTCH_R = BUTTON_R + GAP;
// How far the notch's centre sits above the bar's top edge. Lowering this towards zero deepens
// the bite and widens its mouth; going past zero would undercut, curling the bar over the button.
const NOTCH_CY = -4;
// Radius of the shoulders either side, where the flat top eases into the bite.
const COVE_R = 14;

// Where the cove circle sits, and where it meets the notch circle.
//
// The cove is tangent to the top edge (so its centre is COVE_R below it) and externally tangent to
// the notch circle (so the distance between their centres is the sum of the radii). Solving those
// two conditions is what makes the shoulder flow into the bite instead of kinking at the join.
const centreGap = NOTCH_R + COVE_R;
const coveDx = Math.sqrt(centreGap * centreGap - (COVE_R - NOTCH_CY) ** 2);
const unitX = coveDx / centreGap;
const unitY = (NOTCH_CY - COVE_R) / centreGap;
// Tangent point, relative to the centre line and the bar's top edge.
const touchX = -coveDx + COVE_R * unitX;
const touchY = COVE_R + COVE_R * unitY;

// The top edge, left to right: corner, flat, shoulder down, bite, shoulder up, flat, corner.
const topEdge = (width: number, top: number) => {
  const cx = width / 2;
  return [
    `M 0,${top + TOP_RADIUS}`,
    `A ${TOP_RADIUS},${TOP_RADIUS} 0 0 1 ${TOP_RADIUS},${top}`,
    `L ${cx - coveDx},${top}`,
    `A ${COVE_R},${COVE_R} 0 0 1 ${cx + touchX},${top + touchY}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${cx - touchX},${top + touchY}`,
    `A ${COVE_R},${COVE_R} 0 0 1 ${cx + coveDx},${top}`,
    `L ${width - TOP_RADIUS},${top}`,
    `A ${TOP_RADIUS},${TOP_RADIUS} 0 0 1 ${width},${top + TOP_RADIUS}`
  ].join(' ');
};

// Same edge, closed down the sides and along the bottom so it can be filled.
const barShape = (width: number, height: number, top: number) =>
  `${topEdge(width, top)} L ${width},${height} L 0,${height} Z`;

type NavButtonProps = {
  label: string;
  icon: IconName;
  active?: boolean;
  badge?: string | null;
  onPress: () => void;
};

function NavButton({ label, icon, active = false, badge = null, onPress }: NavButtonProps) {
  const color = active ? Colors.brand : Colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View>
        {/* Solid while you are on it, outlined otherwise: weight reads as "here" faster than
            colour alone, and it still works for anyone who cannot tell the two greens apart. */}
        <Icon name={icon} color={color} size={24} filled={active} />
        {badge ? (
          <View style={styles.badge}>
            <Badge label={badge} tone="danger" />
          </View>
        ) : null}
      </View>
      <ThemedText numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// One bar with a circular bite taken out of its top edge, and the "+" sitting in the bite.
//
// Floats over the screen rather than occupying a strip of it, so the content runs up to the cut
// edge and the button overhangs with nothing painted behind it. Nothing is hidden by this: the
// layout reserves BOTTOM_NAV_BODY in flow, and only the button crosses that line.
//
// Three of the five slots are destinations; the middle "+" and "Read next" open sheets, which is
// why this is a plain component rather than a Tabs navigator — a navigator wants every slot to be
// a route.
export function BottomNav() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { openAdd, openPickRead } = useAppActions();
  const { count: pending, more } = usePendingRequests();

  const go = (href: Href) => router.navigate(href);

  // The bar runs to the bottom of the screen, under the gesture bar, rather than stopping short
  // of it: a strip of background below the bar would read as a gap, not as breathing room.
  const height = OVERHANG + BOTTOM_NAV_BODY + insets.bottom;
  const centreX = width / 2;

  return (
    // box-none: the overlay itself is never the touch target, so taps landing in the clear area
    // above the bar reach the content behind it, while the button and the items still work.
    <View style={[styles.bar, { height }]} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={barShape(width, height, OVERHANG)} fill={Colors.surface} />
        {/* Drawn separately from the fill so only the cut edge is outlined; stroking the filled
            shape would draw a line down the sides and along the bottom too. */}
        <Path d={topEdge(width, OVERHANG)} fill="none" stroke={Colors.border} strokeWidth={1} />
      </Svg>

      <View style={[styles.row, { top: OVERHANG, height: BOTTOM_NAV_BODY }]} pointerEvents="box-none">
        <NavButton label="Library" icon="library" active={pathname === '/'} onPress={() => go('/')} />
        <NavButton
          label="Requests"
          icon="requests"
          active={pathname === '/requests'}
          badge={pending > 0 ? (more ? `${pending}+` : String(pending)) : null}
          onPress={() => go('/requests')}
        />
        {/* Holds the width of the bite so no label slides under the button. */}
        <View style={{ width: coveDx * 2 }} />
        <NavButton label="Read next" icon="ask" onPress={openPickRead} />
        <NavButton label="Stats" icon="stats" active={pathname === '/stats'} onPress={() => go('/stats')} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a book"
        hitSlop={10}
        onPress={openAdd}
        style={({ pressed }) => [
          styles.add,
          { left: centreX - BUTTON_R, top: OVERHANG + NOTCH_CY - BUTTON_R },
          pressed && styles.addPressed
        ]}>
        <Icon name="plus" color={Colors.accent} size={28} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pinned to the bottom and transparent: the only thing painted is the bar shape itself, so the
  // content above shows right up to the cut edge and behind the button's overhang.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent'
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center'
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  pressed: {
    opacity: 0.6
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2
  },
  // Sits off the icon's top-right corner; moved out with the icon as it grew.
  badge: {
    position: 'absolute',
    top: -7,
    left: 14
  },
  add: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON_R,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.buttonPrimary,
    shadowColor: Colors.text,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  addPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }]
  }
});
