import { THEME_DEFINITIONS, THEME_IDS as REGISTRY_THEME_IDS } from '@/theme.registry';

/**
 * Setting type for units preference (stored in WatermelonDB settings table).
 * value: '0' = metric, '1' = imperial.
 */
export const UNITS_SETTING_TYPE = 'unit_system';

/**
 * Setting type for theme preference (stored in WatermelonDB settings table).
 * value: 'system' | one of THEME_IDS.
 */
export const THEME_SETTING_TYPE = 'theme';

/**
 * Setting type for health data connection (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const CONNECT_HEALTH_DATA_SETTING_TYPE = 'connect_health_data';

/**
 * Setting type for health data read permission (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const READ_HEALTH_DATA_SETTING_TYPE = 'read_health_data';

/**
 * Setting type for health data write permission (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const WRITE_HEALTH_DATA_SETTING_TYPE = 'write_health_data';

/**
 * Setting type for anonymous bug report (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const ANONYMOUS_BUG_REPORT_SETTING_TYPE = 'anonymous_bug_report';

/**
 * Setting type for Google Gemini API key (stored in WatermelonDB settings table).
 * value: string.
 */
export const GOOGLE_GEMINI_API_KEY_SETTING_TYPE = 'google_gemini_api_key';

/**
 * Setting type for Google Gemini model (stored in WatermelonDB settings table).
 * value: string.
 */
export const GOOGLE_GEMINI_MODEL_SETTING_TYPE = 'google_gemini_model';

/**
 * Setting type for OpenAI API key (stored in WatermelonDB settings table).
 * value: string.
 */
export const OPENAI_API_KEY_SETTING_TYPE = 'openai_api_key';

/**
 * Setting type for OpenAI model (stored in WatermelonDB settings table).
 * value: string.
 */
export const OPENAI_MODEL_SETTING_TYPE = 'openai_model';

/**
 * Setting type for enabling Google Gemini (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const ENABLE_GOOGLE_GEMINI_SETTING_TYPE = 'enable_google_gemini';

/**
 * Setting type for enabling OpenAI (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const ENABLE_OPENAI_SETTING_TYPE = 'enable_openai';

/**
 * Setting type for enabling Local LLM (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const ENABLE_LOCAL_LLM_SETTING_TYPE = 'enable_local_llm';

/**
 * Setting type for Local LLM base URL (stored in WatermelonDB settings table).
 * value: string.
 */
export const LOCAL_LLM_BASE_URL_SETTING_TYPE = 'local_llm_base_url';

/**
 * Setting type for Local LLM model (stored in WatermelonDB settings table).
 * value: string.
 */
export const LOCAL_LLM_MODEL_SETTING_TYPE = 'local_llm_model';

/**
 * Setting type for Local LLM API key (stored in WatermelonDB settings table).
 * value: string.
 */
export const LOCAL_LLM_API_KEY_SETTING_TYPE = 'local_llm_api_key';

/**
 * Setting type for daily nutrition insights (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const DAILY_NUTRITION_INSIGHTS_SETTING_TYPE = 'daily_nutrition_insights';

/**
 * Setting type for workout insights (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const WORKOUT_INSIGHTS_SETTING_TYPE = 'workout_insights';

/**
 * Setting type for notifications (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_SETTING_TYPE = 'notifications';

/**
 * Setting type for workout reminders (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE = 'notifications_workout_reminders';

/**
 * Setting type for active workout persistent notification (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE = 'notifications_active_workout';

/**
 * Setting type for daily nutrition overview notification (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE = 'notifications_nutrition_overview';

/**
 * Setting type for menstrual cycle notifications (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE = 'notifications_menstrual_cycle';

/**
 * Setting type for rest timer alert notification (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_REST_TIMER_SETTING_TYPE = 'notifications_rest_timer';

/**
 * Setting type for workout duration warning notification (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE = 'notifications_workout_duration';

/** One JSON blob (`NotificationPreferences`, utils/notificationPolicy.ts): quiet hours, pause, lead time, nudges. */
export const NOTIFICATION_PREFERENCES_SETTING_TYPE = 'notification_preferences';

export const CONVERSATION_CONTEXT = 'conversation_context';

/**
 * Setting type for language preference (stored in WatermelonDB settings table).
 * value: string (language code like 'en-US').
 */
export const LANGUAGE_SETTING_TYPE = 'language';

/**
 * Setting type for using OCR before sending images to AI (stored in WatermelonDB settings table).
 * When enabled, images are processed locally via OCR and the resulting text is sent to the AI
 * instead of the raw image. value: 'true' | 'false'.
 */
export const USE_OCR_BEFORE_AI_SETTING_TYPE = 'use_ocr_before_ai';

/**
 * Setting type for sending foundation foods to AI (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE = 'send_foundation_foods_to_llm';

/**
 * Setting types for customizable navigation bar slots (positions 2, 4, 5).
 * value: NavItemKey string.
 */
export const NAV_SLOT_1_SETTING_TYPE = 'nav_slot_1';
export const NAV_SLOT_2_SETTING_TYPE = 'nav_slot_2';
export const NAV_SLOT_3_SETTING_TYPE = 'nav_slot_3';

/**
 * Setting type for food search source preference.
 * value: 'both' | 'openfood' | 'usda'.
 */
export const FOOD_SEARCH_SOURCE_SETTING_TYPE = 'food_search_source';

/**
 * Setting type for whether the manual food-entry "carbs" field already includes fiber (total carbs,
 * US/FDA label convention) or excludes it (net carbs, EU label convention). The app always stores
 * total carbs, so when this is false the entered value is converted to total (carbs + fiber).
 * value: 'true' (includes fiber) | 'false' (excludes fiber).
 * Seeded from units in prod.ts: imperial → true (US labels), metric → false (EU labels).
 */
export const INCLUDE_FIBER_IN_CARBS_SETTING_TYPE = 'include_fiber_in_carbs';

/**
 * Setting type for chart tooltip position preference.
 * value: 'left' | 'right'.
 */
export const CHART_TOOLTIP_POSITION_SETTING_TYPE = 'chart_tooltip_position';

/**
 * Setting type for maximum AI memories (stored in WatermelonDB settings table).
 * value: string (number as string, e.g., '50').
 */
export const MAX_AI_MEMORIES_SETTING_TYPE = 'max_ai_memories';

/**
 * Setting type for enabling AI thinking mode.
 * value: 'true' | 'false'.
 */
export const USE_THINKING_MODE_SETTING_TYPE = 'use_thinking_mode';

/**
 * Setting type for generating WitMotion chart payloads.
 * value: 'true' | 'false'.
 */
export const BLE_GENERATE_CHART_PAYLOAD_SETTING_TYPE = 'ble_generate_chart_payload';

/**
 * Setting type for showing the daily mood prompt on the home screen.
 * value: 'true' | 'false'.
 */
export const SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE = 'show_daily_mood_prompt';

/**
 * Setting type for showing the daily water prompt on the home screen.
 * value: 'true' | 'false'.
 */
export const SHOW_DAILY_WATER_PROMPT_SETTING_TYPE = 'show_daily_water_prompt';

/**
 * Setting type for showing the daily supplement prompt on the home screen.
 * value: 'true' | 'false'.
 */
export const SHOW_DAILY_SUPPLEMENT_PROMPT_SETTING_TYPE = 'show_daily_supplement_prompt';

/**
 * Setting type for showing the steps and energy balance line on the home screen.
 * value: 'true' | 'false'.
 */
export const SHOW_HOME_STEPS_SETTING_TYPE = 'show_home_steps';

/**
 * Stores the local-day start timestamp for the last answered home water prompt.
 * value: stringified local midnight timestamp in ms.
 */
export const LAST_HOME_WATER_PROMPT_ANSWERED_DAY_SETTING_TYPE =
  'last_home_water_prompt_answered_day';

/**
 * Setting type for always allowing food editing in FoodMealTrackingDetailsModal.
 * value: 'true' | 'false'.
 */
export const ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE = 'always_allow_food_editing';

/**
 * Setting type for showing the predicted weight card on the profile screen.
 * value: 'true' | 'false'.
 */
export const SHOW_WEIGHT_PREDICTION_SETTING_TYPE = 'show_weight_prediction';

/**
 * Setting type for requiring an encryption phrase when exporting database.
 * value: 'true' | 'false'.
 */
export const REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE = 'require_export_encryption';

/**
 * Setting type for disabling the minimum calorie floor in nutrition calculations.
 * When enabled, calorie targets are allowed to go below the default gender/BMR floor.
 * value: 'true' | 'false'.
 */
export const DISABLE_MINIMUM_CALORIES_SETTING_TYPE = 'disable_minimum_calories';

/**
 * Setting type for using body fat percentage in nutrition calculations.
 * value: 'true' | 'false'.
 */
export const USE_BF_FOR_CALCULATIONS_SETTING_TYPE = 'use_bf_for_calculations';

/**
 * Setting type for intuitive eating mode.
 * When enabled, the daily summary card hides consumed amounts and shows '??' instead.
 * value: 'true' | 'false'.
 */
export const INTUITIVE_EATING_MODE_SETTING_TYPE = 'intuitive_eating_mode';

/**
 * Setting type for the fasting-day feature.
 * When enabled, the user can mark days they ate nothing as fasting days. Flagged days count
 * as a real 0-calorie day in historical averages (TDEE, weekly summaries, check-ins, streaks),
 * while unflagged empty days are skipped so a forgotten log doesn't lower the user's stats.
 * value: 'true' | 'false'. Default: 'false'.
 */
export const ENABLE_FASTED_DAY_SETTING_TYPE = 'enable_fasted_day';

/** Cycle tracking preferences. Predictions default on; fertility estimates default OFF (opt-in). */
export const CYCLE_SHOW_PREDICTIONS_SETTING_TYPE = 'cycle_show_predictions';
export const CYCLE_SHOW_FERTILITY_SETTING_TYPE = 'cycle_show_fertility';
/** 'discreet' (default): reminders never say what they are about. 'detailed': they do. */
export const CYCLE_NOTIFICATION_STYLE_SETTING_TYPE = 'cycle_notification_style';
/** Comma-separated symptom keys pinned to the one-tap quick log. Parsed by `parseQuickLog`. */
export const CYCLE_QUICK_LOG_SETTING_TYPE = 'cycle_quick_log';
/** Symptoms the user was already offered a pin for, so a suggestion is made once. */
export const CYCLE_PIN_SUGGESTED_SETTING_TYPE = 'cycle_pin_suggested';
/** Set when the user answers the "cycles vary a lot" card, so it is asked once. */
export const CYCLE_VARIABILITY_HINT_SETTING_TYPE = 'cycle_variability_hint_dismissed';
/** 'off' | 'cycle' (cycle area only) | 'app' (whole app). */
export const APP_LOCK_MODE_SETTING_TYPE = 'app_lock_mode';

/**
 * Setting type for smart double progression preference.
 * value: 'reps_first' | 'weight_first'.
 */
export const PROGRESSION_MODE_SETTING_TYPE = 'progression_mode';

/**
 * Setting type for the gym profile the user is training in (`gyms.id`), or '' for none.
 * Drives the plate calculator, the +/- load steps and which exercises may be suggested. Kept as a
 * primitive string so `SettingsState` stays primitive-only; the profile itself lives in `gyms`.
 */
export const ACTIVE_GYM_ID_SETTING_TYPE = 'active_gym_id';

/** Setting type for how much of a started workout's numbers the app decides. value: 'manual' | 'suggest'. */
export const WORKOUT_AUTONOMY_SETTING_TYPE = 'workout_autonomy';

/**
 * Setting type: start the rest timer on its own after a set is completed or skipped.
 * value: 'true' | 'false'. Defaults to true — the long-standing behavior. When off, the session
 * stays where it is and offers a "Start rest" button instead.
 */
export const AUTO_START_REST_TIMER_SETTING_TYPE = 'auto_start_rest_timer';

/**
 * Setting type: haptic countdown (a tick for the last three seconds and a buzz at zero) on the
 * rest timer. value: 'true' | 'false'. Defaults to true; a no-op on web.
 */
export const REST_TIMER_HAPTICS_SETTING_TYPE = 'rest_timer_haptics';

/**
 * Setting type: rest, in whole seconds, after a set that names none of its own.
 * value: stringified integer within `MIN_REST_SECONDS`..`MAX_REST_SECONDS`.
 */
export const DEFAULT_REST_SECONDS_SETTING_TYPE = 'default_rest_seconds';

/**
 * Setting type for enabling advanced data management.
 * Gated behind a confirmation + biometric auth to prevent accidental data loss.
 * value: 'true' | 'false'.
 */
export const ADVANCED_DATA_MANAGEMENT_SETTING_TYPE = 'advanced_data_management';

/**
 * Setting type for which macros to display in the nutrition summary.
 * Binary string of length 5: positions 0-4 map to carbs, protein, fats, fiber, alcohol.
 * '1' = visible, '0' = hidden. Default: '11111' (all visible).
 * Example: '10100' = only carbs and fats visible.
 */
export const NUTRITION_DISPLAY_SETTING_TYPE = 'nutrition_display';

/**
 * Setting type for preferring on-device AI when available.
 * value: 'true' | 'false'.
 */
export const USE_ON_DEVICE_AI_SETTING_TYPE = 'use_on_device_ai';

/**
 * Setting type for how many days of nutrition log history to send to the LLM.
 * value: 'none' | '7' | '30' | '60' | '90'.
 */
export const NUTRITION_LOG_HISTORY_DAYS_SETTING_TYPE = 'nutrition_log_history_days';

/**
 * Setting type for how many days of workout history to send to the LLM.
 * value: 'none' | '7' | '30' | '60' | '90'.
 */
export const WORKOUT_HISTORY_DAYS_SETTING_TYPE = 'workout_history_days';

/**
 * Setting type for which summary card to show on the home screen.
 * value: 'daily_summary' | 'weekly_streak'. Default: 'daily_summary'.
 */
export const HOME_SUMMARY_CARD_SETTING_TYPE = 'home_summary_card';

/**
 * Setting type for which quick actions the home screen shows.
 * value: JSON array of `HomeActionKey`, at most `MAX_HOME_ACTIONS` entries.
 * Parse it with `parseHomeActions` from `@/constants/homeActions`.
 */
export const HOME_ACTIONS_SETTING_TYPE = 'home_actions';

export const USE_MUSCLOG_FREE_TIER_SETTING_TYPE = 'use_musclog_free_tier';
export const MUSCLOG_GATEWAY_ANONYMOUS_ID_SETTING_TYPE = 'musclog_gateway_anonymous_id';
export const DUMP_LLM_REQUESTS_SETTING_TYPE = 'dump_llm_requests';

/**
 * Every navigation-slot destination, in the order the visual-settings picker lists them.
 *
 * `NavItemKey` is derived from this array rather than declared next to it so that adding a
 * destination updates the type *and* every list that enumerates destinations. A separate
 * `NavItemKey[]` literal is not checked against the union and silently goes stale — which is
 * exactly what a `Record<NavItemKey, …>` map (compiler-enforced) does not do.
 */
export const NAV_ITEM_KEYS = [
  'workouts',
  'food',
  'profile',
  'coach',
  'cycle',
  'settings',
  'progress',
  'checkin',
  'notes',
] as const;

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number];

/**
 * A list that must mention every navigation destination — for the surfaces that show all of them
 * in an order of their own (the account menu leads with the account, not with `workouts`). The
 * length constraint is what a bare `NavItemKey[]` lacks: adding a key to `NAV_ITEM_KEYS` without
 * placing it in such a list becomes a build error instead of a destination that quietly vanishes
 * from that surface. Use it with `satisfies`, so the literal keeps its narrow tuple type.
 */
export type NavItemKeyList = readonly NavItemKey[] & { length: (typeof NAV_ITEM_KEYS)['length'] };

export type Units = 'metric' | 'imperial';
export type ThemeId = keyof typeof THEME_DEFINITIONS;
export const THEME_IDS = REGISTRY_THEME_IDS as readonly ThemeId[];
// Reading and normalizing the stored value lives in `utils/themeSelection`.
export type ThemeOption = 'system' | ThemeId;
export type ProgressionMode = 'reps_first' | 'weight_first';

/**
 * How much of the numbers for a workout the app decides when it starts:
 *  - `manual`  — the plan's weights and reps are copied exactly, as they always were;
 *  - `suggest` — each exercise starts from how its last session went (more load, more reps, a
 *    deload, or a repeat), says so, and offers a one-tap way back.
 * A later `adaptive` level would rewrite the plan itself; it does not exist yet.
 */
export type WorkoutAutonomy = 'manual' | 'suggest';

export const DEFAULT_WORKOUT_AUTONOMY: WorkoutAutonomy = 'suggest';

/** Reads a stored autonomy, treating anything unrecognized (e.g. from a newer build) as the default. */
export function parseWorkoutAutonomy(raw: string | null | undefined): WorkoutAutonomy {
  return raw === 'manual' || raw === 'suggest' ? raw : DEFAULT_WORKOUT_AUTONOMY;
}

export type FoodSearchSource = 'both' | 'openfood' | 'usda' | 'musclog' | 'none';
export type FoodSource = 'user' | 'usda' | 'ai' | 'openfood' | 'foundation' | 'musclog';
export type ChartTooltipPosition = 'left' | 'right';
export type NutritionLogHistoryDays = 'none' | '7' | '30' | '60' | '90';
export type WorkoutHistoryDays = 'none' | '7' | '30' | '60' | '90';
export type HomeSummaryCard = 'daily_summary' | 'weekly_streak';
/**
 * What a cycle reminder shows on the lock screen. `discreet` (stored name kept for existing
 * installs; shown as "Private") never says what it is about; `subtle` names the task but never
 * periods, fertility or pills; `detailed` says it plainly.
 */
export type CycleNotificationStyle = 'discreet' | 'subtle' | 'detailed';
export const CYCLE_NOTIFICATION_STYLES: readonly CycleNotificationStyle[] = [
  'discreet',
  'subtle',
  'detailed',
];

/** The one parse of the stored value (service and context alike); anything unknown is private. */
export function parseCycleNotificationStyle(
  raw: string | null | undefined
): CycleNotificationStyle {
  return CYCLE_NOTIFICATION_STYLES.find((style) => style === raw) ?? 'discreet';
}

export type AppLockMode = 'off' | 'cycle' | 'app';

export type UseSettingsResult = {
  units: Units;
  isLoading: boolean;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
  notificationsWorkoutReminders: boolean;
  notificationsActiveWorkout: boolean;
  notificationsNutritionOverview: boolean;
  notificationsMenstrualCycle: boolean;
  notificationsRestTimer: boolean;
  notificationsWorkoutDuration: boolean;
  foodSearchSource: FoodSearchSource;
  chartTooltipPosition: ChartTooltipPosition;
  alwaysAllowFoodEditing: boolean;
  showWeightPrediction: boolean;
  useThinkingMode: boolean;
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
  appLockMode: AppLockMode;
  progressionMode: ProgressionMode;
  /** 5-char binary string: positions 0-4 = carbs, protein, fats, fiber, alcohol. '1'=visible. */
  nutritionDisplay: string;
  nutritionLogHistoryDays: NutritionLogHistoryDays;
  workoutHistoryDays: WorkoutHistoryDays;
  homeSummaryCard: HomeSummaryCard;
  showHomeSteps: boolean;
};

export function parseAppLockMode(raw: string | undefined | null): AppLockMode {
  return raw === 'cycle' || raw === 'app' ? raw : 'off';
}
