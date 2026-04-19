import { ENCRYPTION_KEY } from '@/constants/database';
import { TEMP_NUTRITION_PLAN } from '@/constants/misc';
import {
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
} from '@/constants/settings';

/** AsyncStorage keys that must not be included in the backup (device-specific or session-only). */
export const ASYNC_STORAGE_EXCLUDED_KEYS = new Set([ENCRYPTION_KEY, TEMP_NUTRITION_PLAN]);

/** Table names in dependency order for restore (parents before children). */
export const RESTORE_ORDER: string[] = [
  // Independent master tables
  'exercises',
  'users',
  'foods',
  'food_portions',
  'meals',
  'workout_templates',
  'settings',

  // Template-dependent tables
  'schedules',
  'workout_template_exercises',
  'workout_template_sets',

  // Food/Meal junction tables
  'food_food_portions',
  'meal_foods',

  // Goal and tracking tables
  'nutrition_goals',
  'nutrition_checkins',
  'exercise_goals',
  'menstrual_cycles',

  // Log tables (depend on templates and master data)
  'workout_logs',
  'workout_log_exercises',
  'workout_log_sets',
  'nutrition_logs',
  'user_metrics',
  'user_metrics_notes',

  // Chat messages (independent)
  'chat_messages',

  // AI custom prompts (independent)
  'ai_custom_prompts',

  // Saved for later (independent)
  'saved_for_later_groups',
  'saved_for_later_items',
];

export const SETTINGS_EXCLUDED_TYPES = [
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
];
