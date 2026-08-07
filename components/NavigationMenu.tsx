import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { Camera, Home } from 'lucide-react-native';
import { memo, type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachUnreadBadgeIcon } from '@/components/CoachUnreadBadgeIcon';
import { NAV_DESTINATIONS } from '@/components/navigation/navDestinations';
import type { NavItemKey } from '@/constants/settings';
import { isNavItemAvailable, useNavigationItems } from '@/hooks/useNavigationItems';
import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

type NavigationMenuProps = {
  onCoachPress: () => void;
  onCameraPress: () => void;
};

type NavSlotButtonProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  onPressIn?: () => void;
};

/**
 * One tab in the bottom bar. Every destination — the fixed Home tab, each customisable slot —
 * renders through this, so active colouring and stroke weights are defined once.
 */
function NavSlotButton({ icon, label, active, onPress, onPressIn }: NavSlotButtonProps) {
  return (
    <Pressable
      className="flex-1 items-center justify-center gap-1"
      onPress={onPress}
      onPressIn={onPressIn}
    >
      <View
        className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
      >
        {icon}
      </View>
      <Text className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

type NavSlotConfig = {
  /**
   * Route prefix that marks this slot active, when it is broader than the destination's own
   * route (workouts lands on a sub-route; the food diary highlights for the whole section).
   * Defaults to `NAV_DESTINATIONS[key].route`.
   */
  activePath?: string;
  /** Second prefix that also counts as active — profile owns the progress screen. */
  alsoActiveFor?: string;
  /** `replace` instead of `navigate` — the food diary swaps itself rather than stacking. */
  replace?: boolean;
  /** Haptic + route prefetch on press-in. Worth it only for the heaviest screen. */
  prefetch?: boolean;
  /**
   * Press navigates even while active. Required wherever `alsoActiveFor` is set, since "active"
   * there does not imply "already on the target" — no-oping would strand the user.
   */
  navigateWhenActive?: boolean;
};

/**
 * Bottom-bar-only routing modifiers. Icon, label and destination route come from the shared
 * `NAV_DESTINATIONS` map, so this table holds nothing the account menu or slot picker would also
 * need — only how the *bar* treats a slot.
 *
 * `coach` is deliberately absent: it has no route, never shows an active state, and renders an
 * unread badge, so it stays an explicit branch in `renderNavSlot` rather than growing this table
 * fields it alone would use.
 */
const NAV_SLOTS: Record<Exclude<NavItemKey, 'coach'>, NavSlotConfig> = {
  workouts: { activePath: '/app/workout' },
  food: { activePath: '/app/nutrition/', replace: true },
  profile: { alsoActiveFor: '/app/progress', prefetch: true, navigateWhenActive: true },
  cycle: {},
  settings: {},
  progress: {},
  notes: {},
  checkin: {},
};

export const NavigationMenu = memo(function NavigationMenu({
  onCoachPress,
  onCameraPress,
}: NavigationMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { rawSlots, isCycleActive } = useNavigationItems();
  const { 1: navSlot1, 2: navSlot2, 3: navSlot3 } = rawSlots;
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 350;
  const insets = useSafeAreaInsets();

  const isPathActive = useCallback(
    (path: string) => {
      if (path === '/') {
        return pathname === '/app';
      }
      return pathname.startsWith(path);
    },
    [pathname]
  );

  const renderNavSlot = useCallback(
    (slotKey: NavItemKey) => {
      // The coach has no route: it never reads active and carries its own unread badge.
      if (slotKey === 'coach') {
        return (
          <NavSlotButton
            key="coach"
            active={false}
            label={t(NAV_DESTINATIONS.coach.labelKey)}
            onPress={onCoachPress}
            icon={
              <CoachUnreadBadgeIcon
                color={theme.colors.text.tertiary}
                size={theme.iconSize.md}
                strokeWidth={theme.borderWidth.medium}
              />
            }
          />
        );
      }

      if (!isNavItemAvailable(slotKey, isCycleActive)) {
        return null;
      }

      const slot = NAV_SLOTS[slotKey];
      const { alsoActiveFor, replace, prefetch } = slot;
      // Typed `string`, not `string | null`: `coach` is the only routeless destination and it
      // returned above, so the narrowed key can only index entries with a real route.
      const { icon: Icon, route: destination } = NAV_DESTINATIONS[slotKey];
      const active =
        isPathActive(slot.activePath ?? destination) ||
        (!!alsoActiveFor && isPathActive(alsoActiveFor));

      const go = () => {
        if (replace) {
          router.replace(destination);
        } else {
          router.navigate(destination);
        }
      };

      return (
        <NavSlotButton
          key={slotKey}
          active={active}
          label={t(NAV_DESTINATIONS[slotKey].labelKey)}
          onPress={() => {
            if (!active || slot.navigateWhenActive) {
              go();
            }
          }}
          onPressIn={
            prefetch && !active
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.prefetch(destination);
                }
              : undefined
          }
          icon={
            <Icon
              size={theme.iconSize.md}
              color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
              strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
            />
          }
        />
      );
    },
    [isPathActive, isCycleActive, onCoachPress, router, t, theme]
  );

  const homeActive = isPathActive('/');
  const cameraFabActive = isPathActive('/app/nutrition/ai-camera');

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border-dark"
      style={{
        backgroundColor: theme.colors.background.secondaryDark,
        paddingBottom: insets.bottom,
      }}
    >
      <View className="relative flex-row items-stretch px-6 py-4">
        {/* Home - always fixed */}
        <NavSlotButton
          active={homeActive}
          label={t('home.navigation.home')}
          onPress={() => {
            if (!homeActive) {
              router.navigate('/app');
            }
          }}
          icon={
            <Home
              size={theme.iconSize.md}
              color={homeActive ? theme.colors.accent.primary : theme.colors.text.tertiary}
              strokeWidth={homeActive ? theme.strokeWidth.medium : theme.borderWidth.medium}
            />
          }
        />

        {/* Slot 1 - customizable */}
        {renderNavSlot(navSlot1)}

        {/* Camera - always fixed */}
        <Pressable
          className="z-10 items-center justify-center gap-1"
          style={isSmallScreen ? { width: '20%' } : { flex: 1 }}
          onPress={onCameraPress}
        >
          <View
            className="items-center justify-center rounded-full shadow-lg shadow-accent-primary/50"
            style={[
              isSmallScreen
                ? { width: screenWidth * 0.2, height: screenWidth * 0.2 }
                : { width: 80, height: 80 },
              {
                backgroundColor: cameraFabActive
                  ? theme.colors.accent.primary
                  : addOpacityToHex(theme.colors.accent.primary, 0.8),
              },
            ]}
          >
            <Camera
              size={isSmallScreen ? theme.iconSize.md : theme.iconSize.xl}
              color={theme.colors.background.secondaryDark}
              strokeWidth={theme.strokeWidth.medium}
            />
          </View>
        </Pressable>

        {/* Slot 2 - customizable */}
        {renderNavSlot(navSlot2)}

        {/* Slot 3 - customizable */}
        {renderNavSlot(navSlot3)}
      </View>
    </View>
  );
});
