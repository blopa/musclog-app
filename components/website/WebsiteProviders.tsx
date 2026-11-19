import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { AnalyticsConsent } from '@/components/website/AnalyticsConsent';
import { WebsiteLanguageInitializer } from '@/components/website/WebsiteLanguage';
import { WebsiteThemeSync } from '@/components/website/WebsiteThemeSync';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';

const queryClient = new QueryClient();

export function WebsiteProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ThemeProvider preferMirror>
          <WebsiteThemeSync />
          <WebsiteLanguageInitializer />
          {children}
          <AnalyticsConsent />
        </ThemeProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
