import * as Haptics from 'expo-haptics';
import { router, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppActions } from '@/components/app-actions';
import { Icon, type IconName } from '@/components/icon';
import { usePendingRequests } from '@/components/pending-requests';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';

// A docked bar: full width, on the bottom edge, rounded only on its top corners. It paints through
// the gesture area rather than clearing it, which is why its height carries the bottom safe-area
// inset and its content is padded off it.
//
// It was floated once — inset on all four sides, with a radius all round and a shadow — and that
// was wrong twice over: it read as a card rather than a bar, and it gave the side menu an edge to
// collide with. Do not float it again. The top corners round because the bar meets a wall on the
// other three sides; the drawer passes over the whole thing, so nothing collides there either.
//
// Three rules do the work, and the calm comes from never breaking them:
//   one icon family, outline at rest and filled when chosen;
//   one moving shape — a pill that springs across to whatever was tapped;
//   two inks and one accent, with no borders between tabs and no per-tab colours.
const BAR_HEIGHT = 90;
const BAR_PADDING_TOP = 8;
const BAR_PADDING_BOTTOM = 18;
const TAB_HEIGHT = 60;

const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;
const PILL_TOP = 6;

const ADD_SLOT = 72;
const ADD_SIZE = 54;
const ADD_RADIUS = 18;

// One spring for everything that moves, so the bar has a single motion rather than four.
const SPRING = { damping: 14, stiffness: 180 } as const;
const FADE_MS = 150;
const DIAL_STAGGER_MS = 40;

const IDLE = '#7A8774';
const PILL = '#E2F2D5';

// What the drawer layout reserves in flow so no screen ends with content under the bar. The bar
// is docked, so this is its own height and nothing else; the safe-area inset is added by the
// layout. These two move together — shrink one without the other and content hides behind it.
export const BOTTOM_NAV_BODY = BAR_HEIGHT;

type DialAction = { title: string; href: Href; icon: IconName };

// The dial replaces the Add a book sheet, so scanning is two taps from any tab instead of three.
// "Scan a shelf" is here as well: the design sketched three actions, but losing a way to add books
// to make a drawing tidier is not a trade worth taking.
const ADD_ACTIONS: DialAction[] = [
  { title: 'Scan a book', href: '/scan', icon: 'scan' },
  { title: 'Scan a shelf', href: '/scan-shelf', icon: 'scanShelf' },
  { title: 'Search by title', href: '/search', icon: 'search' },
  { title: 'Type it in', href: '/book-form', icon: 'edit' }
];

type TabProps = {
  label: string;
  icon: IconName;
  active: boolean;
  badge?: string | null;
  onPress: () => void;
};

function Tab({ label, icon, active, badge = null, onPress }: TabProps) {
  const reduced = useReducedMotion();
  const open = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);

  // Written during render rather than from an effect: a shared value is not React state, so this
  // costs nothing, and the pill is already travelling by the time the commit lands.
  open.value = reduced ? (active ? 1 : 0) : withSpring(active ? 1 : 0, SPRING);

  const pill = useAnimatedStyle(() => ({
    opacity: open.value,
    // Scale rather than width, so it runs on the UI thread and cannot stutter behind a render.
    transform: [{ scaleX: 0.3 + open.value * 0.7 }]
  }));

  const body = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.06 }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPressIn={() => {
        press.value = reduced ? 0 : withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 140 });
      }}
      onPress={() => {
        if (!active) Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={styles.tab}>
      <Animated.View style={[styles.tabBody, body]}>
        <Animated.View style={[styles.pill, pill]} />
        <View style={styles.glyph}>
          {/* Both weights stay mounted and cross-fade. Swapping one for the other pops, and the
              fade is most of what reads as "fluid". */}
          <IconLayer name={icon} color={IDLE} shown={!active} reduced={reduced} />
          <IconLayer name={icon} color={Colors.text} shown={active} reduced={reduced} filled />
          {badge ? (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{badge}</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
          {label}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

function IconLayer({
  name,
  color,
  shown,
  reduced,
  filled = false
}: {
  name: IconName;
  color: string;
  shown: boolean;
  reduced: boolean;
  filled?: boolean;
}) {
  const value = useSharedValue(shown ? 1 : 0);
  value.value = reduced ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: FADE_MS });

  const style = useAnimatedStyle(() => ({
    opacity: value.value,
    transform: [{ scale: 0.82 + value.value * 0.18 }]
  }));

  return (
    <Animated.View style={[styles.iconLayer, style]} pointerEvents="none">
      <Icon name={name} color={color} size={24} filled={filled} />
    </Animated.View>
  );
}

export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { openPickRead } = useAppActions();
  const { count: pending, more } = usePendingRequests();
  const [dialOpen, setDialOpen] = useState(false);

  const dial = useSharedValue(0);
  dial.value = reduced ? (dialOpen ? 1 : 0) : withSpring(dialOpen ? 1 : 0, SPRING);

  const addStyle = useAnimatedStyle(() => ({
    // Rounded square opening into a circle, which is the only shape change in the bar.
    borderRadius: ADD_RADIUS + dial.value * (ADD_SIZE / 2 - ADD_RADIUS),
    transform: [{ rotate: `${dial.value * 45}deg` }]
  }));

  const scrimStyle = useAnimatedStyle(() => ({ opacity: dial.value }));

  const go = (href: Href) => {
    setDialOpen(false);
    router.navigate(href);
  };

  const choose = (href: Href) => {
    setDialOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Covers the whole screen, so the first tap anywhere closes the dial rather than doing
          something else by accident. */}
      {dialOpen ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={StyleSheet.absoluteFill}
            onPress={() => setDialOpen(false)}
          />
        </Animated.View>
      ) : null}

      <View style={[styles.container, { height: BAR_HEIGHT + insets.bottom }]} pointerEvents="box-none">
        {dialOpen ? (
          <View style={[styles.dial, { bottom: BAR_HEIGHT + insets.bottom + 12 }]} pointerEvents="box-none">
            {ADD_ACTIONS.map((action, index) => (
              <DialButton
                key={action.title}
                action={action}
                // Nearest the button opens first, so the stack unrolls upward from the thumb.
                delay={(ADD_ACTIONS.length - 1 - index) * DIAL_STAGGER_MS}
                reduced={reduced}
                onPress={() => choose(action.href)}
              />
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.bar,
            { height: BAR_HEIGHT + insets.bottom, paddingBottom: BAR_PADDING_BOTTOM + insets.bottom }
          ]}>
          <Tab label="Library" icon="library" active={pathname === '/'} onPress={() => go('/')} />
          <Tab
            label="Requests"
            icon="requests"
            active={pathname === '/requests'}
            badge={pending > 0 ? (more ? `${pending}+` : String(pending)) : null}
            onPress={() => go('/requests')}
          />

          <View style={styles.addSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dialOpen ? 'Close add menu' : 'Add a book'}
              accessibilityState={{ expanded: dialOpen }}
              hitSlop={8}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setDialOpen((open) => !open);
              }}>
              <Animated.View style={[styles.add, addStyle]}>
                <Icon name="plus" color={Colors.text} size={26} strokeWidth={2.2} />
              </Animated.View>
            </Pressable>
          </View>

          <Tab
            label="Read next"
            icon="ask"
            active={false}
            onPress={() => {
              setDialOpen(false);
              openPickRead();
            }}
          />
          <Tab label="Stats" icon="stats" active={pathname === '/stats'} onPress={() => go('/stats')} />
        </View>
      </View>
    </>
  );
}

function DialButton({
  action,
  delay,
  reduced,
  onPress
}: {
  action: DialAction;
  delay: number;
  reduced: boolean;
  onPress: () => void;
}) {
  const value = useSharedValue(0);
  value.value = reduced ? 1 : withDelay(delay, withSpring(1, SPRING));

  const style = useAnimatedStyle(() => ({
    opacity: value.value,
    transform: [{ translateY: (1 - value.value) * 16 }, { scale: 0.92 + value.value * 0.08 }]
  }));

  return (
    <Animated.View style={style}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.dialAction}>
        <Icon name={action.icon} color={Colors.brand} size={22} />
        <ThemedText style={styles.dialLabel}>{action.title}</ThemedText>
      </Pressable>
    </Animated.View>
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
  scrim: {
    backgroundColor: 'rgba(14,31,7,0.38)',
    zIndex: 2
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: BAR_PADDING_TOP,
    paddingHorizontal: 6,
    backgroundColor: Colors.surface,
    // Rounded on the top corners only. 24 here, 16 on the pill and 18 on the add button are the
    // same shape at three sizes, which is what makes the bar read as one object rather than as
    // parts that happen to sit together.
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    shadowColor: Colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12
  },
  tab: {
    flex: 1,
    height: TAB_HEIGHT
  },
  tabBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  pill: {
    position: 'absolute',
    top: PILL_TOP,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: PILL
  },
  glyph: {
    width: 24,
    height: 24,
    marginTop: 4
  },
  iconLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 15,
    color: IDLE
  },
  labelActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.text
  },
  badge: {
    position: 'absolute',
    top: -8,
    left: 15,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    // The ring is the bar showing through, which keeps the badge legible where it overlaps the
    // glyph.
    borderWidth: 2,
    borderColor: Colors.surface
  },
  badgeText: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    lineHeight: 13
  },
  addSlot: {
    width: ADD_SLOT,
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center'
  },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    shadowColor: '#3C7814',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10
  },
  dial: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
    zIndex: 3
  },
  dialAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    shadowColor: Colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  dialLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.text
  }
});
