import { useCallback, useEffect, useRef, useState } from 'react';

import type { ThemeOption } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from './useSettings';

type SettingValue = string | boolean | number;
type SaveFn<T extends SettingValue> = (value: T) => Promise<void>;

/**
 * Settings hook with instant optimistic UI updates and 200ms debounced DB writes.
 *
 * Contract:
 * - UI reflects the user's last interaction immediately (no wait).
 * - DB write is scheduled 200ms after the last change to that key.  If the
 *   user toggles the same key again before 200ms the timer resets — only the
 *   final value is written.
 * - While a write is pending, the sync effect ignores that key so an
 *   in-flight actualSettings update from a *different* key never overwrites
 *   the user's not-yet-saved toggle.
 * - Once the write resolves (success or failure) the key is no longer
 *   pending; the next actualSettings emission will correct any drift.
 */
export function useDebouncedSettings(debounceMs = 200) {
  const actualSettings = useSettings();

  // Source of truth for the UI — updated instantly on every user interaction.
  const [localSettings, setLocalSettings] = useState<Record<string, SettingValue>>({});

  // Keys that have a pending debounced write. While a key is here the sync
  // effect will not overwrite the optimistic local value with the DB value.
  const pendingKeysRef = useRef<Set<string>>(new Set());

  // One timeout handle per setting key.
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Pending (latest) value per key — needed so flushAllPendingChanges knows
  // what to write when the modal closes before the timer fires.
  const pendingValuesRef = useRef<Record<string, SettingValue>>({});

  // --- Initialization ---
  // Populate localSettings from the DB on first load (once isLoading clears).
  const initialized = useRef(false);
  if (!initialized.current && !actualSettings.isLoading) {
    initialized.current = true;
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
      'sendFoundationFoodsToLlm',
      'units',
      'foodSearchSource',
      'conversationContext',
      'chartTooltipPosition',
      'language',
    ];

    const initial: Record<string, SettingValue> = {};
    for (const k of keys) {
      if (actualSettings[k] !== undefined) {
        initial[k] = actualSettings[k] as SettingValue;
      }
    }
    setLocalSettings(initial);
  }

  // --- DB → local sync (runs after render, never during render) ---
  // Only syncs keys that do NOT have a pending write, so an actualSettings
  // update triggered by a *different* setting saving never reverts the user's
  // not-yet-saved toggle.
  useEffect(() => {
    if (actualSettings.isLoading) {
      return;
    }
    setLocalSettings((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        if (pendingKeysRef.current.has(key)) {
          continue; // user has a pending change for this key — leave it alone
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

  // --- Generic handler factory ---
  const createSettingHandler = useCallback(
    <T extends SettingValue>(settingKey: string, saveFunction: SaveFn<T>) =>
      (newValue: T) => {
        // 1. Update UI immediately.
        setLocalSettings((prev) => ({ ...prev, [settingKey]: newValue }));

        // 2. Mark as pending so the sync effect leaves it alone.
        pendingKeysRef.current.add(settingKey);
        pendingValuesRef.current[settingKey] = newValue;

        // 3. Reset the debounce timer for this key.
        if (timeoutRefs.current[settingKey]) {
          clearTimeout(timeoutRefs.current[settingKey]);
        }

        timeoutRefs.current[settingKey] = setTimeout(() => {
          delete timeoutRefs.current[settingKey];
          delete pendingValuesRef.current[settingKey];

          saveFunction(newValue)
            .catch((error) => {
              console.error(`[useDebouncedSettings] Error saving ${settingKey}:`, error);
              // On failure revert local state to whatever the DB says now.
              // The sync effect will handle this on the next actualSettings update.
            })
            .finally(() => {
              pendingKeysRef.current.delete(settingKey);
            });
        }, debounceMs);
      },
    [debounceMs]
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
  const handleSendFoundationFoodsToLlmChange = createSettingHandler(
    'sendFoundationFoodsToLlm',
    SettingsService.setSendFoundationFoodsToLlm
  );
  const handleFoodSearchSourceChange = createSettingHandler(
    'foodSearchSource',
    SettingsService.setFoodSearchSource
  );
  const handleConversationContextChange = createSettingHandler<
    'general' | 'exercise' | 'nutrition'
  >('conversationContext', SettingsService.setCoachConversationContext);
  const handleChartTooltipPositionChange = createSettingHandler<'left' | 'right'>(
    'chartTooltipPosition',
    SettingsService.setChartTooltipPosition
  );
  const handleLanguageChange = createSettingHandler<string>(
    'language',
    SettingsService.setLanguage
  );

  // --- Flush (for when the modal closes before the timer fires) ---
  const flushAllPendingChanges = useCallback(async () => {
    const entries = Object.entries(pendingValuesRef.current);
    for (const [settingKey, value] of entries) {
      if (timeoutRefs.current[settingKey]) {
        clearTimeout(timeoutRefs.current[settingKey]);
        delete timeoutRefs.current[settingKey];
      }
      delete pendingValuesRef.current[settingKey];

      try {
        switch (settingKey) {
          case 'theme':
            await SettingsService.setTheme(value as ThemeOption);
            break;
          case 'connectHealthData':
            await SettingsService.setConnectHealthData(value as boolean);
            break;
          case 'readHealthData':
            await SettingsService.setReadHealthData(value as boolean);
            break;
          case 'writeHealthData':
            await SettingsService.setWriteHealthData(value as boolean);
            break;
          case 'anonymousBugReport':
            await SettingsService.setAnonymousBugReport(value as boolean);
            break;
          case 'enableGoogleGemini':
            await SettingsService.setEnableGoogleGemini(value as boolean);
            break;
          case 'enableOpenAi':
            await SettingsService.setEnableOpenAi(value as boolean);
            break;
          case 'dailyNutritionInsights':
            await SettingsService.setDailyNutritionInsights(value as boolean);
            break;
          case 'workoutInsights':
            await SettingsService.setWorkoutInsights(value as boolean);
            break;
          case 'notifications':
            await SettingsService.setNotifications(value as boolean);
            break;
          case 'notificationsWorkoutReminders':
            await SettingsService.setNotificationsWorkoutReminders(value as boolean);
            break;
          case 'notificationsActiveWorkout':
            await SettingsService.setNotificationsActiveWorkout(value as boolean);
            break;
          case 'notificationsNutritionOverview':
            await SettingsService.setNotificationsNutritionOverview(value as boolean);
            break;
          case 'notificationsMenstrualCycle':
            await SettingsService.setNotificationsMenstrualCycle(value as boolean);
            break;
          case 'notificationsRestTimer':
            await SettingsService.setNotificationsRestTimer(value as boolean);
            break;
          case 'notificationsWorkoutDuration':
            await SettingsService.setNotificationsWorkoutDuration(value as boolean);
            break;
          case 'units':
            await SettingsService.setUnits(value as 'metric' | 'imperial');
            break;
          case 'useOcrBeforeAi':
            await SettingsService.setUseOcrBeforeAi(value as boolean);
            break;
          case 'sendFoundationFoodsToLlm':
            await SettingsService.setSendFoundationFoodsToLlm(value as boolean);
            break;
          case 'foodSearchSource':
            await SettingsService.setFoodSearchSource(value as any);
            break;
          case 'conversationContext':
            await SettingsService.setCoachConversationContext(
              value as 'general' | 'exercise' | 'nutrition'
            );
            break;
          case 'chartTooltipPosition':
            await SettingsService.setChartTooltipPosition(value as 'left' | 'right');
            break;
          case 'language':
            await SettingsService.setLanguage(value as string);
            break;
        }
      } catch (error) {
        console.error(`[useDebouncedSettings] Error flushing ${settingKey}:`, error);
      } finally {
        pendingKeysRef.current.delete(settingKey);
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    for (const t of Object.values(timeoutRefs.current)) {
      clearTimeout(t);
    }
    timeoutRefs.current = {};
  }, []);

  return {
    // Optimistic (local) values
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
    sendFoundationFoodsToLlm:
      (localSettings.sendFoundationFoodsToLlm as boolean) ??
      actualSettings.sendFoundationFoodsToLlm,
    units: (localSettings.units as 'metric' | 'imperial') ?? actualSettings.units,
    foodSearchSource: (localSettings.foodSearchSource as any) ?? actualSettings.foodSearchSource,
    language: (localSettings.language as string) ?? actualSettings.language,
    conversationContext:
      (localSettings.conversationContext as 'general' | 'exercise' | 'nutrition') ??
      actualSettings.conversationContext,
    chartTooltipPosition:
      (localSettings.chartTooltipPosition as 'left' | 'right') ??
      actualSettings.chartTooltipPosition,

    // Confirmed DB values
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
    handleSendFoundationFoodsToLlmChange,
    handleFoodSearchSourceChange,
    handleConversationContextChange,
    handleChartTooltipPositionChange,
    handleLanguageChange,

    // Utilities
    flushAllPendingChanges,
    cleanup,
    hasPendingChanges: pendingKeysRef.current.size > 0,
  };
}
