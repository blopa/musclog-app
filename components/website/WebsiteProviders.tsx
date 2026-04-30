import { ReactNode } from 'react';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import { AnalyticsConsent } from '@/components/website/AnalyticsConsent';

export function WebsiteProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <LanguageInitializer />
      {children}
      <AnalyticsConsent />
    </>
  );
}
