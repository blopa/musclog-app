import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { DeferredAppBoot } from '@/components/DeferredAppBoot';
// theme.tokens (not theme.ts) so this stays importable before the database layer loads.
import { colors } from '@/theme.tokens';
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
    <View style={{ flex: 1, backgroundColor: colors.darkMint }}>
      <DeferredAppBoot />
      <Slot />
    </View>
  );
}
