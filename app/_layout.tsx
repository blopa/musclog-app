import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { DeferredAppBoot } from '@/components/DeferredAppBoot';
import { useBootColors } from '@/hooks/useBootColors';
import { captureBootException } from '@/utils/bootErrorReporting';
import { registerWebIconFonts } from '@/utils/webIconFonts';

SplashScreen.setOptions({
  duration: 180,
  fade: true,
});

export default function RootLayout() {
  // Expo collects fonts per server render; route imports run outside that context.
  registerWebIconFonts();
  const colors = useBootColors();

  useEffect(() => {
    void SplashScreen.hideAsync().catch((error) =>
      captureBootException(error, 'RootLayout.hideSplashScreen')
    );
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCard }}>
      <DeferredAppBoot />
      <Slot />
    </View>
  );
}
