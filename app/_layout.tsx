import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { BootProgressBar } from '@/components/BootProgressBar';
import { DeferredAppBoot } from '@/components/DeferredAppBoot';
import { captureBootException } from '@/utils/bootErrorReporting';

SplashScreen.setOptions({
  duration: 180,
  fade: true,
});

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch((error) =>
      captureBootException(error, 'RootLayout.hideSplashScreen')
    );
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1f1a' }}>
      <DeferredAppBoot />
      <Slot />
      <BootProgressBar />
    </View>
  );
}
