import { ActivityIndicator, Image, Text, View } from 'react-native';

// theme.tokens (not theme.ts) so this stays importable before the database layer loads.
import { colors } from '@/theme.tokens';

export function SplashLoading() {
  return (
    <View className="h-screen w-full items-center justify-center bg-bg-primary">
      <Image source={require('@/assets/logo.png')} className="h-24 w-24" resizeMode="contain" />
      <Text className="mt-5 text-2xl font-bold tracking-tight text-text-primary">Musclog</Text>
      <Text className="mt-1.5 text-xs uppercase tracking-widest text-text-muted">
        Lift, Log, Repeat
      </Text>
      <ActivityIndicator size="small" color={colors.jade} className="mt-12" />
    </View>
  );
}
