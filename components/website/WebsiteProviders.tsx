import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import { SettingsProvider } from '@/context/SettingsContext';

const queryClient = new QueryClient();

export function WebsiteProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <LanguageInitializer />
        {children}
      </SettingsProvider>
    </QueryClientProvider>
  );
}
