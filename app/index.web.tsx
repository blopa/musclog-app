import '@/lang/lang';

import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { WebsiteShell } from '@/components/website/WebsiteShell';
import { isProduction } from '@/utils/app';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

import Home from './(website)/home.web';

export function generateMetadata() {
  return fixedPageMetadata('home');
}

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
      <WebsiteShell>
        <Home />
      </WebsiteShell>
    );
  }

  return <SplashLoading />;
}
