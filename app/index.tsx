import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getColor } from '@/theme';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'index');
  }, [navigationState?.key, router]);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: getColor('background.primary') }}
    >
      <ActivityIndicator size="large" color={getColor('accent.primary')} />
    </View>
  );
}
