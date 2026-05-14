import { Slot } from 'expo-router';

import { Migrations } from '@/components/Migrations';
import { SettingsProvider } from '@/context/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Migrations />
      <Slot />
    </SettingsProvider>
  );
}
