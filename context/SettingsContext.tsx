import { Q } from '@nozbe/watermelondb';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { type AiProviderKind, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '@/constants/ai';
import { type HomeActionKey, parseHomeActions } from '@/constants/homeActions';
import { isStaticExport } from '@/constants/platform';
import { readSetting, SETTINGS } from '@/constants/settingDefinitions';
import {
  ADVANCED_DATA_MANAGEMENT_SETTING_TYPE,
  ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE,
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  type AppLockScope,
  BLE_GENERATE_CHART_PAYLOAD_SETTING_TYPE,
  CHART_TOOLTIP_POSITION_SETTING_TYPE,
  type ChartTooltipPosition,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  CONVERSATION_CONTEXT,
  type CycleNotificationStyle,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  DISABLE_MINIMUM_CALORIES_SETTING_TYPE,
  ENABLE_FASTED_DAY_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_LOCAL_LLM_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  FOOD_SEARCH_SOURCE_SETTING_TYPE,
  type FoodSearchSource,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  HOME_ACTIONS_SETTING_TYPE,
  HOME_SUMMARY_CARD_SETTING_TYPE,
  type HomeHeatmapLayout,
  type HomeHeatmaps,
  type HomeSummaryCard,
  INCLUDE_FIBER_IN_CARBS_SETTING_TYPE,
  INTUITIVE_EATING_MODE_SETTING_TYPE,
  LANGUAGE_SETTING_TYPE,
  LOCAL_LLM_API_KEY_SETTING_TYPE,
  LOCAL_LLM_BASE_URL_SETTING_TYPE,
  LOCAL_LLM_MODEL_SETTING_TYPE,
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
  NUTRITION_DISPLAY_SETTING_TYPE,
  NUTRITION_LOG_HISTORY_DAYS_SETTING_TYPE,
  type NutritionLogHistoryDays,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  PROGRESSION_MODE_SETTING_TYPE,
  type ProgressionMode,
  READ_HEALTH_DATA_SETTING_TYPE,
  REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE,
  type RestAlertSound,
  type RestHapticStrength,
  type RestHeadsUpSeconds,
  SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE,
  SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE,
  SHOW_DAILY_SUPPLEMENT_PROMPT_SETTING_TYPE,
  SHOW_DAILY_WATER_PROMPT_SETTING_TYPE,
  SHOW_WEIGHT_PREDICTION_SETTING_TYPE,
  THEME_SETTING_TYPE,
  type ThemeOption,
  type Units,
  UNITS_SETTING_TYPE,
  USE_BF_FOR_CALCULATIONS_SETTING_TYPE,
  USE_MUSCLOG_FREE_TIER_SETTING_TYPE,
  USE_OCR_BEFORE_AI_SETTING_TYPE,
  USE_ON_DEVICE_AI_SETTING_TYPE,
  USE_THINKING_MODE_SETTING_TYPE,
  type UseSettingsResult,
  WORKOUT_HISTORY_DAYS_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  type WorkoutAutonomy,
  type WorkoutHistoryDays,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database';
import { isDbReady, waitForDbReady } from '@/database/dbReady';
import Setting from '@/database/models/Setting';
import { SettingsService } from '@/database/services/SettingsService';
import { DEFAULT_LANG } from '@/lang/lang';
import { resolveGeminiModel, resolveOpenAiModel } from '@/utils/aiModels';
import { effectiveUseMusclogGateway } from '@/utils/musclogGatewayAvailability';
import {
  getSettingsMirror,
  type MirroredSettings,
  recordSettingsMirror,
} from '@/utils/settingsMirror';
import { normalizeThemeOption } from '@/utils/themeSelection';
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
  localLlmApiKey: string;
  localLlmModel: string;
  localLlmBaseUrl: string;
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  enableLocalLlm: boolean;
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
  useOnDeviceAi: boolean;
  useMusclogFreeTier: boolean;
  sendFoundationFoodsToLlm: boolean;
  useThinkingMode: boolean;
  navSlot1: NavItemKey;
  navSlot2: NavItemKey;
  navSlot3: NavItemKey;
  foodSearchSource: FoodSearchSource;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: ChartTooltipPosition;
  language: string;
  maxAiMemories: number;
  showDailyMoodPrompt: boolean;
  showDailyWaterPrompt: boolean;
  showDailySupplementPrompt: boolean;
  alwaysAllowFoodEditing: boolean;
  showWeightPrediction: boolean;
  requireExportEncryption: boolean;
  disableMinimumCalories: boolean;
  useBfForCalculations: boolean;
  intuitiveEatingMode: boolean;
  enableFastedDay: boolean;
  cycleShowPredictions: boolean;
  cycleShowFertility: boolean;
  cycleNotificationStyle: CycleNotificationStyle;
  cycleQuickLogRaw: string;
  cycleVariabilityHintDismissed: boolean;
  /**
   * The raw stored list, NOT the parsed array (same rule as `homeActionsRaw`): a field that is
   * reallocated per derivation would re-render every `useSettings()` consumer on any write.
   */
  appLockScopesRaw: string;
  includeFiberInCarbs: boolean;
  progressionMode: ProgressionMode;
  /** `gyms.id` of the profile being trained in, '' for none. */
  activeGymId: string;
  /** How much of a started workout's numbers the app decides. */
  workoutAutonomy: WorkoutAutonomy;
  /** Start the rest timer on its own after a set. */
  autoStartRestTimer: boolean;
  /** Haptic countdown on the rest timer. */
  restTimerHaptics: boolean;
  /** Whether the rest-over notification makes a sound. */
  restAlertSound: RestAlertSound;
  /** How firm the haptic countdown is. */
  restHapticStrength: RestHapticStrength;
  /** Seconds before a rest ends that it turns to "get ready" (0 = never). */
  restHeadsUpSeconds: RestHeadsUpSeconds;
  /** Rest, in seconds, after a set that names none of its own. */
  defaultRestSeconds: number;
  nutritionDisplay: string;
  advancedDataManagement: boolean;
  bleGenerateChartPayload: boolean;
  nutritionLogHistoryDays: NutritionLogHistoryDays;
  workoutHistoryDays: WorkoutHistoryDays;
  homeSummaryCard: HomeSummaryCard;
  homeHeatmaps: HomeHeatmaps;
  homeHeatmapLayout: HomeHeatmapLayout;
  /**
   * The raw stored setting, NOT the parsed array.
   *
   * Every field of `SettingsState` has to be a primitive: the observer below only commits
   * a new state object when `prev[k] !== next[k]`, so a field that is freshly allocated on
   * every derivation makes that check permanently true and re-renders every
   * `useSettings()` consumer on any settings write. `homeActions` is parsed out of this
   * once, in a `useMemo` on the context value.
   */
  homeActionsRaw: string;
  showHomeSteps: boolean;
  isLoading: boolean;
};

/**
 * Compile-time guard for the rule above: adding a non-primitive field to `SettingsState`
 * is a build error, not a silent app-wide re-render.
 *
 * `homeActions: HomeActionKey[]` shipped here once. `parseHomeActions` allocates a fresh
 * array per call, so `prev[k] !== next[k]` was permanently true and every settings write
 * anywhere in the app produced a new context value for all ~85 `useSettings()` consumers.
 * Nothing failed; it just re-rendered forever. Derived, non-primitive values belong in a
 * `useMemo` on the context value instead.
 */
type NonPrimitiveFields<T> = {
  [K in keyof T]-?: T[K] extends boolean | number | string ? never : K;
}[keyof T];
const _settingsStateIsFlat: NonPrimitiveFields<SettingsState> extends never ? true : never = true;
void _settingsStateIsFlat;

const DEFAULT_STATE: SettingsState = {
  language: DEFAULT_LANG,
  units: getDefaultUnits(),
  theme: 'system',
  connectHealthData: false,
  readHealthData: false,
  writeHealthData: false,
  anonymousBugReport: true,
  googleGeminiApiKey: '',
  googleGeminiModel: DEFAULT_GEMINI_MODEL,
  openAiApiKey: '',
  openAiModel: DEFAULT_OPENAI_MODEL,
  localLlmApiKey: '',
  localLlmModel: 'llama3',
  localLlmBaseUrl: 'http://localhost:11434/v1',
  enableGoogleGemini: true,
  enableOpenAi: true,
  enableLocalLlm: false,
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
  useOnDeviceAi: false,
  useMusclogFreeTier: false,
  sendFoundationFoodsToLlm: true,
  useThinkingMode: false,
  navSlot1: 'workouts',
  navSlot2: 'food',
  navSlot3: 'coach',
  foodSearchSource: 'both',
  conversationContext: 'general',
  chartTooltipPosition: 'right',
  maxAiMemories: 50,
  showDailyMoodPrompt: true,
  showDailyWaterPrompt: true,
  showDailySupplementPrompt: true,
  alwaysAllowFoodEditing: false,
  showWeightPrediction: true,
  requireExportEncryption: true,
  disableMinimumCalories: false,
  useBfForCalculations: false,
  intuitiveEatingMode: false,
  enableFastedDay: false,
  cycleShowPredictions: SETTINGS.cycleShowPredictions.defaultValue,
  cycleShowFertility: SETTINGS.cycleShowFertility.defaultValue,
  cycleNotificationStyle: SETTINGS.cycleNotificationStyle.defaultValue,
  cycleQuickLogRaw: SETTINGS.cycleQuickLog.defaultValue,
  cycleVariabilityHintDismissed: SETTINGS.cycleVariabilityHintDismissed.defaultValue,
  appLockScopesRaw: '',
  includeFiberInCarbs: true,
  progressionMode: 'reps_first',
  activeGymId: '',
  workoutAutonomy: SETTINGS.workoutAutonomy.defaultValue,
  autoStartRestTimer: SETTINGS.autoStartRestTimer.defaultValue,
  restTimerHaptics: SETTINGS.restTimerHaptics.defaultValue,
  restAlertSound: SETTINGS.restAlertSound.defaultValue,
  restHapticStrength: SETTINGS.restHapticStrength.defaultValue,
  restHeadsUpSeconds: SETTINGS.restHeadsUpSeconds.defaultValue,
  defaultRestSeconds: SETTINGS.defaultRestSeconds.defaultValue,
  nutritionDisplay: '11111',
  advancedDataManagement: false,
  bleGenerateChartPayload: false,
  nutritionLogHistoryDays: 'none',
  workoutHistoryDays: 'none',
  homeSummaryCard: 'daily_summary',
  homeHeatmaps: SETTINGS.homeHeatmaps.defaultValue,
  homeHeatmapLayout: SETTINGS.homeHeatmapLayout.defaultValue,
  homeActionsRaw: '',
  showHomeSteps: SETTINGS.showHomeSteps.defaultValue,
  isLoading: true,
};

function mirroredSettingsOf(state: SettingsState): MirroredSettings {
  return {
    theme: state.theme,
    language: state.language,
    units: state.units,
    appLockScopesRaw: state.appLockScopesRaw,
  };
}

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
  const theme = normalizeThemeOption(rawTheme);

  const rawUnits = getString(map, UNITS_SETTING_TYPE);
  let units: Units;
  if (rawUnits === '1') {
    units = 'imperial';
  } else if (rawUnits === '0') {
    units = 'metric';
  } else {
    units = getDefaultUnits();
  }

  const rawNavSlot1 = getString(map, NAV_SLOT_1_SETTING_TYPE);
  const rawNavSlot2 = getString(map, NAV_SLOT_2_SETTING_TYPE);
  const rawNavSlot3 = getString(map, NAV_SLOT_3_SETTING_TYPE);
  const rawFoodSearchSource = getString(map, FOOD_SEARCH_SOURCE_SETTING_TYPE);
  const rawNutritionLogHistoryDays = getString(map, NUTRITION_LOG_HISTORY_DAYS_SETTING_TYPE);
  const rawWorkoutHistoryDays = getString(map, WORKOUT_HISTORY_DAYS_SETTING_TYPE);
  const rawConversationContext = getString(map, CONVERSATION_CONTEXT);
  const rawChartTooltipPosition = getString(map, CHART_TOOLTIP_POSITION_SETTING_TYPE);
  const language = getString(map, LANGUAGE_SETTING_TYPE, DEFAULT_LANG);
  const maxAiMemories = getNumber(map, MAX_AI_MEMORIES_SETTING_TYPE, 50);
  const rawProgressionMode = getString(map, PROGRESSION_MODE_SETTING_TYPE);
  const progressionMode: ProgressionMode =
    rawProgressionMode === 'weight_first' ? 'weight_first' : 'reps_first';
  const rawHomeSummaryCard = getString(map, HOME_SUMMARY_CARD_SETTING_TYPE);
  const homeSummaryCard: HomeSummaryCard =
    rawHomeSummaryCard === 'weekly_streak' ? 'weekly_streak' : 'daily_summary';

  return {
    language,
    units,
    theme,
    connectHealthData: getBoolean(map, CONNECT_HEALTH_DATA_SETTING_TYPE),
    readHealthData: getBoolean(map, READ_HEALTH_DATA_SETTING_TYPE),
    writeHealthData: getBoolean(map, WRITE_HEALTH_DATA_SETTING_TYPE),
    anonymousBugReport: getBoolean(map, ANONYMOUS_BUG_REPORT_SETTING_TYPE, true),
    googleGeminiApiKey: getString(map, GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
    googleGeminiModel: resolveGeminiModel(
      getString(map, GOOGLE_GEMINI_MODEL_SETTING_TYPE, DEFAULT_GEMINI_MODEL)
    ),
    openAiApiKey: getString(map, OPENAI_API_KEY_SETTING_TYPE),
    openAiModel: resolveOpenAiModel(
      getString(map, OPENAI_MODEL_SETTING_TYPE, DEFAULT_OPENAI_MODEL)
    ),
    localLlmApiKey: getString(map, LOCAL_LLM_API_KEY_SETTING_TYPE),
    localLlmModel: getString(map, LOCAL_LLM_MODEL_SETTING_TYPE, 'llama3'),
    localLlmBaseUrl: getString(map, LOCAL_LLM_BASE_URL_SETTING_TYPE, 'http://localhost:11434/v1'),
    enableGoogleGemini: getBoolean(map, ENABLE_GOOGLE_GEMINI_SETTING_TYPE, true),
    enableOpenAi: getBoolean(map, ENABLE_OPENAI_SETTING_TYPE, true),
    enableLocalLlm: getBoolean(map, ENABLE_LOCAL_LLM_SETTING_TYPE, false),
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
    useOnDeviceAi: getBoolean(map, USE_ON_DEVICE_AI_SETTING_TYPE, false),
    useMusclogFreeTier: getBoolean(map, USE_MUSCLOG_FREE_TIER_SETTING_TYPE, false),
    sendFoundationFoodsToLlm: getBoolean(map, SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE, true),
    useThinkingMode: getBoolean(map, USE_THINKING_MODE_SETTING_TYPE, false),
    navSlot1: (rawNavSlot1 as NavItemKey) || 'workouts',
    navSlot2: (rawNavSlot2 as NavItemKey) || 'food',
    navSlot3: (rawNavSlot3 as NavItemKey) || 'profile',
    foodSearchSource: (rawFoodSearchSource as FoodSearchSource) || 'both',
    conversationContext:
      (rawConversationContext as 'general' | 'exercise' | 'nutrition') || 'general',
    chartTooltipPosition: (rawChartTooltipPosition as ChartTooltipPosition) || 'right',
    maxAiMemories,
    showDailyMoodPrompt: getBoolean(map, SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE, true),
    showDailyWaterPrompt: getBoolean(map, SHOW_DAILY_WATER_PROMPT_SETTING_TYPE, true),
    showDailySupplementPrompt: getBoolean(map, SHOW_DAILY_SUPPLEMENT_PROMPT_SETTING_TYPE, true),
    alwaysAllowFoodEditing: getBoolean(map, ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE, false),
    showWeightPrediction: getBoolean(map, SHOW_WEIGHT_PREDICTION_SETTING_TYPE, true),
    requireExportEncryption: getBoolean(map, REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, true),
    disableMinimumCalories: getBoolean(map, DISABLE_MINIMUM_CALORIES_SETTING_TYPE, false),
    useBfForCalculations: getBoolean(map, USE_BF_FOR_CALCULATIONS_SETTING_TYPE, false),
    intuitiveEatingMode: getBoolean(map, INTUITIVE_EATING_MODE_SETTING_TYPE, false),
    enableFastedDay: getBoolean(map, ENABLE_FASTED_DAY_SETTING_TYPE, false),
    cycleShowPredictions: readSetting(map, SETTINGS.cycleShowPredictions),
    cycleShowFertility: readSetting(map, SETTINGS.cycleShowFertility),
    cycleNotificationStyle: readSetting(map, SETTINGS.cycleNotificationStyle),
    cycleQuickLogRaw: readSetting(map, SETTINGS.cycleQuickLog),
    cycleVariabilityHintDismissed: readSetting(map, SETTINGS.cycleVariabilityHintDismissed),
    appLockScopesRaw: map.get(SETTINGS.appLockScopes.type) ?? '',
    includeFiberInCarbs: getBoolean(map, INCLUDE_FIBER_IN_CARBS_SETTING_TYPE, true),
    progressionMode,
    // State fields stay primitive and non-null: no active gym is the empty string here.
    activeGymId: readSetting(map, SETTINGS.activeGymId) ?? '',
    workoutAutonomy: readSetting(map, SETTINGS.workoutAutonomy),
    autoStartRestTimer: readSetting(map, SETTINGS.autoStartRestTimer),
    restTimerHaptics: readSetting(map, SETTINGS.restTimerHaptics),
    restAlertSound: readSetting(map, SETTINGS.restAlertSound),
    restHapticStrength: readSetting(map, SETTINGS.restHapticStrength),
    restHeadsUpSeconds: readSetting(map, SETTINGS.restHeadsUpSeconds),
    defaultRestSeconds: readSetting(map, SETTINGS.defaultRestSeconds),
    nutritionDisplay: getString(map, NUTRITION_DISPLAY_SETTING_TYPE, '11111'),
    advancedDataManagement: getBoolean(map, ADVANCED_DATA_MANAGEMENT_SETTING_TYPE, false),
    bleGenerateChartPayload: getBoolean(map, BLE_GENERATE_CHART_PAYLOAD_SETTING_TYPE, false),
    nutritionLogHistoryDays: (rawNutritionLogHistoryDays as NutritionLogHistoryDays) || 'none',
    workoutHistoryDays: (rawWorkoutHistoryDays as WorkoutHistoryDays) || 'none',
    homeSummaryCard,
    homeHeatmaps: readSetting(map, SETTINGS.homeHeatmaps),
    homeHeatmapLayout: readSetting(map, SETTINGS.homeHeatmapLayout),
    homeActionsRaw: map.get(HOME_ACTIONS_SETTING_TYPE) ?? '',
    showHomeSteps: readSetting(map, SETTINGS.showHomeSteps),
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
  localLlmApiKey: string;
  localLlmModel: string;
  localLlmBaseUrl: string;
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  enableLocalLlm: boolean;
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
  useOnDeviceAi: boolean;
  useMusclogFreeTier: boolean;
  sendFoundationFoodsToLlm: boolean;
  useThinkingMode: boolean;
  isAiConfigured: boolean;
  isAiMealPhotoEnabled: boolean;
  /** The provider that would answer an AI request now; null when none is configured. */
  aiProvider: AiProviderKind | null;
  navSlot1: NavItemKey;
  navSlot2: NavItemKey;
  navSlot3: NavItemKey;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: ChartTooltipPosition;
  language: string;
  maxAiMemories: number;
  showDailyMoodPrompt: boolean;
  showDailyWaterPrompt: boolean;
  showDailySupplementPrompt: boolean;
  alwaysAllowFoodEditing: boolean;
  showWeightPrediction: boolean;
  requireExportEncryption: boolean;
  disableMinimumCalories: boolean;
  useBfForCalculations: boolean;
  intuitiveEatingMode: boolean;
  enableFastedDay: boolean;
  cycleShowPredictions: boolean;
  cycleShowFertility: boolean;
  cycleNotificationStyle: CycleNotificationStyle;
  cycleQuickLogRaw: string;
  cycleVariabilityHintDismissed: boolean;
  appLockScopes: readonly AppLockScope[];
  /**
   * True while `appLockScopes` is only a default: settings are still loading and
   * no mirror said what they are. Every area must then count as locked.
   */
  appLockScopesPending: boolean;
  includeFiberInCarbs: boolean;
  progressionMode: ProgressionMode;
  activeGymId: string;
  workoutAutonomy: WorkoutAutonomy;
  autoStartRestTimer: boolean;
  restTimerHaptics: boolean;
  restAlertSound: RestAlertSound;
  restHapticStrength: RestHapticStrength;
  restHeadsUpSeconds: RestHeadsUpSeconds;
  defaultRestSeconds: number;
  nutritionDisplay: string;
  advancedDataManagement: boolean;
  bleGenerateChartPayload: boolean;
  homeSummaryCard: HomeSummaryCard;
  homeHeatmaps: HomeHeatmaps;
  homeHeatmapLayout: HomeHeatmapLayout;
  homeActions: readonly HomeActionKey[];
  showHomeSteps: boolean;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Starts from the mirror (loaded by `AppDbReadyGate`) so the first frame has the
  // user's theme, language and units rather than the defaults. See `utils/settingsMirror`.
  const [state, setState] = useState<SettingsState>(() => ({
    ...DEFAULT_STATE,
    ...getSettingsMirror(),
  }));
  // Lock scopes are unknown until the table is read, unless the mirror supplied
  // them. A database not ready at mount belongs to an install that has not
  // finished onboarding, which is the only time `AppDbReadyGate` mounts early,
  // and no lock can be turned on before onboarding — so that case has nothing to
  // protect and must not cover the onboarding screens.
  const [lockScopesUnknownAtMount] = useState(() => getSettingsMirror() === null && isDbReady());
  const [canReadSettingsDb, setCanReadSettingsDb] = useState(false);
  const [decryptedApiKeys, setDecryptedApiKeys] = useState({
    googleGeminiApiKey: '',
    openAiApiKey: '',
    localLlmApiKey: '',
  });

  useEffect(() => {
    if (isStaticExport) {
      const markLoaded = () => {
        setState((prev) => ({ ...prev, isLoading: false }));
      };

      markLoaded();
      return;
    }

    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    async function subscribeWhenDbReady() {
      try {
        await waitForDbReady();
        if (cancelled) {
          return;
        }

        setCanReadSettingsDb(true);
        const query = database.get<Setting>('settings').query(Q.where('deleted_at', Q.eq(null)));
        subscription = query.observeWithColumns(['value']).subscribe({
          next: (settings) => {
            const next = deriveStateFromMap(buildSettingsMap(settings));
            recordSettingsMirror(mirroredSettingsOf(next));
            setState((prev) => {
              const keys = Object.keys(next) as (keyof SettingsState)[];
              const hasChanged = keys.some((k) => prev[k] !== next[k]);
              return hasChanged ? next : prev;
            });
          },
          error: () => {
            if (!cancelled) {
              setState((prev) => ({ ...prev, isLoading: false }));
            }
          },
        });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }

    void subscribeWhenDbReady();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // Decrypt API keys whenever the raw DB value changes (raw may be ciphertext or legacy plaintext).
  useEffect(() => {
    if (state.isLoading || !canReadSettingsDb) {
      return;
    }

    let cancelled = false;
    Promise.all([
      SettingsService.getGoogleGeminiApiKey(),
      SettingsService.getOpenAiApiKey(),
      SettingsService.getLocalLlmApiKey(),
    ])
      .then(([gemini, openAi, localLlm]) => {
        if (!cancelled) {
          setDecryptedApiKeys({
            googleGeminiApiKey: gemini,
            openAiApiKey: openAi,
            localLlmApiKey: localLlm,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    state.googleGeminiApiKey,
    state.openAiApiKey,
    state.localLlmApiKey,
    state.isLoading,
    canReadSettingsDb,
  ]);

  const isAiConfigured = useMemo(() => {
    const useMusclogGateway = effectiveUseMusclogGateway(state.useMusclogFreeTier);

    return (
      useMusclogGateway ||
      state.useOnDeviceAi ||
      (state.enableLocalLlm && state.localLlmBaseUrl.trim() !== '') ||
      (state.enableGoogleGemini && decryptedApiKeys.googleGeminiApiKey.trim() !== '') ||
      (state.enableOpenAi && decryptedApiKeys.openAiApiKey.trim() !== '')
    );
  }, [
    state.useMusclogFreeTier,
    state.useOnDeviceAi,
    state.enableLocalLlm,
    state.localLlmBaseUrl,
    state.enableGoogleGemini,
    decryptedApiKeys.googleGeminiApiKey,
    state.enableOpenAi,
    decryptedApiKeys.openAiApiKey,
  ]);

  const aiProvider = useMemo<AiProviderKind | null>(() => {
    if (effectiveUseMusclogGateway(state.useMusclogFreeTier)) {
      return 'gateway';
    }

    if (state.useOnDeviceAi) {
      return 'on-device';
    }

    if (state.enableLocalLlm && state.localLlmBaseUrl.trim() !== '') {
      return 'local';
    }

    if (state.enableGoogleGemini && decryptedApiKeys.googleGeminiApiKey.trim() !== '') {
      return 'gemini';
    }

    return state.enableOpenAi && decryptedApiKeys.openAiApiKey.trim() !== '' ? 'openai' : null;
  }, [
    state.useMusclogFreeTier,
    state.useOnDeviceAi,
    state.enableLocalLlm,
    state.localLlmBaseUrl,
    state.enableGoogleGemini,
    decryptedApiKeys.googleGeminiApiKey,
    state.enableOpenAi,
    decryptedApiKeys.openAiApiKey,
  ]);

  // Mirrors AiService.getAiConfig() priority: gateway → on-device → local → gemini → openai.
  // On-device (Apple Intelligence) doesn't support image analysis, so photo features are disabled
  // when it would be the active provider.
  const isAiMealPhotoEnabled = useMemo(() => {
    if (effectiveUseMusclogGateway(state.useMusclogFreeTier)) {
      return true;
    }

    if (state.useOnDeviceAi) {
      return false;
    }

    return (
      (state.enableLocalLlm && state.localLlmBaseUrl.trim() !== '') ||
      (state.enableGoogleGemini && decryptedApiKeys.googleGeminiApiKey.trim() !== '') ||
      (state.enableOpenAi && decryptedApiKeys.openAiApiKey.trim() !== '')
    );
  }, [
    state.useMusclogFreeTier,
    state.useOnDeviceAi,
    state.enableLocalLlm,
    state.localLlmBaseUrl,
    state.enableGoogleGemini,
    decryptedApiKeys.googleGeminiApiKey,
    state.enableOpenAi,
    decryptedApiKeys.openAiApiKey,
  ]);

  // Parsed here rather than in `deriveStateFromMap`, so the array is allocated once per
  // actual change instead of once per settings emission — see `homeActionsRaw`.
  const homeActions = useMemo(() => parseHomeActions(state.homeActionsRaw), [state.homeActionsRaw]);

  const appLockScopes = useMemo(
    () => SETTINGS.appLockScopes.parse(state.appLockScopesRaw),
    [state.appLockScopesRaw]
  );

  const appLockScopesPending = lockScopesUnknownAtMount && state.isLoading;

  const value = useMemo(() => {
    const {
      homeActionsRaw: _homeActionsRaw,
      appLockScopesRaw: _appLockScopesRaw,
      ...publicState
    } = state;

    return {
      ...publicState,
      googleGeminiApiKey: decryptedApiKeys.googleGeminiApiKey,
      openAiApiKey: decryptedApiKeys.openAiApiKey,
      localLlmApiKey: decryptedApiKeys.localLlmApiKey,
      homeActions,
      appLockScopes,
      appLockScopesPending,
      isAiConfigured,
      isAiMealPhotoEnabled,
      aiProvider,
      weightUnit: getWeightUnit(state.units),
      heightUnit: getHeightUnit(state.units),
    };
  }, [
    state,
    decryptedApiKeys,
    homeActions,
    appLockScopes,
    appLockScopesPending,
    isAiConfigured,
    isAiMealPhotoEnabled,
    aiProvider,
  ]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }

  return context;
}
