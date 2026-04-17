/**
 * Setting type for units preference (stored in WatermelonDB settings table).
 * value: '0' = metric, '1' = imperial.
 */
export const UNITS_SETTING_TYPE = 'unit_system';

/**
 * Setting type for theme preference (stored in WatermelonDB settings table).
 * value: 'system' | 'light' | 'dark'.
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
 * Setting type for showing the daily mood prompt on the home screen.
 * value: 'true' | 'false'.
 */
export const SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE = 'show_daily_mood_prompt';

/**
 * Setting type for always allowing food editing in FoodMealDetailsModal.
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
 * Setting type for intuitive eating mode.
 * When enabled, the daily summary card hides consumed amounts and shows '??' instead.
 * value: 'true' | 'false'.
 */
export const INTUITIVE_EATING_MODE_SETTING_TYPE = 'intuitive_eating_mode';

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

export type NavItemKey =
  | 'workouts'
  | 'food'
  | 'profile'
  | 'coach'
  | 'cycle'
  | 'settings'
  | 'progress'
  | 'checkin';

export type Units = 'metric' | 'imperial';
export type ThemeOption = 'system' | 'light' | 'dark';
export type FoodSearchSource = 'both' | 'openfood' | 'usda' | 'musclog' | 'none';
export type FoodSource = 'user' | 'usda' | 'ai' | 'openfood' | 'foundation' | 'musclog';
export type ChartTooltipPosition = 'left' | 'right';

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
  requireExportEncryption: boolean;
  intuitiveEatingMode: boolean;
  /** 5-char binary string: positions 0-4 = carbs, protein, fats, fiber, alcohol. '1'=visible. */
  nutritionDisplay: string;
};
