import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    void runEntryOnboardingRedirect(router, 'index', pathname);
  }, [navigationState?.key, pathname, router]);

  return <SplashLoading />;
}
