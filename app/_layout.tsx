import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { SnackbarProvider } from '../components/SnackbarContext';
import { loadExercisesFromJson } from '../database/dev';

import '../database';
import '../lang/lang';
import '../global.css';

export default function RootLayout() {
  useEffect(() => {
    // Configure Android navigation bar to be transparent
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.colors.background.primary);
      NavigationBar.setButtonStyleAsync('light');
    }

    // Seed exercises database in development mode
    // This runs after the database is created and initialized
    if (__DEV__) {
      loadExercisesFromJson().catch((error) => {
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
