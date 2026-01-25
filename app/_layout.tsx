import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar, AppState, AppStateStatus } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { SnackbarProvider } from '../components/SnackbarContext';
import { seedDevData } from '../database/dev';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';

import '../database';
import '../lang/lang';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // 2. Setup Focus Management for Mobile
    // This ensures TanStack Query knows when the app is active/foregrounded
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);

    // Existing Android Navigation Bar Logic
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.colors.background.primary).catch((error) => {
        if (__DEV__) {
          console.warn(
            'NavigationBar.setBackgroundColorAsync not available (edge-to-edge enabled):',
            error.message
          );
        }
      });
      NavigationBar.setButtonStyleAsync('light');
    }

    // Seed exercises database
    if (__DEV__) {
      seedDevData().catch((error) => {
        console.error('Error seeding exercises database:', error);
      });
    }

    // Cleanup listeners
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <SnackbarProvider>
            {Platform.OS === 'android' ? (
              <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            ) : null}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background.primary },
              }}
            />
          </SnackbarProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
