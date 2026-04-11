import { Q } from '@nozbe/watermelondb';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { GEMINI_MODELS } from '@/constants/ai';
import { isStaticExport } from '@/constants/platform';
import {
  ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE,
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CHART_TOOLTIP_POSITION_SETTING_TYPE,
  type ChartTooltipPosition,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  CONVERSATION_CONTEXT,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  FOOD_SEARCH_SOURCE_SETTING_TYPE,
  type FoodSearchSource,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  LANGUAGE_SETTING_TYPE,
  MAX_AI_MEMORIES_SETTING_TYPE,
  NAV_SLOT_1_SETTING_TYPE,
  NAV_SLOT_2_SETTING_TYPE,
  NAV_SLOT_3_SETTING_TYPE,
  type NavItemKey,
  NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE,
  NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE,
  NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE,
  NOTIFICATIONS_REST_TIMER_SETTING_TYPE,
  NOTIFICATIONS_SETTING_TYPE,
  NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE,
  NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE,
  SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE,
  SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE,
  SHOW_WEIGHT_PREDICTION_SETTING_TYPE,
  THEME_SETTING_TYPE,
  type ThemeOption,
  type Units,
  UNITS_SETTING_TYPE,
  USE_OCR_BEFORE_AI_SETTING_TYPE,
  type UseSettingsResult,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database';
import Setting from '@/database/models/Setting';
import { SettingsService } from '@/database/services/SettingsService';
import { getDefaultUnits, getHeightUnit, getWeightUnit } from '@/utils/units';

type SettingsState = {
  units: Units;
  theme: ThemeOption;
  connectHealthData: boolean;
  readHealthData: boolean;
  writeHealthData: boolean;
  anonymousBugReport: boolean;
  googleGeminiApiKey: string;
  googleGeminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  dailyNutritionInsights: boolean;
  workoutInsights: boolean;
  notifications: boolean;
  notificationsWorkoutReminders: boolean;
  notificationsActiveWorkout: boolean;
  notificationsNutritionOverview: boolean;
  notificationsMenstrualCycle: boolean;
  notificationsRestTimer: boolean;
  notificationsWorkoutDuration: boolean;
  useOcrBeforeAi: boolean;
  sendFoundationFoodsToLlm: boolean;
  navSlot1: NavItemKey;
  navSlot2: NavItemKey;
  navSlot3: NavItemKey;
  foodSearchSource: FoodSearchSource;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: ChartTooltipPosition;
  language: string;
  maxAiMemories: number;
  showDailyMoodPrompt: boolean;
  alwaysAllowFoodEditing: boolean;
  showWeightPrediction: boolean;
  requireExportEncryption: boolean;
  isLoading: boolean;
};

const DEFAULT_STATE: SettingsState = {
  language: 'en-US',
  units: getDefaultUnits(),
  theme: 'system',
  connectHealthData: false,
  readHealthData: false,
  writeHealthData: false,
  anonymousBugReport: true,
  googleGeminiApiKey: '',
  googleGeminiModel: GEMINI_MODELS.GEMINI_2_5_FLASH.value,
  openAiApiKey: '',
  openAiModel: 'gpt-4o',
  enableGoogleGemini: true,
  enableOpenAi: true,
  dailyNutritionInsights: true,
  workoutInsights: false,
  notifications: true,
  notificationsWorkoutReminders: false,
  notificationsActiveWorkout: false,
  notificationsNutritionOverview: false,
  notificationsMenstrualCycle: false,
  notificationsRestTimer: false,
  notificationsWorkoutDuration: false,
  useOcrBeforeAi: false,
  sendFoundationFoodsToLlm: true,
  navSlot1: 'workouts',
  navSlot2: 'food',
  navSlot3: 'coach',
  foodSearchSource: 'both',
  conversationContext: 'general',
  chartTooltipPosition: 'right',
  maxAiMemories: 50,
  showDailyMoodPrompt: true,
  alwaysAllowFoodEditing: false,
  showWeightPrediction: true,
  requireExportEncryption: true,
  isLoading: true,
};

function buildSettingsMap(settings: Setting[]): Map<string, string> {
  const best = new Map<string, { value: string; updatedAt: number }>();
  for (const s of settings) {
    const existing = best.get(s.type);
    if (!existing || s.updatedAt > existing.updatedAt) {
      best.set(s.type, { value: s.value, updatedAt: s.updatedAt });
    }
  }
  const result = new Map<string, string>();
  for (const [type, { value }] of best) {
    result.set(type, value);
  }
  return result;
}

function getString(map: Map<string, string>, type: string, defaultVal = ''): string {
  return map.get(type) ?? defaultVal;
}

function getBoolean(map: Map<string, string>, type: string, defaultVal = false): boolean {
  const v = map.get(type);
  if (v === undefined) {
    return defaultVal;
  }
  return v === 'true';
}

function getNumber(map: Map<string, string>, type: string, defaultVal = 0): number {
  const v = map.get(type);
  if (v === undefined) {
    return defaultVal;
  }

  return parseInt(v, 10) || defaultVal;
}

function deriveStateFromMap(map: Map<string, string>): SettingsState {
  const rawTheme = getString(map, THEME_SETTING_TYPE);
  const theme: ThemeOption = rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : 'system';

  const rawUnits = getString(map, UNITS_SETTING_TYPE);
  const units: Units =
    rawUnits === '1' ? 'imperial' : rawUnits === '0' ? 'metric' : getDefaultUnits();

  const rawNavSlot1 = getString(map, NAV_SLOT_1_SETTING_TYPE);
  const rawNavSlot2 = getString(map, NAV_SLOT_2_SETTING_TYPE);
  const rawNavSlot3 = getString(map, NAV_SLOT_3_SETTING_TYPE);
  const rawFoodSearchSource = getString(map, FOOD_SEARCH_SOURCE_SETTING_TYPE);
  const rawConversationContext = getString(map, CONVERSATION_CONTEXT);
  const rawChartTooltipPosition = getString(map, CHART_TOOLTIP_POSITION_SETTING_TYPE);
  const language = getString(map, LANGUAGE_SETTING_TYPE, 'en-US');
  const maxAiMemories = getNumber(map, MAX_AI_MEMORIES_SETTING_TYPE, 50);

  return {
    language,
    units,
    theme,
    connectHealthData: getBoolean(map, CONNECT_HEALTH_DATA_SETTING_TYPE),
    readHealthData: getBoolean(map, READ_HEALTH_DATA_SETTING_TYPE),
    writeHealthData: getBoolean(map, WRITE_HEALTH_DATA_SETTING_TYPE),
    anonymousBugReport: getBoolean(map, ANONYMOUS_BUG_REPORT_SETTING_TYPE, true),
    googleGeminiApiKey: getString(map, GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
    googleGeminiModel: getString(
      map,
      GOOGLE_GEMINI_MODEL_SETTING_TYPE,
      GEMINI_MODELS.GEMINI_2_5_FLASH.value
    ),
    openAiApiKey: getString(map, OPENAI_API_KEY_SETTING_TYPE),
    openAiModel: getString(map, OPENAI_MODEL_SETTING_TYPE, 'gpt-4o'),
    enableGoogleGemini: getBoolean(map, ENABLE_GOOGLE_GEMINI_SETTING_TYPE, true),
    enableOpenAi: getBoolean(map, ENABLE_OPENAI_SETTING_TYPE, true),
    dailyNutritionInsights: getBoolean(map, DAILY_NUTRITION_INSIGHTS_SETTING_TYPE, true),
    workoutInsights: getBoolean(map, WORKOUT_INSIGHTS_SETTING_TYPE),
    notifications: getBoolean(map, NOTIFICATIONS_SETTING_TYPE, true),
    notificationsWorkoutReminders: getBoolean(map, NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE),
    notificationsActiveWorkout: getBoolean(map, NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE),
    notificationsNutritionOverview: getBoolean(map, NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE),
    notificationsMenstrualCycle: getBoolean(map, NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE),
    notificationsRestTimer: getBoolean(map, NOTIFICATIONS_REST_TIMER_SETTING_TYPE),
    notificationsWorkoutDuration: getBoolean(map, NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE),
    useOcrBeforeAi: getBoolean(map, USE_OCR_BEFORE_AI_SETTING_TYPE),
    sendFoundationFoodsToLlm: getBoolean(map, SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE, true),
    navSlot1: (rawNavSlot1 as NavItemKey) || 'workouts',
    navSlot2: (rawNavSlot2 as NavItemKey) || 'food',
    navSlot3: (rawNavSlot3 as NavItemKey) || 'profile',
    foodSearchSource: (rawFoodSearchSource as FoodSearchSource) || 'both',
    conversationContext:
      (rawConversationContext as 'general' | 'exercise' | 'nutrition') || 'general',
    chartTooltipPosition: (rawChartTooltipPosition as ChartTooltipPosition) || 'right',
    maxAiMemories,
    showDailyMoodPrompt: getBoolean(map, SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE, true),
    alwaysAllowFoodEditing: getBoolean(map, ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE, false),
    showWeightPrediction: getBoolean(map, SHOW_WEIGHT_PREDICTION_SETTING_TYPE, true),
    requireExportEncryption: getBoolean(map, REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, true),
    isLoading: false,
  };
}

export type SettingsContextType = UseSettingsResult & {
  theme: ThemeOption;
  connectHealthData: boolean;
  readHealthData: boolean;
  writeHealthData: boolean;
  anonymousBugReport: boolean;
  googleGeminiApiKey: string;
  googleGeminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  dailyNutritionInsights: boolean;
  workoutInsights: boolean;
  notifications: boolean;
  notificationsWorkoutReminders: boolean;
  notificationsActiveWorkout: boolean;
  notificationsNutritionOverview: boolean;
  notificationsMenstrualCycle: boolean;
  notificationsRestTimer: boolean;
  notificationsWorkoutDuration: boolean;
  useOcrBeforeAi: boolean;
  sendFoundationFoodsToLlm: boolean;
  isAiConfigured: boolean;
  navSlot1: NavItemKey;
  navSlot2: NavItemKey;
  navSlot3: NavItemKey;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: ChartTooltipPosition;
  language: string;
  maxAiMemories: number;
  showDailyMoodPrompt: boolean;
  alwaysAllowFoodEditing: boolean;
  showWeightPrediction: boolean;
  requireExportEncryption: boolean;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);
  const [decryptedApiKeys, setDecryptedApiKeys] = useState({
    googleGeminiApiKey: '',
    openAiApiKey: '',
  });

  useEffect(() => {
    if (isStaticExport) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const query = database.get<Setting>('settings').query(Q.where('deleted_at', Q.eq(null)));
    const subscription = query.observeWithColumns(['value']).subscribe({
      next: (settings) => {
        const map = buildSettingsMap(settings);
        setState((prev) => {
          const next = deriveStateFromMap(map);
          const keys = Object.keys(next) as (keyof SettingsState)[];
          const hasChanged = keys.some((k) => prev[k] !== next[k]);
          return hasChanged ? next : prev;
        });
      },
      error: () => setState((prev) => ({ ...prev, isLoading: false })),
    });

    return () => subscription.unsubscribe();
  }, []);

  // Decrypt API keys whenever the raw DB value changes (raw may be ciphertext or legacy plaintext).
  useEffect(() => {
    if (state.isLoading) {
      return;
    }

    let cancelled = false;
    Promise.all([SettingsService.getGoogleGeminiApiKey(), SettingsService.getOpenAiApiKey()])
      .then(([gemini, openAi]) => {
        if (!cancelled) {
          setDecryptedApiKeys({ googleGeminiApiKey: gemini, openAiApiKey: openAi });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [state.googleGeminiApiKey, state.openAiApiKey, state.isLoading]);

  const isAiConfigured = useMemo(() => {
    return (
      (state.enableGoogleGemini && decryptedApiKeys.googleGeminiApiKey.trim() !== '') ||
      (state.enableOpenAi && decryptedApiKeys.openAiApiKey.trim() !== '')
    );
  }, [
    state.enableGoogleGemini,
    decryptedApiKeys.googleGeminiApiKey,
    state.enableOpenAi,
    decryptedApiKeys.openAiApiKey,
  ]);

  const value = useMemo(
    () => ({
      ...state,
      googleGeminiApiKey: decryptedApiKeys.googleGeminiApiKey,
      openAiApiKey: decryptedApiKeys.openAiApiKey,
      isAiConfigured,
      weightUnit: getWeightUnit(state.units),
      heightUnit: getHeightUnit(state.units),
    }),
    [state, decryptedApiKeys, isAiConfigured]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}
