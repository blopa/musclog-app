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

  // The public home page is `/en`, `/es`, …: this is what the export renders at the bare address before `scripts/write-unprefixed-pages.js` replaces `dist/index.html` with a copy of the English home page; the bare address forwards to English only on the development server.
  if (isProduction()) {
    return <LegacyForward to="/en" />;
  }

  return <SplashLoading />;
}
