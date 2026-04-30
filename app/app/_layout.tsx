import '@/database';
import '@/lang/lang';
import '@/global.css';

import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as ExpoLinking from 'expo-linking';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { cssInterop } from 'nativewind';
import { useEffect, useState } from 'react';
import { FlatList, Platform, ScrollView, SectionList, TouchableOpacity, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { CoachProvider, useCoach } from '@/components/CoachContext';
import { DocumentTitle } from '@/components/DocumentTitle';
import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { LanguageInitializer } from '@/components/LanguageInitializer';
import { MenstrualCycleProvider } from '@/components/MenstrualCycleContext';
import { Migrations } from '@/components/Migrations';
import { isStaticExport } from '@/constants/platform';
import { SettingsProvider } from '@/context/SettingsContext';
import { SmartCameraProvider, useSmartCamera } from '@/context/SmartCameraContext';
import { SnackbarProvider } from '@/context/SnackbarContext';
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext';
import { UnreadChatProvider } from '@/context/UnreadChatContext';
import { WebModalShellProvider } from '@/context/WebModalShellContext';
import { runWebPreMigrationBackupIfNeeded } from '@/database/preMigrationBackup';
import { handleError } from '@/utils/handleError';
import { isOnboardingCompleted } from '@/utils/onboardingService';

// Set by +native-intent.tsx on cold start to defer widget action until navigator is ready
declare global {

  var __PENDING_WIDGET_ACTION: string | undefined;
}

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
  const themeContext = useThemeContext();
  const theme = themeContext.theme;
  const isDark = themeContext.isDark;

  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const { openCamera } = useSmartCamera();

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

  // Handle widget action stored by +native-intent.tsx on cold start
  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const action = global.__PENDING_WIDGET_ACTION;
    if (!action) {
      return;
    }

    global.__PENDING_WIDGET_ACTION = undefined;

    if (action === 'open-camera') {
      openCamera({ mode: 'barcode-scan' });
    }
  }, [navigationState?.key, openCamera]);

  // Handle widget deep link when app is already running (warm start)
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const { queryParams } = ExpoLinking.parse(url);
      if (queryParams?.action === 'open-camera') {
        openCamera({ mode: 'barcode-scan' });
      } else if (queryParams?.action === 'open-nutrition') {
        router.navigate('/app/nutrition/food');
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [openCamera, router]);

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
