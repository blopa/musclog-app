import '../database';
import '../lang/lang';
import '../global.css';

import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CoachProvider } from '../components/CoachContext';
import { ErrorFallbackScreen } from '../components/ErrorFallbackScreen';
import { LanguageInitializer } from '../components/LanguageInitializer';
import { MenstrualCycleProvider } from '../components/MenstrualCycleContext';
import { Migrations } from '../components/Migrations';
import { SettingsProvider } from '../context/SettingsContext';
import { SmartCameraProvider } from '../context/SmartCameraContext';
import { SnackbarProvider } from '../context/SnackbarContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { UnreadChatProvider } from '../context/UnreadChatContext';
import { WebModalShellProvider } from '../context/WebModalShellContext';
import { captureException } from '../utils/sentry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
    },
  },
});

// Inner component that has access to theme context
function AppContent() {
  const { theme, isDark } = useThemeContext();

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

  return (
    <>
      {Platform.OS !== 'web' ? <SystemBars style={isDark ? 'light' : 'dark'} /> : null}
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
                // Use our consent-aware captureException
                captureException(error, {
                  data: {
                    react: {
                      componentStack: errorInfo,
                    },
                  },
                });
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
                    <Migrations />
                    <LanguageInitializer />
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
