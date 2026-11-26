import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SETTINGS } from '@/constants/settingDefinitions';
import type { SettingsContextType } from '@/context/SettingsContext';
import { SettingsService } from '@/database/services/SettingsService';

import { useSettings } from './useSettings';

type SettingValue = string | boolean | number;
type PendingSave = { value: SettingValue; save: (value: SettingValue) => Promise<void> };

/**
 * The one list of debounced settings: each key of the settings context and the
 * function that saves it. The saver of a key takes that key's own value type.
 * A new setting is one line here.
 */
const DEBOUNCED_SETTINGS = {
  connectHealthData: SettingsService.setConnectHealthData,
  readHealthData: SettingsService.setReadHealthData,
  writeHealthData: SettingsService.setWriteHealthData,
  anonymousBugReport: SettingsService.setAnonymousBugReport,
  enableGoogleGemini: SettingsService.setEnableGoogleGemini,
  enableOpenAi: SettingsService.setEnableOpenAi,
  enableClaude: (value: boolean) => SettingsService.set(SETTINGS.enableClaude, value),
  enableLocalLlm: SettingsService.setEnableLocalLlm,
  dailyNutritionInsights: SettingsService.setDailyNutritionInsights,
  workoutInsights: SettingsService.setWorkoutInsights,
  notifications: SettingsService.setNotifications,
  notificationsWorkoutReminders: SettingsService.setNotificationsWorkoutReminders,
  notificationsActiveWorkout: SettingsService.setNotificationsActiveWorkout,
  notificationsNutritionOverview: SettingsService.setNotificationsNutritionOverview,
  notificationsMenstrualCycle: SettingsService.setNotificationsMenstrualCycle,
  notificationsRestTimer: SettingsService.setNotificationsRestTimer,
  notificationsWorkoutDuration: SettingsService.setNotificationsWorkoutDuration,
  useOcrBeforeAi: SettingsService.setUseOcrBeforeAi,
  useMusclogFreeTier: SettingsService.setUseMusclogFreeTier,
  sendFoundationFoodsToLlm: SettingsService.setSendFoundationFoodsToLlm,
  thinkingLevel: (level: SettingsContextType['thinkingLevel']) =>
    SettingsService.set(SETTINGS.thinkingLevel, level),
  units: SettingsService.setUnits,
  foodSearchSource: SettingsService.setFoodSearchSource,
  conversationContext: SettingsService.setCoachConversationContext,
  chartTooltipPosition: SettingsService.setChartTooltipPosition,
  language: SettingsService.setLanguage,
  maxAiMemories: SettingsService.setMaxAiMemories,
  showDailyMoodPrompt: SettingsService.setShowDailyMoodPrompt,
  showDailyWaterPrompt: SettingsService.setShowDailyWaterPrompt,
  showDailySupplementPrompt: SettingsService.setShowDailySupplementPrompt,
  alwaysAllowFoodEditing: SettingsService.setAlwaysAllowFoodEditing,
  showWeightPrediction: SettingsService.setShowWeightPrediction,
  requireExportEncryption: SettingsService.setRequireExportEncryption,
  disableMinimumCalories: SettingsService.setDisableMinimumCalories,
  useBfForCalculations: SettingsService.setUseBfForCalculations,
  intuitiveEatingMode: SettingsService.setIntuitiveEatingMode,
  enableFastedDay: SettingsService.setEnableFastedDay,
  includeFiberInCarbs: SettingsService.setIncludeFiberInCarbs,
  progressionMode: SettingsService.setProgressionMode,
  advancedDataManagement: SettingsService.setAdvancedDataManagement,
  bleGenerateChartPayload: SettingsService.setBleGenerateChartPayload,
  nutritionLogHistoryDays: SettingsService.setNutritionLogHistoryDays,
  workoutHistoryDays: SettingsService.setWorkoutHistoryDays,
  aiImageQuality: (tier: SettingsContextType['aiImageQuality']) =>
    SettingsService.set(SETTINGS.aiImageQuality, tier),
  aiMealCameraFlow: (flow: SettingsContextType['aiMealCameraFlow']) =>
    SettingsService.set(SETTINGS.aiMealCameraFlow, flow),
} satisfies {
  [K in keyof SettingsContextType]?: (value: SettingsContextType[K]) => Promise<void>;
};

const createStore = () => ({
  pendingKeys: new Set<string>(),
  timeouts: new Map<string, ReturnType<typeof setTimeout>>(),
  pendingValues: new Map<string, PendingSave>(),
});

type DebouncedKey = keyof typeof DEBOUNCED_SETTINGS;

/** Every key of the table, for the keys initialised from the DB and for tests. */
export const DEBOUNCED_SETTING_KEYS = Object.keys(DEBOUNCED_SETTINGS) as DebouncedKey[];

type Handlers = {
  [K in DebouncedKey as `handle${Capitalize<K>}Change`]: (value: SettingsContextType[K]) => void;
};

type OptimisticValues = { [K in DebouncedKey]: SettingsContextType[K] };

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

  // Mutable bookkeeping, created once. `pendingKeys`: keys with a pending debounced write (the
  // sync effect will not overwrite their optimistic value with the DB value). `timeouts`: one
  // timer per key. `pendingValues`: the latest value and its own saver per key, so
  // flushAllPendingChanges writes each one through the save function it was scheduled with.
  const [store] = useState(createStore);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // --- Initialization ---
  // Populate localSettings from the DB on first load (once isLoading clears).
  const initialized = useRef(false);
  useLayoutEffect(() => {
    if (!initialized.current && !actualSettings.isLoading) {
      initialized.current = true;
      const keys = DEBOUNCED_SETTING_KEYS;

      const initial: Record<string, SettingValue> = {};
      for (const k of keys) {
        if (actualSettings[k] !== undefined) {
          initial[k] = actualSettings[k] as SettingValue;
        }
      }

      setLocalSettings(initial);
    }
  }, [actualSettings]);

  // --- DB → local sync (runs after render, never during render) ---
  // Only syncs keys that do NOT have a pending write, so an actualSettings
  // update triggered by a *different* setting saving never reverts the user's
  // not-yet-saved toggle.
  useEffect(() => {
    if (actualSettings.isLoading) {
      return;
    }

    // Named helper, not a bare setState in the effect body (`react-hooks/set-state-in-effect`).
    const syncFromDb = () =>
      setLocalSettings((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(prev)) {
          if (store.pendingKeys.has(key)) {
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

    syncFromDb();
  }, [actualSettings, store]);

  // --- Handlers: one per table key, built once per debounce delay ---
  const handlers = useMemo(() => {
    const createSettingHandler =
      (settingKey: string, saveFunction: (value: never) => Promise<void>) =>
      (newValue: SettingValue) => {
        // 1. Update UI immediately.
        setLocalSettings((prev) => ({ ...prev, [settingKey]: newValue }));

        // 2. Mark as pending so the sync effect leaves it alone.
        store.pendingKeys.add(settingKey);
        setHasPendingChanges(true);
        // Narrowing the saver's parameter to SettingValue is safe: newValue is a SettingValue.
        const save = saveFunction as (value: SettingValue) => Promise<void>;
        store.pendingValues.set(settingKey, { value: newValue, save });

        // 3. Reset the debounce timer for this key.
        clearTimeout(store.timeouts.get(settingKey));

        store.timeouts.set(
          settingKey,
          setTimeout(() => {
            store.timeouts.delete(settingKey);
            store.pendingValues.delete(settingKey);

            save(newValue)
              .catch((error) => {
                console.error(`[useDebouncedSettings] Error saving ${settingKey}:`, error);
                // On failure revert local state to whatever the DB says now.
                // The sync effect will handle this on the next actualSettings update.
              })
              .finally(() => {
                store.pendingKeys.delete(settingKey);
                setHasPendingChanges(store.pendingKeys.size > 0);
              });
          }, debounceMs)
        );
      };

    const built: Record<string, (value: SettingValue) => void> = {};
    for (const key of DEBOUNCED_SETTING_KEYS) {
      built[`handle${key.charAt(0).toUpperCase()}${key.slice(1)}Change`] = createSettingHandler(
        key,
        DEBOUNCED_SETTINGS[key]
      );
    }

    // The one cast at the runtime boundary: the names and value types are the mapped `Handlers`.
    return built as unknown as Handlers;
  }, [debounceMs, store]);

  // --- Flush (for when the modal closes before the timer fires) ---
  const flushAllPendingChanges = useCallback(async () => {
    const entries = [...store.pendingValues.entries()];
    for (const [settingKey, { value, save }] of entries) {
      clearTimeout(store.timeouts.get(settingKey));
      store.timeouts.delete(settingKey);
      store.pendingValues.delete(settingKey);

      try {
        await save(value);
      } catch (error) {
        console.error(`[useDebouncedSettings] Error flushing ${settingKey}:`, error);
      } finally {
        store.pendingKeys.delete(settingKey);
        setHasPendingChanges(store.pendingKeys.size > 0);
      }
    }
  }, [store]);

  const cleanup = useCallback(() => {
    for (const t of store.timeouts.values()) {
      clearTimeout(t);
    }

    store.timeouts.clear();
  }, [store]);

  const optimistic = {} as Record<string, unknown>;
  for (const key of DEBOUNCED_SETTING_KEYS) {
    optimistic[key] = localSettings[key] ?? actualSettings[key];
  }

  return {
    // Optimistic (local) values
    ...(optimistic as OptimisticValues),

    // Confirmed DB values
    actualConnectHealthData: actualSettings.connectHealthData,
    actualReadHealthData: actualSettings.readHealthData,
    actualWriteHealthData: actualSettings.writeHealthData,

    // Handlers
    ...handlers,

    // Utilities
    flushAllPendingChanges,
    cleanup,
    hasPendingChanges,
  };
}
