import { Slot } from 'expo-router';

import { AppBoot } from '@/components/AppBoot';
import { SettingsProvider } from '@/context/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppBoot />
      <Slot />
    </SettingsProvider>
  );
}
