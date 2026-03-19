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
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NavItemKey } from '../constants/settings';
import { useNavigationItems } from '../hooks/useNavigationItems';
import { useTheme } from '../hooks/useTheme';
import { useUnreadChatMessages } from '../hooks/useUnreadChatMessages';

type NavigationMenuProps = {
  onCoachPress: () => void;
  onCameraPress: () => void;
};

export const NavigationMenu = memo(function NavigationMenu({
  onCoachPress,
  onCameraPress,
}: NavigationMenuProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { rawSlots, isAiFeaturesEnabled, isCycleActive } = useNavigationItems();
  const { count: unreadChatMessages } = useUnreadChatMessages();

  const isPathActive = useCallback((path: string) => pathname === path, [pathname]);
  const isFoodActive = useCallback(() => pathname.startsWith('/nutrition/'), [pathname]);

  const renderNavSlot = useCallback(
    (item: NavItemKey) => {
      switch (item) {
        case 'workouts': {
          const active = isPathActive('/workout/workouts');
          return (
            <Pressable
              key="workouts"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.push('/workout/workouts');
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
                  router.push('/nutrition/food');
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
          const active = isPathActive('/profile') || isPathActive('/progress');
          return (
            <Pressable
              key="profile"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => router.push('/profile')}
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
          if (!isAiFeaturesEnabled) {
            return null;
          }
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
          const active = isPathActive('/cycle');
          return (
            <Pressable
              key="cycle"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.push('/cycle');
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
          const active = isPathActive('/settings');
          return (
            <Pressable
              key="settings"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.push('/settings');
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
          const active = isPathActive('/progress');
          return (
            <Pressable
              key="progress"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.push('/progress');
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
          const active = isPathActive('/nutrition/checkin');
          return (
            <Pressable
              key="checkin"
              className="flex-1 items-center justify-center gap-1"
              onPress={() => {
                if (!active) {
                  router.push('/nutrition/checkin');
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
                {t('common.checkin')}
              </Text>
            </Pressable>
          );
        }

        default:
          return null;
      }
    },
    [
      isPathActive,
      isFoodActive,
      isAiFeaturesEnabled,
      isCycleActive,
      unreadChatMessages,
      onCoachPress,
      router,
      t,
      theme,
    ]
  );

  const homeActive = isPathActive('/');

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border-dark"
      style={{ backgroundColor: theme.colors.background.secondaryDark }}
    >
      <SafeAreaView edges={['bottom']}>
        <View className="relative flex-row items-stretch px-6 py-4">
          <Pressable
            className="flex-1 items-center justify-center gap-1"
            onPress={() => {
              if (!homeActive) {
                router.push('/');
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

          {renderNavSlot(rawSlots[1])}

          <Pressable
            className="z-10 flex-1 items-center justify-center gap-1"
            onPress={onCameraPress}
          >
            <View
              className={`h-20 w-20 items-center justify-center rounded-full shadow-lg shadow-accent-primary/50 ${
                isPathActive('/nutrition/ai-camera')
                  ? 'bg-accent-primary'
                  : 'bg-accent-primary opacity-80'
              }`}
            >
              <Camera
                size={theme.iconSize.md}
                color={
                  isPathActive('/nutrition/ai-camera')
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary
                }
                strokeWidth={
                  isPathActive('/nutrition/ai-camera')
                    ? theme.strokeWidth.medium
                    : theme.borderWidth.medium
                }
              />
            </View>
          </Pressable>

          {renderNavSlot(rawSlots[2])}
          {renderNavSlot(rawSlots[3])}
        </View>
      </SafeAreaView>
    </View>
  );
});
