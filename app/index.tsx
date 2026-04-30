import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
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

  return <SplashLoading />;
}
