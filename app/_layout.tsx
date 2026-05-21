import { Slot } from 'expo-router';

import { Migrations } from '@/components/Migrations';
import { ConfettiInteractionsProvider } from '@/context/ConfettiInteractionsContext';
import { SettingsProvider } from '@/context/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <ConfettiInteractionsProvider>
        <Migrations />
        <Slot />
      </ConfettiInteractionsProvider>
    </SettingsProvider>
  );
}
