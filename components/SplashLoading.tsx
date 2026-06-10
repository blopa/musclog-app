import { ActivityIndicator, Image, Text, View } from 'react-native';

import { BOOT_PROGRESS_ACCENT_COLOR } from '@/components/BootProgressBar';

export function SplashLoading() {
  return (
    <View className="h-screen w-full items-center justify-center bg-bg-primary">
      <Image source={require('@/assets/logo.png')} className="h-24 w-24" resizeMode="contain" />
      <Text className="mt-5 text-2xl font-bold tracking-tight text-text-primary">Musclog</Text>
      <Text className="mt-1.5 text-xs uppercase tracking-widest text-text-muted">
        Lift, Log, Repeat
      </Text>
      <ActivityIndicator size="small" color={BOOT_PROGRESS_ACCENT_COLOR} className="mt-12" />
    </View>
  );
}
