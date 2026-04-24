import '@/database';
import '@/global.css';
import '@/lang/lang';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import { SettingsProvider } from '@/context/SettingsContext';

const queryClient = new QueryClient();

export default function WebsiteLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <LanguageInitializer />
        <Slot />
      </SettingsProvider>
    </QueryClientProvider>
  );
}
