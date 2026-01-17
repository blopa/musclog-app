import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { SnackbarProvider } from '../components/SnackbarContext';
import { seedExercisesIfEmpty } from '../database/dev';

import '../database';
import '../lang/lang';
import '../global.css';

export default function RootLayout() {
  useEffect(() => {
    // Configure Android navigation bar to be transparent
    // Note: setBackgroundColorAsync is not supported when edge-to-edge is enabled (Android 15+)
    // We wrap it in try-catch to gracefully handle this case
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.colors.background.primary).catch((error) => {
        // Silently handle edge-to-edge incompatibility - this is expected on Android 15+
        if (__DEV__) {
          console.warn(
            'NavigationBar.setBackgroundColorAsync not available (edge-to-edge enabled):',
            error.message
          );
        }
      });
      NavigationBar.setButtonStyleAsync('light');
    }

    // Seed exercises database in development mode if it's empty
    // This runs after the database is created and initialized
    if (__DEV__) {
      seedExercisesIfEmpty().catch((error) => {
        console.error('Error seeding exercises database:', error);
      });
    }
  }, []);

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <SnackbarProvider>
          {Platform.OS === 'android' && (
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          )}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background.primary },
            }}
          />
        </SnackbarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
