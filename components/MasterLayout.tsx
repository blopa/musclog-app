import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, Dumbbell, Home, MessageSquare, UtensilsCrossed } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { CoachModal } from './modals/CoachModal';
import SmartCameraModal from './modals/SmartCameraModal';

type MasterLayoutProps = {
  children: ReactNode;
  showNavigationMenu?: boolean;
};

export function MasterLayout({ children, showNavigationMenu = true }: MasterLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);
  const [isCameraModalVisible, setIsCameraModalVisible] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      // Home should only be active on exact root path
      return pathname === '/';
    }
    // For other paths, check if pathname starts with the path
    return pathname.startsWith(path);
  };

  const isFoodActive = () => {
    // Food is active for /nutrition/food or /nutrition/meals, but not /nutrition/ai-camera
    return (
      (pathname.startsWith('/nutrition/food') || pathname.startsWith('/nutrition/meals')) &&
      !pathname.startsWith('/nutrition/ai-camera')
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-bg-primary"
      edges={showNavigationMenu ? ['top'] : ['top', 'bottom']}
    >
      <StatusBar style="light" />
      {isCoachModalVisible ? (
        <CoachModal visible={isCoachModalVisible} onClose={() => setIsCoachModalVisible(false)} />
      ) : null}
      {isCameraModalVisible ? (
        <SmartCameraModal
          visible={isCameraModalVisible}
          onClose={() => setIsCameraModalVisible(false)}
        />
      ) : null}
      <View className="relative flex-1 overflow-hidden">{children}</View>
      {showNavigationMenu ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-border-dark bg-bg-navBar">
          <SafeAreaView edges={['bottom']}>
            <View className="relative flex-row items-center justify-around px-6 py-4">
              {/* Home */}
              <Pressable
                className="items-center gap-1"
                onPress={() => {
                  if (!isActive('/')) router.push('/');
                }}
              >
                <View
                  className={`h-10 w-16 items-center justify-center rounded-lg ${
                    isActive('/') ? 'bg-bg-navActive' : ''
                  }`}
                >
                  <Home
                    size={theme.iconSize.md}
                    color={isActive('/') ? theme.colors.accent.primary : theme.colors.text.tertiary}
                    strokeWidth={
                      isActive('/') ? theme.strokeWidth.medium : theme.borderWidth.medium
                    }
                  />
                </View>
                <Text
                  className={`text-xs font-medium ${
                    isActive('/') ? 'text-text-accent' : 'text-text-tertiary'
                  }`}
                >
                  {t('home.navigation.home')}
                </Text>
              </Pressable>
              <Pressable
                className="items-center gap-1"
                onPress={() => {
                  if (!isActive('/workout/workouts')) router.push('/workout/workouts');
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
                      isActive('/workout')
                        ? theme.colors.accent.primary
                        : theme.colors.text.tertiary
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
              <Pressable
                className="items-center gap-1"
                onPress={() => setIsCameraModalVisible(true)}
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
              <Pressable
                className="items-center gap-1"
                onPress={() => {
                  if (!isFoodActive()) router.push('/nutrition/food');
                }}
              >
                <View
                  className={`h-10 w-16 items-center justify-center rounded-lg ${
                    isFoodActive() ? 'bg-bg-navActive' : ''
                  }`}
                >
                  <UtensilsCrossed
                    size={theme.iconSize.md}
                    color={
                      isFoodActive() ? theme.colors.accent.primary : theme.colors.text.tertiary
                    }
                    strokeWidth={
                      isFoodActive() ? theme.strokeWidth.medium : theme.borderWidth.medium
                    }
                  />
                </View>
                <Text
                  className={`text-xs font-medium ${
                    isFoodActive() ? 'text-text-accent' : 'text-text-tertiary'
                  }`}
                >
                  {t('home.navigation.food')}
                </Text>
              </Pressable>
              <Pressable
                className="items-center gap-1"
                onPress={() => setIsCoachModalVisible(true)}
              >
                <View className={`h-10 w-16 items-center justify-center rounded-lg`}>
                  <MessageSquare
                    size={theme.iconSize.md}
                    color={theme.colors.text.tertiary}
                    strokeWidth={theme.borderWidth.medium}
                  />
                </View>
                <Text
                  className={`text-xs font-medium ${
                    isActive('/coach') ? 'text-text-accent' : 'text-text-tertiary'
                  }`}
                >
                  {t('home.navigation.coach')}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
