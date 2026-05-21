import { Slot } from 'expo-router';

import GlobalConfetti from '@/components/GlobalConfetti';
import { Migrations } from '@/components/Migrations';
import { ConfettiInteractionsProvider } from '@/context/ConfettiInteractionsContext';
import { SettingsProvider } from '@/context/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <ConfettiInteractionsProvider>
        <Migrations />
        <Slot />
        <GlobalConfetti />
      </ConfettiInteractionsProvider>
    </SettingsProvider>
  );
}
