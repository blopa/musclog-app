import '../database';
import '../lang/lang';
import '../global.css';

import * as Sentry from '@sentry/react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorFallbackScreen } from '../components/ErrorFallbackScreen';
import { SnackbarProvider } from '../components/SnackbarContext';
import { ThemeProvider, useThemeContext } from '../components/ThemeContext';

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
    // Setup Android Navigation Bar with dynamic theme
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.colors.background.primary).catch((error) => {
        if (__DEV__) {
          console.warn(
            'NavigationBar.setBackgroundColorAsync not available (edge-to-edge enabled):',
            error.message
          );
        }
      });
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [theme, isDark]);

  return (
    <>
      {Platform.OS === 'android' ? (
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background.primary },
        }}
      />
    </>
  );
}

function RootLayout() {
  useEffect(() => {
    // 2. Setup Focus Management for Mobile
    // This ensures TanStack Query knows when the app is active/foregrounded
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);

    // Cleanup listeners
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Sentry.ErrorBoundary
            fallback={({ error, resetError }) => (
              <ErrorFallbackScreen
                error={error instanceof Error ? error : new Error(String(error))}
                resetError={resetError}
              />
            )}
          >
            <ThemeProvider>
              <SnackbarProvider>
                <AppContent />
              </SnackbarProvider>
            </ThemeProvider>
          </Sentry.ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
