import { useCallback, useRef, useState } from 'react';

import type { ThemeOption } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from './useSettings';

type SettingValue = string | boolean | number;

/**
 * Generic hook that provides instant settings updates with debounced database persistence
 * This allows the UI to update immediately while saving to the database after a delay
 */
export function useDebouncedSettings(debounceMs = 1500) {
  // Get actual settings from database
  const actualSettings = useSettings();

  // Local state for instant UI updates
  const [localSettings, setLocalSettings] = useState<Record<string, SettingValue>>({});

  // Refs to track timeouts and pending values
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingValuesRef = useRef<Record<string, SettingValue>>({});

  // Initialize local settings with actual settings
  const initializeLocalSettings = useCallback(() => {
    const newLocalSettings: Record<string, SettingValue> = {};

    // Only include settings that are commonly changed in UI
    const settingsToTrack: (keyof typeof actualSettings)[] = [
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
      'units',
    ];

    settingsToTrack.forEach((key) => {
      if (actualSettings[key] !== undefined) {
        newLocalSettings[key] = actualSettings[key];
      }
    });

    setLocalSettings(newLocalSettings);
  }, [actualSettings]);

  // Initialize on mount
  if (Object.keys(localSettings).length === 0) {
    initializeLocalSettings();
  }

  // Sync local settings with actual settings when they change from database
  const syncWithDatabase = useCallback(
    (settingKey: string) => {
      if (pendingValuesRef.current[settingKey] === undefined) {
        setLocalSettings((prev) => ({
          ...prev,
          [settingKey]: actualSettings[settingKey as keyof typeof actualSettings],
        }));
      }
    },
    [actualSettings]
  );

  // Keep local settings in sync with database settings
  // Only update if there's no pending change to avoid overriding user's immediate selection
  Object.keys(actualSettings).forEach((key) => {
    if (
      key in localSettings &&
      localSettings[key] !== actualSettings[key as keyof typeof actualSettings] &&
      pendingValuesRef.current[key] === undefined
    ) {
      syncWithDatabase(key);
    }
  });

  // Generic function to handle setting changes with instant UI update and debounced database save
  const createSettingHandler = useCallback(
    <T extends SettingValue>(settingKey: string, saveFunction: (value: T) => Promise<void>) => {
      return (newValue: T) => {
        // Update UI immediately
        setLocalSettings((prev) => ({
          ...prev,
          [settingKey]: newValue,
        }));

        // Store the pending value
        pendingValuesRef.current[settingKey] = newValue;

        // Clear any existing timeout for this setting
        if (timeoutRefs.current[settingKey]) {
          clearTimeout(timeoutRefs.current[settingKey]);
        }

        // Set new timeout to save to database
        timeoutRefs.current[settingKey] = setTimeout(async () => {
          try {
            await saveFunction(newValue);
            delete pendingValuesRef.current[settingKey];
            delete timeoutRefs.current[settingKey];
          } catch (error) {
            console.error(`[useDebouncedSettings] Error saving ${settingKey} to database:`, error);
            // Revert to actual value on error
            setLocalSettings((prev) => ({
              ...prev,
              [settingKey]: actualSettings[settingKey as keyof typeof actualSettings],
            }));
            delete pendingValuesRef.current[settingKey];
            delete timeoutRefs.current[settingKey];
          }
        }, debounceMs);
      };
    },
    [actualSettings, debounceMs]
  );

  // Specific setting handlers
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

  // Function to immediately save all pending changes to database
  const flushAllPendingChanges = useCallback(async () => {
    const pendingEntries = Object.entries(pendingValuesRef.current);

    for (const [settingKey, value] of pendingEntries) {
      if (timeoutRefs.current[settingKey]) {
        clearTimeout(timeoutRefs.current[settingKey]);
        delete timeoutRefs.current[settingKey];
      }

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
        }
        delete pendingValuesRef.current[settingKey];
      } catch (error) {
        console.error(`[useDebouncedSettings] Error flushing ${settingKey}:`, error);
        // Revert to actual value on error
        setLocalSettings((prev) => ({
          ...prev,
          [settingKey]: actualSettings[settingKey as keyof typeof actualSettings],
        }));
        delete pendingValuesRef.current[settingKey];
      }
    }
  }, [actualSettings]);

  // Cleanup all timeouts on unmount
  const cleanup = useCallback(() => {
    Object.values(timeoutRefs.current).forEach((timeout) => {
      clearTimeout(timeout);
    });
    timeoutRefs.current = {};
  }, []);

  return {
    // Local (instant) values
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

    // Actual (database) values
    actualTheme: actualSettings.theme,
    actualConnectHealthData: actualSettings.connectHealthData,
    actualReadHealthData: actualSettings.readHealthData,
    actualWriteHealthData: actualSettings.writeHealthData,

    // Change handlers
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

    // Utility functions
    flushAllPendingChanges,
    cleanup,

    // Status
    hasPendingChanges: Object.keys(pendingValuesRef.current).length > 0,
  };
}
