import { View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, BarChart3, Camera, UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';

type MasterLayoutProps = {
  children: ReactNode;
};

export function MasterLayout({ children }: MasterLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <SafeAreaView className="flex-1 bg-[#0a1f1a]" edges={['top']}>
      <StatusBar style="light" />
      <View className="flex-1">{children}</View>

      {/* Bottom Navigation */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-[#1a2f2a] bg-[#0f251f]">
        <SafeAreaView edges={['bottom']}>
          <View className="relative flex-row items-center justify-around px-6 py-4">
            {/* Home */}
            <Pressable className="items-center gap-1" onPress={() => router.push('/')}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/') ? 'bg-[#0f2419]' : ''
                }`}>
                <Home
                  size={24}
                  color={isActive('/') ? '#22c55e' : '#4b5563'}
                  strokeWidth={isActive('/') ? 2.5 : 2}
                />
              </View>
              <Text
                className={`text-xs font-medium ${isActive('/') ? 'text-[#22c55e]' : 'text-gray-600'}`}>
                {t('home.navigation.home')}
              </Text>
            </Pressable>

            {/* Workouts */}
            <Pressable className="items-center gap-1" onPress={() => router.push('/workouts')}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/workouts') ? 'bg-[#0f2419]' : ''
                }`}>
                <Dumbbell
                  size={24}
                  color={isActive('/workouts') ? '#22c55e' : '#4b5563'}
                  strokeWidth={isActive('/workouts') ? 2.5 : 2}
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  isActive('/workouts') ? 'text-[#22c55e]' : 'text-gray-600'
                }`}>
                {t('home.navigation.workouts')}
              </Text>
            </Pressable>

            {/* Spacer for camera button */}
            <View className="w-20" />

            {/* Camera - Central Action Button */}
            <Pressable
              className="absolute items-center justify-center"
              style={{
                top: -32,
                left: '50%',
                transform: [{ translateX: -40 }],
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View className="h-20 w-20 items-center justify-center rounded-full bg-[#22c55e] shadow-lg shadow-[#22c55e]/50">
                <Camera size={32} color="#000000" strokeWidth={2.5} />
              </View>
            </Pressable>

            {/* Food */}
            <Pressable className="items-center gap-1" onPress={() => router.push('/food')}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/food') ? 'bg-[#0f2419]' : ''
                }`}>
                <UtensilsCrossed
                  size={24}
                  color={isActive('/food') ? '#22c55e' : '#4b5563'}
                  strokeWidth={isActive('/food') ? 2.5 : 2}
                />
              </View>
              <Text
                className={`text-xs font-medium ${isActive('/food') ? 'text-[#22c55e]' : 'text-gray-600'}`}>
                {t('home.navigation.food')}
              </Text>
            </Pressable>

            {/* Progress */}
            <Pressable className="items-center gap-1" onPress={() => router.push('/progress')}>
              <View
                className={`h-10 w-16 items-center justify-center rounded-lg ${
                  isActive('/progress') ? 'bg-[#0f2419]' : ''
                }`}>
                <BarChart3
                  size={24}
                  color={isActive('/progress') ? '#22c55e' : '#4b5563'}
                  strokeWidth={isActive('/progress') ? 2.5 : 2}
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  isActive('/progress') ? 'text-[#22c55e]' : 'text-gray-600'
                }`}>
                {t('home.navigation.progress')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
