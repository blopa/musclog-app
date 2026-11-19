import '@/lang/lang';

import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { LegacyForward } from '@/components/website/LegacyForward';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { isProduction } from '@/utils/app';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

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

  // The public home page is `/en`, `/es`, …: the bare address is an old one and forwards to English.
  if (isProduction()) {
    return <LegacyForward to="/en" />;
  }

  return <SplashLoading />;
}
