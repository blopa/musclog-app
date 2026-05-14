import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import {
  BarChart3,
  Calendar,
  Camera,
  ClipboardCheck,
  Dumbbell,
  Home,
  MessageSquare,
  Settings,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NavItemKey } from '@/constants/settings';
import { useNavigationItems } from '@/hooks/useNavigationItems';
import { useTheme } from '@/hooks/useTheme';
import { useUnreadChatMessages } from '@/hooks/useUnreadChatMessages';
import { addOpacityToHex } from '@/theme';

type NavigationMenuProps = {
  onCoachPress: () => void;
  onCameraPress: () => void;
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
  const unreadChatMessages = useUnreadChatMessages();
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

  const isFoodActive = useCallback(() => {
    return pathname.startsWith('/app/nutrition/');
  }, [pathname]);

  const renderNavSlot = useCallback(
    (slotKey: NavItemKey) => {
      switch (slotKey) {
        case 'workouts': {
          const active = isPathActive('/app/workout');
          return (
            <Pressable
              key="workouts"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.navigate('/app/workout/workouts');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <Dumbbell
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('home.navigation.workouts')}
              </Text>
            </Pressable>
          );
        }

        case 'food': {
          const active = isFoodActive();
          return (
            <Pressable
              key="food"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.replace('/app/nutrition/food');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <UtensilsCrossed
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('home.navigation.food')}
              </Text>
            </Pressable>
          );
        }

        case 'profile': {
          const active = isPathActive('/app/profile') || isPathActive('/app/progress');
          return (
            <Pressable
              key="profile"
              className="flex-1 items-center justify-center gap-1"
              onPressIn={() => {
                if (!active) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.prefetch('/app/profile');
                }
              }}
              onPress={() => router.navigate('/app/profile')}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <User
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('home.navigation.profile')}
              </Text>
            </Pressable>
          );
        }

        case 'coach': {
          return (
            <Pressable
              key="coach"
              className="flex-1 items-center justify-center gap-1"
              onPress={onCoachPress}
            >
              <View className="h-10 w-16 items-center justify-center rounded-lg">
                <View className="relative">
                  <MessageSquare
                    size={theme.iconSize.md}
                    color={theme.colors.text.tertiary}
                    strokeWidth={theme.borderWidth.medium}
                  />
                  {unreadChatMessages > 0 ? (
                    <View
                      className="absolute -right-1.5 -top-1.5 h-4 w-4 items-center justify-center rounded-full bg-red-500"
                      style={{ minWidth: 14, minHeight: 14 }}
                    >
                      <Text className="text-[10px] font-bold leading-none text-white">
                        {unreadChatMessages > 9 ? '9+' : unreadChatMessages}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text className="text-xs font-medium text-text-tertiary">
                {t('home.navigation.coach')}
              </Text>
            </Pressable>
          );
        }

        case 'cycle': {
          if (!isCycleActive) {
            return null;
          }
          const active = isPathActive('/app/cycle');
          return (
            <Pressable
              key="cycle"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.navigate('/app/cycle');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <Calendar
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('userMenu.cycle')}
              </Text>
            </Pressable>
          );
        }

        case 'settings': {
          const active = isPathActive('/app/settings');
          return (
            <Pressable
              key="settings"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.navigate('/app/settings');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <Settings
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('userMenu.settings')}
              </Text>
            </Pressable>
          );
        }

        case 'progress': {
          const active = isPathActive('/app/progress');
          return (
            <Pressable
              key="progress"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.navigate('/app/progress');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <BarChart3
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('userMenu.progress')}
              </Text>
            </Pressable>
          );
        }

        case 'checkin': {
          const active = isPathActive('/app/nutrition/checkin-list');
          return (
            <Pressable
              key="checkin"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.navigate('/app/nutrition/checkin-list');
                }
              }}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${active ? 'bg-bg-navActive' : ''}`}
              >
                <ClipboardCheck
                  size={theme.iconSize.md}
                  color={active ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={active ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${active ? 'text-text-accent' : 'text-text-tertiary'}`}
              >
                {t('home.navigation.checkin')}
              </Text>
            </Pressable>
          );
        }

        default:
          return null;
      }
    },
    [isPathActive, isFoodActive, isCycleActive, unreadChatMessages, onCoachPress, router, t, theme]
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
        <Pressable
          className="flex-1 items-center justify-center gap-1"
          onPress={() => {
            if (!homeActive) {
              router.navigate('/app');
            }
          }}
        >
          <View
            className={`h-10 w-16 items-center justify-center rounded-lg ${homeActive ? 'bg-bg-navActive' : ''}`}
          >
            <Home
              size={theme.iconSize.md}
              color={homeActive ? theme.colors.accent.primary : theme.colors.text.tertiary}
              strokeWidth={homeActive ? theme.strokeWidth.medium : theme.borderWidth.medium}
            />
          </View>
          <Text
            className={`text-xs font-medium ${homeActive ? 'text-text-accent' : 'text-text-tertiary'}`}
          >
            {t('home.navigation.home')}
          </Text>
        </Pressable>

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
