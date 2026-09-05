import { ActivityIndicator, Image, Text, View } from 'react-native';

import { BootProgressBar } from '@/components/BootProgressBar';
import { useBootColors } from '@/hooks/useBootColors';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';

export function SplashLoading() {
  const colors = useBootColors();
  // Boot migrations/seeding can run for minutes on first launch; keep the
  // screen on so the device doesn't sleep and interrupt the work.
  useKeepScreenAwake('splash-loading');

  return (
    <View className="h-screen w-full items-center justify-center bg-bg-primary">
      <Image source={require('@/assets/logo.png')} className="h-24 w-24" resizeMode="contain" />
      <Text className="mt-5 text-2xl font-bold tracking-tight text-text-primary">Musclog</Text>
      <Text className="mt-1.5 text-xs uppercase tracking-widest text-text-muted">
        Lift, Log, Repeat
      </Text>
      <ActivityIndicator size="small" color={colors.brandVivid} className="mt-12" />
      <BootProgressBar />
    </View>
  );
}
