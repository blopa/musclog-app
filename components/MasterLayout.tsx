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
          <View className="flex-row items-center justify-around px-6 py-4">
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

            {/* Camera - Central Action Button */}
            <Pressable className="items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] shadow-lg shadow-[#22c55e]/50">
                <Camera size={24} color="#000000" strokeWidth={2.5} />
              </View>
            </Pressable>

            {/* Food */}
            <Pressable className="items-center gap-1">
              <View className="h-10 w-16 items-center justify-center">
                <UtensilsCrossed size={24} color="#4b5563" strokeWidth={2} />
              </View>
              <Text className="text-xs text-gray-600">Food</Text>
            </Pressable>

            {/* Progress */}
            <Pressable className="items-center gap-1">
              <View className="h-10 w-16 items-center justify-center">
                <BarChart3 size={24} color="#4b5563" strokeWidth={2} />
              </View>
              <Text className="text-xs text-gray-600">{t('home.navigation.progress')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
