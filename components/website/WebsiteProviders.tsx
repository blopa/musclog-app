import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import { AnalyticsConsent } from '@/components/website/AnalyticsConsent';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';

const queryClient = new QueryClient();

export function WebsiteProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ThemeProvider>
          <LanguageInitializer />
          {children}
          <AnalyticsConsent />
        </ThemeProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
