import * as Device from 'expo-device';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { cssInterop } from 'nativewind';
import { useEffect, useState } from 'react';
import { FlatList, Platform, ScrollView, SectionList, TouchableOpacity, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentTitle } from '@/components/DocumentTitle';
import { MenstrualCycleProvider } from '@/components/MenstrualCycleContext';
import { Migrations } from '@/components/Migrations';
import { useThemeContext } from '@/context/ThemeContext';
import { runWebPreMigrationBackupIfNeeded } from '@/database/preMigrationBackup';
import { isOnboardingCompleted } from '@/utils/onboardingService';

// Fix NativeWind className support on iOS for these components
// These components don't properly support className on iOS without cssInterop
cssInterop(SafeAreaView, { className: 'style' });
cssInterop(TouchableOpacity, { className: 'style' });
cssInterop(FlatList, { className: 'style' });
cssInterop(ScrollView, { className: 'style' });
cssInterop(SectionList, { className: 'style' });

// Inner component that has access to theme context
function AppContent() {
  const { theme, isDark } = useThemeContext();

  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  // On web, run the pre-migration backup check before <Migrations> mounts so
  // that JS-level data transformations in Migrations.tsx cannot run first.
  // On native this state is initialised to true (no gate needed).
  const [webBackupDone, setWebBackupDone] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    runWebPreMigrationBackupIfNeeded()
      .catch((err) => console.warn('[WebBackup] Startup check failed:', err))
      .finally(() => setWebBackupDone(true));
  }, []);

  // Onboarding Guard
  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    // Don't guard onboarding routes
    if (pathname.startsWith('/app/onboarding')) {
      return;
    }

    const checkGuard = async () => {
      const completed = await isOnboardingCompleted();
      if (!completed) {
        router.replace('/app/onboarding/landing');
      }
    };

    checkGuard();
  }, [pathname, navigationState?.key, router]);

  useEffect(() => {
    // Lock orientation to portrait on phones, allow all orientations on tablets
    async function configureOrientation() {
      if (Platform.OS === 'web') {
        return;
      }

      const deviceType = await Device.getDeviceTypeAsync();
      const isTablet = deviceType === Device.DeviceType.TABLET;

      if (isTablet) {
        await ScreenOrientation.unlockAsync();
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }

    configureOrientation().catch((err) => console.warn('[Orientation] Setup error:', err));
  }, []);

  if (!webBackupDone) {
    // Show a blank screen in the app's background colour while the backup check
    // runs (typically < 1 s). Avoids a jarring flash on first load after upgrade.
    return <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }} />;
  }

  return (
    <>
      <DocumentTitle />
      {Platform.OS !== 'web' ? <SystemBars style={isDark ? 'light' : 'dark'} /> : null}
      <Migrations />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background.primary },
          animation: 'fade',
          animationDuration: 200,
        }}
      />
    </>
  );
}

export default function AppLayout() {
  return (
    <MenstrualCycleProvider>
      <AppContent />
    </MenstrualCycleProvider>
  );
}
