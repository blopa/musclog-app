import { useCallback, useEffect, useRef, useState } from 'react';

import type { ThemeOption } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from './useSettings';

type SettingValue = string | boolean | number;

/**
 * Hook that provides instant optimistic UI updates for settings toggles while
 * writing to the database immediately (no debounce).
 *
 * Why no debounce:
 * - All tracked settings here are booleans/enums — single-value changes, not
 *   fast streams (sliders, keypresses).
 * - WatermelonDB is a local database; writes complete in < 50ms.
 * - Debouncing created a window where local state diverged from the DB.
 *   When any other setting's delayed write resolved, useSettings re-read ALL
 *   settings from DB, and the sync loop would sometimes overwrite still-pending
 *   optimistic values with stale DB values.
 *
 * The optimistic `localSettings` state still exists to give an instant visual
 * response before the DB subscription fires and confirms the new value.
 */
export function useDebouncedSettings(_debounceMs = 1500) {
  const actualSettings = useSettings();

  // Optimistic local state: mirrors DB but updates instantly on user interaction.
  const [localSettings, setLocalSettings] = useState<Record<string, SettingValue>>({});

  // Track which keys have been set locally but whose DB confirmation hasn't
  // arrived yet. This prevents the sync effect from overwriting an optimistic
  // value with a stale DB value in the brief moment between a write and the
  // subscription firing.
  const pendingKeysRef = useRef<Set<string>>(new Set());

  // Initialize local state from DB values on first load.
  const initialized = useRef(false);
  if (!initialized.current && !actualSettings.isLoading) {
    initialized.current = true;
    const initial: Record<string, SettingValue> = {};
    const keys: (keyof typeof actualSettings)[] = [
      'theme',
      'connectHealthData',
      'readHealthData',
      'writeHealthData',
      'anonymousBugReport',
      'enableGoogleGemini',
      'enableOpenAi',
      'dailyNutritionInsights',
      'workoutInsights',
      'notifications',
      'notificationsWorkoutReminders',
      'notificationsActiveWorkout',
      'notificationsNutritionOverview',
      'notificationsMenstrualCycle',
      'notificationsRestTimer',
      'notificationsWorkoutDuration',
      'useOcrBeforeAi',
      'units',
    ];
    for (const k of keys) {
      if (actualSettings[k] !== undefined) {
        initial[k] = actualSettings[k] as SettingValue;
      }
    }
    setLocalSettings(initial);
  }

  // Sync local state with DB values whenever actualSettings changes —
  // but only for keys that don't have a locally-pending optimistic value.
  // Running this in a useEffect (not during render) avoids the React
  // anti-pattern of calling setState during the render phase.
  useEffect(() => {
    if (actualSettings.isLoading) {
      return;
    }
    setLocalSettings((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        if (pendingKeysRef.current.has(key)) {
          // User just set this locally; skip until their write lands in the DB.
          continue;
        }
        const dbVal = actualSettings[key as keyof typeof actualSettings] as SettingValue;
        if (dbVal !== undefined && prev[key] !== dbVal) {
          next[key] = dbVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [actualSettings]);

  /**
   * Generic handler factory.
   * 1. Updates local state immediately (optimistic).
   * 2. Marks the key as pending so the sync effect doesn't overwrite it.
   * 3. Writes to DB immediately.
   * 4. Clears the pending mark once the write resolves (whether success or
   *    failure). On failure the DB subscription will re-fire with the old
   *    value, and the sync effect will correct the optimistic state.
   */
  const createSettingHandler = useCallback(
    <T extends SettingValue>(settingKey: string, saveFunction: (value: T) => Promise<void>) =>
      (newValue: T) => {
        // Optimistic update
        setLocalSettings((prev) => ({ ...prev, [settingKey]: newValue }));
        pendingKeysRef.current.add(settingKey);

        saveFunction(newValue)
          .catch((error) => {
            console.error(`[useDebouncedSettings] Error saving ${settingKey}:`, error);
          })
          .finally(() => {
            pendingKeysRef.current.delete(settingKey);
          });
      },
    []
  );

  // --- Specific handlers ---
  const handleThemeChange = createSettingHandler<ThemeOption>('theme', SettingsService.setTheme);
  const handleConnectHealthDataChange = createSettingHandler(
    'connectHealthData',
    SettingsService.setConnectHealthData
  );
  const handleReadHealthDataChange = createSettingHandler(
    'readHealthData',
    SettingsService.setReadHealthData
  );
  const handleWriteHealthDataChange = createSettingHandler(
    'writeHealthData',
    SettingsService.setWriteHealthData
  );
  const handleAnonymousBugReportChange = createSettingHandler(
    'anonymousBugReport',
    SettingsService.setAnonymousBugReport
  );
  const handleEnableGoogleGeminiChange = createSettingHandler(
    'enableGoogleGemini',
    SettingsService.setEnableGoogleGemini
  );
  const handleEnableOpenAiChange = createSettingHandler(
    'enableOpenAi',
    SettingsService.setEnableOpenAi
  );
  const handleDailyNutritionInsightsChange = createSettingHandler(
    'dailyNutritionInsights',
    SettingsService.setDailyNutritionInsights
  );
  const handleWorkoutInsightsChange = createSettingHandler(
    'workoutInsights',
    SettingsService.setWorkoutInsights
  );
  const handleNotificationsChange = createSettingHandler(
    'notifications',
    SettingsService.setNotifications
  );
  const handleNotificationsWorkoutRemindersChange = createSettingHandler(
    'notificationsWorkoutReminders',
    SettingsService.setNotificationsWorkoutReminders
  );
  const handleNotificationsActiveWorkoutChange = createSettingHandler(
    'notificationsActiveWorkout',
    SettingsService.setNotificationsActiveWorkout
  );
  const handleNotificationsNutritionOverviewChange = createSettingHandler(
    'notificationsNutritionOverview',
    SettingsService.setNotificationsNutritionOverview
  );
  const handleNotificationsMenstrualCycleChange = createSettingHandler(
    'notificationsMenstrualCycle',
    SettingsService.setNotificationsMenstrualCycle
  );
  const handleNotificationsRestTimerChange = createSettingHandler(
    'notificationsRestTimer',
    SettingsService.setNotificationsRestTimer
  );
  const handleNotificationsWorkoutDurationChange = createSettingHandler(
    'notificationsWorkoutDuration',
    SettingsService.setNotificationsWorkoutDuration
  );
  const handleUnitsChange = createSettingHandler<'metric' | 'imperial'>(
    'units',
    SettingsService.setUnits
  );
  const handleUseOcrBeforeAiChange = createSettingHandler(
    'useOcrBeforeAi',
    SettingsService.setUseOcrBeforeAi
  );

  // No-op: writes are immediate so there's nothing to flush.
  const flushAllPendingChanges = useCallback(async () => {}, []);
  const cleanup = useCallback(() => {}, []);

  return {
    // Optimistic (local) values — always what the user last set
    theme: (localSettings.theme as ThemeOption) || actualSettings.theme,
    connectHealthData:
      (localSettings.connectHealthData as boolean) ?? actualSettings.connectHealthData,
    readHealthData: (localSettings.readHealthData as boolean) ?? actualSettings.readHealthData,
    writeHealthData: (localSettings.writeHealthData as boolean) ?? actualSettings.writeHealthData,
    anonymousBugReport:
      (localSettings.anonymousBugReport as boolean) ?? actualSettings.anonymousBugReport,
    enableGoogleGemini:
      (localSettings.enableGoogleGemini as boolean) ?? actualSettings.enableGoogleGemini,
    enableOpenAi: (localSettings.enableOpenAi as boolean) ?? actualSettings.enableOpenAi,
    dailyNutritionInsights:
      (localSettings.dailyNutritionInsights as boolean) ?? actualSettings.dailyNutritionInsights,
    workoutInsights: (localSettings.workoutInsights as boolean) ?? actualSettings.workoutInsights,
    notifications: (localSettings.notifications as boolean) ?? actualSettings.notifications,
    notificationsWorkoutReminders:
      (localSettings.notificationsWorkoutReminders as boolean) ??
      actualSettings.notificationsWorkoutReminders,
    notificationsActiveWorkout:
      (localSettings.notificationsActiveWorkout as boolean) ??
      actualSettings.notificationsActiveWorkout,
    notificationsNutritionOverview:
      (localSettings.notificationsNutritionOverview as boolean) ??
      actualSettings.notificationsNutritionOverview,
    notificationsMenstrualCycle:
      (localSettings.notificationsMenstrualCycle as boolean) ??
      actualSettings.notificationsMenstrualCycle,
    notificationsRestTimer:
      (localSettings.notificationsRestTimer as boolean) ?? actualSettings.notificationsRestTimer,
    notificationsWorkoutDuration:
      (localSettings.notificationsWorkoutDuration as boolean) ??
      actualSettings.notificationsWorkoutDuration,
    useOcrBeforeAi: (localSettings.useOcrBeforeAi as boolean) ?? actualSettings.useOcrBeforeAi,
    units: (localSettings.units as 'metric' | 'imperial') ?? actualSettings.units,

    // Actual (DB) values for components that need to know the confirmed state
    actualTheme: actualSettings.theme,
    actualConnectHealthData: actualSettings.connectHealthData,
    actualReadHealthData: actualSettings.readHealthData,
    actualWriteHealthData: actualSettings.writeHealthData,

    // Handlers
    handleThemeChange,
    handleConnectHealthDataChange,
    handleReadHealthDataChange,
    handleWriteHealthDataChange,
    handleAnonymousBugReportChange,
    handleEnableGoogleGeminiChange,
    handleEnableOpenAiChange,
    handleDailyNutritionInsightsChange,
    handleWorkoutInsightsChange,
    handleNotificationsChange,
    handleNotificationsWorkoutRemindersChange,
    handleNotificationsActiveWorkoutChange,
    handleNotificationsNutritionOverviewChange,
    handleNotificationsMenstrualCycleChange,
    handleNotificationsRestTimerChange,
    handleNotificationsWorkoutDurationChange,
    handleUnitsChange,
    handleUseOcrBeforeAiChange,

    // Utilities (kept for API compatibility)
    flushAllPendingChanges,
    cleanup,
    hasPendingChanges: pendingKeysRef.current.size > 0,
  };
}
