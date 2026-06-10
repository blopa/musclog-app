import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { BootProgressOverlay } from '@/components/BootProgressOverlay';
import { DeferredAppBoot } from '@/components/DeferredAppBoot';

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <DeferredAppBoot />
      <Slot />
      <BootProgressOverlay />
    </>
  );
}
