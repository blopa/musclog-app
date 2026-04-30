import '@/database';
import '@/lang/lang';
import '@/global.css';

import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ExpoLinking from 'expo-linking';
import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CoachProvider } from '@/components/CoachContext';
import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { LanguageInitializer } from '@/components/LanguageInitializer';
import { isStaticExport } from '@/constants/platform';
import { SettingsProvider } from '@/context/SettingsContext';
import { SmartCameraProvider, useSmartCamera } from '@/context/SmartCameraContext';
import { SnackbarProvider } from '@/context/SnackbarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UnreadChatProvider } from '@/context/UnreadChatContext';
import { WebModalShellProvider } from '@/context/WebModalShellContext';
import { handleError } from '@/utils/handleError';

declare global {

  var __PENDING_WIDGET_ACTION: string | undefined;
}

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

function GlobalListeners() {
  const router = useRouter();
  const { openCamera } = useSmartCamera();

  // Handle widget action stored by +native-intent.tsx on cold start
  useEffect(() => {
    const action = global.__PENDING_WIDGET_ACTION;
    if (!action) {
      return;
    }

    global.__PENDING_WIDGET_ACTION = undefined;

    if (action === 'open-camera') {
      openCamera({ mode: 'barcode-scan' });
    }
  }, [openCamera]);

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

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={Platform.OS === 'web' ? { flex: 1, minHeight: '100%', width: '100%' } : { flex: 1 }}
    >
      <WebModalShellProvider>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <Sentry.ErrorBoundary
              onError={(error) => {
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
                <LanguageInitializer />
                <ThemeProvider>
                  <UnreadChatProvider>
                    <SnackbarProvider>
                      <SmartCameraProvider>
                        <CoachProvider>
                          <GlobalListeners />
                          <Slot />
                        </CoachProvider>
                      </SmartCameraProvider>
                    </SnackbarProvider>
                  </UnreadChatProvider>
                </ThemeProvider>
              </SettingsProvider>
            </Sentry.ErrorBoundary>
          </SafeAreaProvider>
        </QueryClientProvider>
      </WebModalShellProvider>
    </GestureHandlerRootView>
  );
}
