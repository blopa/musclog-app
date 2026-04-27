import '@/database';
import '@/lang/lang';
import '@/global.css';

import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { cssInterop } from 'nativewind';
import { useEffect, useState } from 'react';
import { FlatList, Platform, ScrollView, SectionList, TouchableOpacity, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { CoachProvider } from '@/components/CoachContext';
import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { LanguageInitializer } from '@/components/LanguageInitializer';
import { MenstrualCycleProvider } from '@/components/MenstrualCycleContext';
import { Migrations } from '@/components/Migrations';
import { isStaticExport } from '@/constants/platform';
import { SettingsProvider } from '@/context/SettingsContext';
import { SmartCameraProvider } from '@/context/SmartCameraContext';
import { SnackbarProvider } from '@/context/SnackbarContext';
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext';
import { UnreadChatProvider } from '@/context/UnreadChatContext';
import { WebModalShellProvider } from '@/context/WebModalShellContext';
import { runWebPreMigrationBackupIfNeeded } from '@/database/preMigrationBackup';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { handleError } from '@/utils/handleError';

// Fix NativeWind className support on iOS for these components
// These components don't properly support className on iOS without cssInterop
cssInterop(SafeAreaView, { className: 'style' });
cssInterop(TouchableOpacity, { className: 'style' });
cssInterop(FlatList, { className: 'style' });
cssInterop(ScrollView, { className: 'style' });
cssInterop(SectionList, { className: 'style' });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: isStaticExport ? 0 : 2,
      staleTime: isStaticExport ? Infinity : 0,
      refetchOnWindowFocus: !isStaticExport,
      refetchOnReconnect: !isStaticExport,
      refetchOnMount: !isStaticExport,
    },
  },
});

// Inner component that has access to theme context
function AppContent() {
  const { theme, isDark } = useThemeContext();

  // Set document title based on current route (web only)
  useDocumentTitle();

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
      {Platform.OS !== 'web' ? <SystemBars style={isDark ? 'light' : 'dark'} /> : null}
      <Migrations />
      <LanguageInitializer />
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

function RootLayout() {
  return (
    <GestureHandlerRootView
      style={Platform.OS === 'web' ? { flex: 1, minHeight: '100%', width: '100%' } : { flex: 1 }}
    >
      <WebModalShellProvider>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <Sentry.ErrorBoundary
              onError={(error, errorInfo) => {
                handleError(error, 'app._layout.errorBoundary');
              }}
              fallback={({ error, resetError }) => (
                <ErrorFallbackScreen
                  error={error instanceof Error ? error : new Error(String(error))}
                  resetError={resetError}
                />
              )}
            >
              <SettingsProvider>
                <MenstrualCycleProvider>
                  <ThemeProvider>
                    <UnreadChatProvider>
                      <SnackbarProvider>
                        <SmartCameraProvider>
                          <CoachProvider>
                            <AppContent />
                          </CoachProvider>
                        </SmartCameraProvider>
                      </SnackbarProvider>
                    </UnreadChatProvider>
                  </ThemeProvider>
                </MenstrualCycleProvider>
              </SettingsProvider>
            </Sentry.ErrorBoundary>
          </SafeAreaProvider>
        </QueryClientProvider>
      </WebModalShellProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;
