import { View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, BarChart3, Calendar, User } from 'lucide-react-native';
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
      <View className="absolute bottom-0 left-0 right-0 z-10 border-t border-[#1a2f2a] bg-[#0f251f]">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-row items-center justify-around px-6 py-4">
            <Pressable className="items-center gap-1" onPress={() => router.push('/')}>
              <Home
                size={24}
                color={isActive('/') ? '#22c55e' : '#4b5563'}
                strokeWidth={isActive('/') ? 2.5 : 2}
              />
              <Text
                className={`text-xs font-medium ${isActive('/') ? 'text-[#22c55e]' : 'text-gray-600'}`}>
                {t('home.navigation.home')}
              </Text>
            </Pressable>

            <Pressable className="items-center gap-1" onPress={() => router.push('/workouts')}>
              <Dumbbell
                size={24}
                color={isActive('/workouts') ? '#22c55e' : '#4b5563'}
                strokeWidth={isActive('/workouts') ? 2.5 : 2}
              />
              <Text
                className={`text-xs font-medium ${
                  isActive('/workouts') ? 'text-[#22c55e]' : 'text-gray-600'
                }`}>
                {t('home.navigation.workouts')}
              </Text>
            </Pressable>

            <Pressable className="items-center gap-1">
              <BarChart3 size={24} color="#4b5563" strokeWidth={2} />
              <Text className="text-xs text-gray-600">{t('home.navigation.progress')}</Text>
            </Pressable>

            <Pressable className="items-center gap-1">
              <Calendar size={24} color="#4b5563" strokeWidth={2} />
              <Text className="text-xs text-gray-600">{t('home.navigation.schedule')}</Text>
            </Pressable>

            <Pressable className="items-center gap-1">
              <User size={24} color="#4b5563" strokeWidth={2} />
              <Text className="text-xs text-gray-600">{t('home.navigation.profile')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
