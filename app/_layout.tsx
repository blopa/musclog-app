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

import { CoachProvider } from '../components/CoachContext';
import { ErrorFallbackScreen } from '../components/ErrorFallbackScreen';
import { SmartCameraProvider } from '../components/SmartCameraContext';
import { SnackbarProvider } from '../components/SnackbarContext';
import { ThemeProvider, useThemeContext } from '../components/ThemeContext';
import { UnreadChatProvider } from '../components/UnreadChatContext';
import { healthDataSyncService } from '../services/healthDataSync';
import { NotificationService } from '../services/NotificationService';
import { getActiveWorkoutLogId } from '../utils/activeWorkoutStorage';
import { configureDailyTasks } from '../utils/configureDailyTasks';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  handleNotificationResponse,
} from '../utils/notifications';
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
  // Boot-time Health Connect sync (Android only, best-effort, 7-day lookback)
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    healthDataSyncService
      .syncFromHealthConnect({ lookbackDays: 7 })
      .catch((err) => console.warn('[boot sync] Health Connect sync error:', err));

    configureDailyTasks().catch((err) => console.warn('[configureDailyTasks] Startup error:', err));

    // Initialize Notifications
    NotificationService.configure()
      .then(async () => {
        NotificationService.scheduleWorkoutReminders();
        NotificationService.scheduleNutritionOverview();
        NotificationService.scheduleMenstrualCycleNotifications();

        // Dismiss any orphaned workout notification from a previous killed session
        const activeWorkoutLogId = await getActiveWorkoutLogId();
        if (!activeWorkoutLogId) {
          NotificationService.dismissActiveWorkoutNotification();
        }
      })
      .catch((err) => console.warn('[NotificationService] Init error:', err));
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    // Handle cold-start: app opened by tapping a notification
    getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch((err) => console.warn('[NotificationService] Cold-start response error:', err));

    const subscription = addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => subscription.remove();
  }, []);

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
          </Sentry.ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;
