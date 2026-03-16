import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type {
  ChartTooltipPosition,
  FoodSearchSource,
  NavItemKey,
  ThemeOption,
  Units,
  UseSettingsResult,
} from '../constants/settings';
import {
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CHART_TOOLTIP_POSITION_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  CONVERSATION_CONTEXT,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  FOOD_SEARCH_SOURCE_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  LANGUAGE_SETTING_TYPE,
  NAV_SLOT_1_SETTING_TYPE,
  NAV_SLOT_2_SETTING_TYPE,
  NAV_SLOT_3_SETTING_TYPE,
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
  SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  USE_OCR_BEFORE_AI_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '../constants/settings';
import { database } from '../database';
import Setting from '../database/models/Setting';
import { GOOGLE_AUTH_CHANGED_EVENT, isGoogleSignedIn } from '../utils/googleAuth';
import { getHeightUnit, getWeightUnit } from '../utils/units';

// Build a type→value map from an array of Setting records.
// When the same type appears multiple times, keeps the most recently updated one.
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
  isLoading: boolean;
};

const DEFAULT_STATE: SettingsState = {
  language: 'en-US',
  units: 'metric',
  theme: 'system',
  connectHealthData: false,
  readHealthData: false,
  writeHealthData: false,
  anonymousBugReport: true,
  googleGeminiApiKey: '',
  googleGeminiModel: 'gemini-2.0-flash',
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
  navSlot3: 'profile',
  foodSearchSource: 'both',
  conversationContext: 'general',
  chartTooltipPosition: 'right',
  isLoading: true,
};

function deriveStateFromMap(map: Map<string, string>): SettingsState {
  const rawTheme = getString(map, THEME_SETTING_TYPE);
  const theme: ThemeOption = rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : 'system';

  const rawUnits = getString(map, UNITS_SETTING_TYPE);
  const units: Units = rawUnits === '1' ? 'imperial' : 'metric';

  const rawNavSlot1 = getString(map, NAV_SLOT_1_SETTING_TYPE);
  const rawNavSlot2 = getString(map, NAV_SLOT_2_SETTING_TYPE);
  const rawNavSlot3 = getString(map, NAV_SLOT_3_SETTING_TYPE);
  const rawFoodSearchSource = getString(map, FOOD_SEARCH_SOURCE_SETTING_TYPE);
  const rawConversationContext = getString(map, CONVERSATION_CONTEXT);
  const rawChartTooltipPosition = getString(map, CHART_TOOLTIP_POSITION_SETTING_TYPE);

  const language = getString(map, LANGUAGE_SETTING_TYPE, 'en-US');

  return {
    language,
    units,
    theme,
    connectHealthData: getBoolean(map, CONNECT_HEALTH_DATA_SETTING_TYPE),
    readHealthData: getBoolean(map, READ_HEALTH_DATA_SETTING_TYPE),
    writeHealthData: getBoolean(map, WRITE_HEALTH_DATA_SETTING_TYPE),
    anonymousBugReport: getBoolean(map, ANONYMOUS_BUG_REPORT_SETTING_TYPE, true),
    googleGeminiApiKey: getString(map, GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
    googleGeminiModel: getString(map, GOOGLE_GEMINI_MODEL_SETTING_TYPE, 'gemini-2.0-flash'),
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
    isLoading: false,
  };
}

export function useSettings(): UseSettingsResult & {
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
  isAiFeaturesEnabled: boolean;
  isSignedInWithGoogle: boolean;
  navSlot1: NavItemKey;
  navSlot2: NavItemKey;
  navSlot3: NavItemKey;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: ChartTooltipPosition;
  language: string;
} {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    const checkGoogleAuth = () => {
      isGoogleSignedIn()
        .then(setIsGoogleConnected)
        .catch(() => {});
    };

    checkGoogleAuth();

    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        checkGoogleAuth();
      }
    });

    // On web the popup flow never changes AppState, so we listen for an explicit event
    // dispatched by handleGoogleSignIn / deleteAllData instead.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(GOOGLE_AUTH_CHANGED_EVENT, checkGoogleAuth);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(GOOGLE_AUTH_CHANGED_EVENT, checkGoogleAuth);
      }
    };
  }, []);

  useEffect(() => {
    // Single query for ALL settings — one subscription, one re-render per change.
    const query = database.get<Setting>('settings').query(Q.where('deleted_at', Q.eq(null)));

    // observeWithColumns(['value']) fires on both record inserts/deletes AND
    // when the `value` column changes on any existing record. Plain observe()
    // would miss updates to existing settings records.
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
      error: () => {
        setState((prev) => ({ ...prev, isLoading: false }));
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAiFeaturesEnabled = useMemo(() => {
    if (__DEV__) {
      return true;
    }

    return (
      isGoogleConnected ||
      (state.enableGoogleGemini && state.googleGeminiApiKey.trim() !== '') ||
      (state.enableOpenAi && state.openAiApiKey.trim() !== '')
    );
  }, [
    isGoogleConnected,
    state.enableGoogleGemini,
    state.googleGeminiApiKey,
    state.enableOpenAi,
    state.openAiApiKey,
  ]);

  return useMemo(
    () => ({
      ...state,
      isAiFeaturesEnabled,
      isSignedInWithGoogle: isGoogleConnected,
      weightUnit: getWeightUnit(state.units),
      heightUnit: getHeightUnit(state.units),
    }),
    [state, isAiFeaturesEnabled, isGoogleConnected]
  );
}
