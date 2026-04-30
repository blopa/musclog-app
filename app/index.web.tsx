import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!__DEV__ || !navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'index.web');
  }, [navigationState?.key, router]);

  if (!__DEV__) {
    return <Redirect href="/home" />;
  }

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0a1f1a' }}>
      <ActivityIndicator size="large" color="#4EDEA3" />
    </View>
  );
}
