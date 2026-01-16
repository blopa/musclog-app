import { View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, MessageSquare, Camera, UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import React, { ReactNode, useState } from 'react';
import { theme } from '../theme';
import { CoachModal } from './modals/CoachModal';

type MasterLayoutProps = {
  children: ReactNode;
};

export function MasterLayout({ children }: MasterLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <StatusBar style="light" />
      <CoachModal visible={isCoachModalVisible} onClose={() => setIsCoachModalVisible(false)} />
      <View className="flex-1">{children}</View>

      {/* Bottom Navigation */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border-dark bg-bg-navBar">
        <SafeAreaView edges={['bottom']}>
          <View className="relative flex-row items-center justify-around px-6 py-4">
            {/* Home */}
            <Pressable
              className="items-center gap-1"
              onPress={() => {
                if (!isActive('/')) router.push('/');
              }}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/') ? 'bg-bg-navActive' : ''
                }`}>
                <Home
                  size={theme.iconSize.md}
                  color={isActive('/') ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  strokeWidth={isActive('/') ? theme.strokeWidth.medium : theme.borderWidth.medium}
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  isActive('/') ? 'text-text-accent' : 'text-text-tertiary'
                }`}>
                {t('home.navigation.home')}
              </Text>
            </Pressable>

            {/* Workouts */}
            <Pressable
              className="items-center gap-1"
              onPress={() => {
                if (!isActive('/workouts')) router.push('/workouts');
              }}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/workouts') ? 'bg-bg-navActive' : ''
                }`}>
                <Dumbbell
                  size={theme.iconSize.md}
                  color={
                    isActive('/workouts') ? theme.colors.accent.primary : theme.colors.text.tertiary
                  }
                  strokeWidth={
                    isActive('/workouts') ? theme.strokeWidth.medium : theme.borderWidth.medium
                  }
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  isActive('/workouts') ? 'text-text-accent' : 'text-text-tertiary'
                }`}>
                {t('home.navigation.workouts')}
              </Text>
            </Pressable>

            {/* Camera */}
            <Pressable className="items-center gap-1">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-primary shadow-lg shadow-accent-primary/50">
                <Camera
                  size={theme.iconSize.md}
                  color={theme.colors.text.tertiary}
                  strokeWidth={theme.borderWidth.medium}
                />
              </View>
            </Pressable>

            {/* Food */}
            <Pressable
              className="items-center gap-1"
              onPress={() => {
                if (!isActive('/food')) router.push('/food');
              }}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/food') ? 'bg-bg-navActive' : ''
                }`}>
                <UtensilsCrossed
                  size={theme.iconSize.md}
                  color={
                    isActive('/food') ? theme.colors.accent.primary : theme.colors.text.tertiary
                  }
                  strokeWidth={
                    isActive('/food') ? theme.strokeWidth.medium : theme.borderWidth.medium
                  }
                />
              </View>
              <Text
                className={`text-xs font-medium ${isActive('/food') ? 'text-text-accent' : 'text-text-tertiary'}`}>
                {t('home.navigation.food')}
              </Text>
            </Pressable>

            {/* Coach */}
            <Pressable className="items-center gap-1" onPress={() => setIsCoachModalVisible(true)}>
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
                }`}>
                {t('home.navigation.coach')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
