import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
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

  return <SplashLoading />;
}
