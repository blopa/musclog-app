import '../database';
import '../lang/lang';
import '../global.css';

import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SnackbarProvider } from '../components/SnackbarContext';
import { seedDevData } from '../database/seeders/dev';
import { seedProductionData } from '../database/seeders/prod';
import { verifyDatabaseTables } from '../database/verify';
import { theme } from '../theme';

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

    // Verify database tables exist (development only)
    if (__DEV__) {
      verifyDatabaseTables()
        .then((result) => {
          if (!result.success) {
            console.error('⚠️  DATABASE NOT INITIALIZED PROPERLY');
            console.error('Missing tables:', result.missingTables);
            console.error('Solution: Uninstall the app completely and reinstall it.');
          }
        })
        .catch((error) => {
          console.error('Error verifying database:', error);
        });

      // Seed development data
      seedDevData().catch((error) => {
        console.error('Error seeding exercises database:', error);
      });
    } else {
      // Seed production data
      seedProductionData().catch((error) => {
        console.error('Error seeding production data:', error);
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
