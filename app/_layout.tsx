import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { DeferredAppBoot } from '@/components/DeferredAppBoot';
import { useBootColors } from '@/hooks/useBootColors';
import { captureBootException } from '@/utils/bootErrorReporting';
import { startCrashReportingAtLaunch } from '@/utils/crashReporting';
import { installGracefulFatalHandler } from '@/utils/fatalErrorStore';
import { hydrateSettingsMirror } from '@/utils/settingsMirror';
import { registerWebIconFonts } from '@/utils/webIconFonts';

SplashScreen.setOptions({
  duration: 180,
  fade: true,
});

// Start the settings-mirror read at module load so the boot surfaces can use it too.
void hydrateSettingsMirror();

// Crash handling, in this order: the graceful handler first, so Sentry (started next, when crash
// reports are on) wraps it, reports a fatal error and then hands it to the fatal-error screen
// instead of React Native closing the app. See utils/fatalErrorStore.ts.
if (Platform.OS !== 'web') {
  installGracefulFatalHandler();
}

void startCrashReportingAtLaunch();

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
