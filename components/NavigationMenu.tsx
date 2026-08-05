import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { Camera, Home } from 'lucide-react-native';
import { memo, type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachUnreadBadgeIcon } from '@/components/CoachUnreadBadgeIcon';
import { NAV_ITEM_ICON } from '@/components/navigation/navItemIcons';
import type { NavItemKey } from '@/constants/settings';
import { useNavigationItems } from '@/hooks/useNavigationItems';
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
  labelKey: string;
  /** Route prefix that marks this slot active. Also the navigation target unless `target` is set. */
  activePath: string;
  /** Second prefix that also counts as active — profile owns the progress screen. */
  alsoActiveFor?: string;
  /** Navigation target when it differs from `activePath` (workouts lands on a sub-route). */
  target?: string;
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
 * Routing and labelling for each nav slot; icons come from the shared `NAV_ITEM_ICON` map so a
 * destination picks its icon once for both the bar and the slot picker.
 *
 * `coach` is deliberately absent: it has no route, never shows an active state, and renders an
 * unread badge, so it stays an explicit branch in `renderNavSlot` rather than growing this table
 * three fields it alone would use.
 */
const NAV_SLOTS: Record<Exclude<NavItemKey, 'coach'>, NavSlotConfig> = {
  workouts: {
    labelKey: 'home.navigation.workouts',
    activePath: '/app/workout',
    target: '/app/workout/workouts',
  },
  food: {
    labelKey: 'home.navigation.food',
    activePath: '/app/nutrition/',
    target: '/app/nutrition/food',
    replace: true,
  },
  profile: {
    labelKey: 'home.navigation.profile',
    activePath: '/app/profile',
    alsoActiveFor: '/app/progress',
    prefetch: true,
    navigateWhenActive: true,
  },
  cycle: { labelKey: 'userMenu.cycle', activePath: '/app/cycle' },
  settings: { labelKey: 'userMenu.settings', activePath: '/app/settings' },
  progress: { labelKey: 'userMenu.progress', activePath: '/app/progress' },
  notes: { labelKey: 'userMenu.notes', activePath: '/app/notes' },
  checkin: {
    labelKey: 'home.navigation.checkin',
    activePath: '/app/nutrition/checkin-list',
  },
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
            label={t('home.navigation.coach')}
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

      if (slotKey === 'cycle' && !isCycleActive) {
        return null;
      }

      const slot = NAV_SLOTS[slotKey];
      if (!slot) {
        return null;
      }

      const { activePath, alsoActiveFor, target, replace, prefetch } = slot;
      const Icon = NAV_ITEM_ICON[slotKey];
      const active = isPathActive(activePath) || (!!alsoActiveFor && isPathActive(alsoActiveFor));
      const destination = target ?? activePath;

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
          label={t(slot.labelKey)}
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
