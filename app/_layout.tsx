import { Slot } from 'expo-router';

import ConfettiOverlay from '@/components/ConfettiOverlay';
import { Migrations } from '@/components/Migrations';
import { ConfettiInteractionsProvider } from '@/context/ConfettiInteractionsContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';

function GlobalConfetti() {
  const { showConfetti } = useConfettiTrigger();
  return showConfetti ? <ConfettiOverlay /> : null;
}

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
