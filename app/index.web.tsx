import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { isProduction } from '@/utils/app';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isProduction() || !navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'index.web');
  }, [navigationState?.key, router]);

  if (isProduction()) {
    return <Redirect href="/home" />;
  }

  return <SplashLoading />;
}
