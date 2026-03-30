import '../database';
import '../lang/lang';
import '../global.css';

import * as Sentry from '@sentry/react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { Stack, useSegments } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CoachProvider } from '../components/CoachContext';
import { ErrorFallbackScreen } from '../components/ErrorFallbackScreen';
import { LanguageInitializer } from '../components/LanguageInitializer';
import { MenstrualCycleProvider } from '../components/MenstrualCycleContext';
import { SettingsProvider } from '../context/SettingsContext';
import { SmartCameraProvider } from '../context/SmartCameraContext';
import { SnackbarProvider } from '../context/SnackbarContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { UnreadChatProvider } from '../context/UnreadChatContext';
import { ExerciseService } from '../database/services';
import { healthDataSyncService } from '../services/healthDataSync';
import { NotificationService } from '../services/NotificationService';
import { getActiveWorkoutLogId, pruneWorkoutInsights } from '../utils/activeWorkoutStorage';
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
  const segments = useSegments();

  // Prune orphaned workout insights dismissal state when leaving the workout domain.
  // This prevents accumulation of old keys if the app is killed or navigates away.
  useEffect(() => {
    const isInsideWorkoutDomain = segments[0] === 'workout';
    if (!isInsideWorkoutDomain) {
      pruneWorkoutInsights().catch((err) => console.warn('[WorkoutInsights] Pruning error:', err));
    }
  }, [segments]);

  // Backfill the exercise `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v2 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    ExerciseService.backfillExerciseSources().catch((err) =>
      console.warn('[ExerciseService] backfillExerciseSources error:', err)
    );
  }, []);

  // Sync app exercises on every boot: seeds any exercises that are in the
  // bundled JSON but missing from the DB with source='app'. This is a no-op
  // on most boots once the DB is up to date.
  useEffect(() => {
    ExerciseService.syncAppExercises().catch((err) =>
      console.warn('[ExerciseService] syncAppExercises error:', err)
    );
  }, []);

  // Boot-time tasks (native: Android + iOS, all run in parallel)
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const notificationInit = NotificationService.configure()
      .then(async () => {
        NotificationService.scheduleWorkoutReminders();
        NotificationService.scheduleNutritionOverview();
        NotificationService.scheduleMenstrualCycleNotifications();
        NotificationService.scheduleCheckinNotifications();

        // Dismiss any orphaned workout notification from a previous killed session
        const activeWorkoutLogId = await getActiveWorkoutLogId();
        if (!activeWorkoutLogId) {
          NotificationService.dismissActiveWorkoutNotification();
        }
      })
      .catch((err) => console.warn('[NotificationService] Init error:', err));

    Promise.all([
      healthDataSyncService
        .syncFromHealthPlatform({ lookbackDays: 7 })
        .catch((err) => console.warn('[boot sync] Health platform sync error:', err)),
      configureDailyTasks().catch((err) =>
        console.warn('[configureDailyTasks] Startup error:', err)
      ),
      notificationInit,
    ]);
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
      .catch((err: any) => console.warn('[NotificationService] Cold-start response error:', err));

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
            <SettingsProvider>
              <MenstrualCycleProvider>
                <ThemeProvider>
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
    </GestureHandlerRootView>
  );
}

export default RootLayout;
