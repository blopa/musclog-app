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

export type Units = 'metric' | 'imperial';
export type ThemeOption = 'system' | 'light' | 'dark';

export type UseSettingsResult = {
  units: Units;
  isLoading: boolean;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
};
