import '@/lang/lang';

import { Redirect, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { WebsiteSeoForCurrentRoute } from '@/components/website/WebsiteSeo';
import { isProduction } from '@/utils/app';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isProduction() || !navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'index.web', pathname);
  }, [navigationState?.key, pathname, router]);

  if (isProduction()) {
    return (
      <>
        <WebsiteSeoForCurrentRoute fallbackRouteKey="home" />
        <Redirect href="/home" />
      </>
    );
  }

  return <SplashLoading />;
}
