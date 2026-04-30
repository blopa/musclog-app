import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getColor } from '@/theme';
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
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: getColor('background.primary') }}
    >
      <ActivityIndicator size="large" color={getColor('accent.primary')} />
    </View>
  );
}
