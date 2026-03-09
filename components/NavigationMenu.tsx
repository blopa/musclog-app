import { usePathname, useRouter } from 'expo-router';
import {
  Activity,
  Camera,
  Dumbbell,
  Home,
  MessageSquare,
  Target,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { useUnreadChatMessages } from '../hooks/useUnreadChatMessages';

type NavigationMenuProps = {
  onCoachPress: () => void;
  onCameraPress: () => void;
};

export function NavigationMenu({ onCoachPress, onCameraPress }: NavigationMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { isAiFeaturesEnabled } = useSettings();
  const { isActive: isCycleTrackingActive } = useMenstrualCycle();
  const unreadChatMessages = useUnreadChatMessages();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }

    return pathname.startsWith(path);
  };

  const isFoodActive = () => {
    return (
      (pathname.startsWith('/nutrition/food') || pathname.startsWith('/nutrition/meals')) &&
      !pathname.startsWith('/nutrition/ai-camera')
    );
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border-dark"
      style={{ backgroundColor: theme.colors.background.secondaryDark }}
    >
      <SafeAreaView edges={['bottom']}>
        <View className="relative flex-row items-stretch px-6 py-4">
          {/* Focus or Home */}
          <Pressable
            className="flex-1 items-center justify-center gap-1"
            onPress={() => {
              if (isCycleTrackingActive) {
                if (!isActive('/focus')) router.push('/focus');
              } else {
                if (!isActive('/')) router.push('/');
              }
            }}
          >
            <View
              className={`h-10 w-16 items-center justify-center rounded-lg ${
                (isCycleTrackingActive && isActive('/focus')) || (!isCycleTrackingActive && isActive('/'))
                  ? 'bg-bg-navActive'
                  : ''
              }`}
            >
              {isCycleTrackingActive ? (
                <Target
                  size={theme.iconSize.md}
                  color={isActive('/focus') ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={
                    isActive('/focus') ? theme.strokeWidth.medium : theme.borderWidth.medium
                  }
                />
              ) : (
                <Home
                  size={theme.iconSize.md}
                  color={isActive('/') ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={isActive('/') ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              )}
            </View>
            <Text
              className={`text-xs font-medium ${
                (isCycleTrackingActive && isActive('/focus')) ||
                (!isCycleTrackingActive && isActive('/'))
                  ? 'text-text-accent'
                  : 'text-text-tertiary'
              }`}
            >
              {isCycleTrackingActive ? t('home.navigation.focus', 'Focus') : t('home.navigation.home')}
            </Text>
          </Pressable>

          {/* Workouts */}
          <Pressable
            className="flex-1 items-center justify-center gap-1"
            onPress={() => {
              if (!isActive('/workout/workouts')) {
                router.push('/workout/workouts');
              }
            }}
          >
            <View
              className={`h-10 w-16 items-center justify-center rounded-lg ${
                isActive('/workout') ? 'bg-bg-navActive' : ''
              }`}
            >
              <Dumbbell
                size={theme.iconSize.md}
                color={
                  isActive('/workout') ? theme.colors.accent.primary : theme.colors.text.tertiary
                }
                strokeWidth={
                  isActive('/workout') ? theme.strokeWidth.medium : theme.borderWidth.medium
                }
              />
            </View>
            <Text
              className={`text-xs font-medium ${
                isActive('/workout') ? 'text-text-accent' : 'text-text-tertiary'
              }`}
            >
              {t('home.navigation.workouts')}
            </Text>
          </Pressable>

          {/* Camera */}
          <Pressable
            className="z-10 flex-1 items-center justify-center gap-1"
            onPress={onCameraPress}
          >
            <View
              className={`h-20 w-20 items-center justify-center rounded-full shadow-lg shadow-accent-primary/50 ${
                isActive('/nutrition/ai-camera')
                  ? 'bg-accent-primary'
                  : 'bg-accent-primary opacity-80'
              }`}
            >
              <Camera
                size={theme.iconSize.md}
                color={
                  isActive('/nutrition/ai-camera')
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary
                }
                strokeWidth={
                  isActive('/nutrition/ai-camera')
                    ? theme.strokeWidth.medium
                    : theme.borderWidth.medium
                }
              />
            </View>
          </Pressable>

          {/* Cycle or Food */}
          <Pressable
            className="flex-1 items-center justify-center gap-1"
            onPress={() => {
              if (isCycleTrackingActive) {
                if (!isActive('/cycle')) router.push('/cycle');
              } else {
                if (!isFoodActive()) router.push('/nutrition/food');
              }
            }}
          >
            <View
              className={`h-10 w-16 items-center justify-center rounded-lg ${
                (isCycleTrackingActive && isActive('/cycle')) || (!isCycleTrackingActive && isFoodActive())
                  ? 'bg-bg-navActive'
                  : ''
              }`}
            >
              {isCycleTrackingActive ? (
                <Activity
                  size={theme.iconSize.md}
                  color={isActive('/cycle') ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={
                    isActive('/cycle') ? theme.strokeWidth.medium : theme.borderWidth.medium
                  }
                />
              ) : (
                <UtensilsCrossed
                  size={theme.iconSize.md}
                  color={isFoodActive() ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={isFoodActive() ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              )}
            </View>
            <Text
              className={`text-xs font-medium ${
                (isCycleTrackingActive && isActive('/cycle')) ||
                (!isCycleTrackingActive && isFoodActive())
                  ? 'text-text-accent'
                  : 'text-text-tertiary'
              }`}
            >
              {isCycleTrackingActive ? t('home.navigation.cycle', 'Cycle') : t('home.navigation.food')}
            </Text>
          </Pressable>

          {/* Coach or Profile */}
          {isAiFeaturesEnabled ? (
            <Pressable className="flex-1 items-center justify-center gap-1" onPress={onCoachPress}>
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
          ) : (
            <Pressable
              className="flex-1 items-center justify-center gap-1"
              onPress={() => router.push('/profile')}
            >
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/profile') || isActive('/progress') ? 'bg-bg-navActive' : ''
                }`}
              >
                <User
                  size={theme.iconSize.md}
                  color={
                    isActive('/profile') || isActive('/progress')
                      ? theme.colors.accent.primary
                      : theme.colors.text.tertiary
                  }
                  strokeWidth={
                    isActive('/profile') || isActive('/progress')
                      ? theme.strokeWidth.medium
                      : theme.borderWidth.medium
                  }
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  isActive('/profile') || isActive('/progress')
                    ? 'text-text-accent'
                    : 'text-text-tertiary'
                }`}
              >
                {t('home.navigation.profile')}
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
