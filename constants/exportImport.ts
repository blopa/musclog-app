import { CYCLE_BACKUP_STATUS_KEY } from '@/constants/cycle';
import { ENCRYPTION_KEY } from '@/constants/database';
import {
  AI_ONBOARDING_DRAFT,
  COACH_REPLY_JOURNAL,
  COACH_RESTORED_COMPOSER,
  PERSONALIZED_BODY_DRAFT,
  SETTINGS_MIRROR_STORAGE_KEY,
  TEMP_NUTRITION_PLAN,
} from '@/constants/misc';
import {
  CLAUDE_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
} from '@/constants/settings';

/** AsyncStorage keys that must not be included in the backup (device-specific or session-only). */
export const ASYNC_STORAGE_EXCLUDED_KEYS = new Set([
  ENCRYPTION_KEY,
  TEMP_NUTRITION_PLAN,
  CYCLE_BACKUP_STATUS_KEY,
  // Rebuilt from the restored settings table; a carried-over copy could claim no lock is on.
  SETTINGS_MIRROR_STORAGE_KEY,
  // Encrypted with this device's key, so another install could not read them anyway, and an
  // unfinished onboarding conversation is not part of anyone's data.
  AI_ONBOARDING_DRAFT,
  PERSONALIZED_BODY_DRAFT,
  // A reply that was mid-stream, and a message waiting to be put back in the composer: both are
  // moments of one session, not data.
  COACH_REPLY_JOURNAL,
  COACH_RESTORED_COMPOSER,
]);

export const WEB_BACKUP_DATA_PREFIX = 'musclog_backup_data_';

/**
 * Web recovery-point bookkeeping. On web `AsyncStorage` is `window.localStorage`, so these
 * live in the same namespace as ordinary app state even though they are not app state — they
 * are the backups the user restores *from*. Every wipe path must skip them, or restoring a
 * backup deletes the safety net it just created (see `database/asyncStorageReset.ts`).
 */
export const WEB_BACKUP_INDEX_KEY = 'musclog_pre_migration_backups_v1';
export const WEB_BACKUP_DB_VERSION_KEY = 'musclog_last_db_version';

/** True for any key that stores a web recovery point or its bookkeeping. */
export function isWebBackupStorageKey(key: string): boolean {
  return (
    key === WEB_BACKUP_INDEX_KEY ||
    key === WEB_BACKUP_DB_VERSION_KEY ||
    key.startsWith(WEB_BACKUP_DATA_PREFIX)
  );
}

/**
 * AsyncStorage key prefixes that must not be included in the backup.
 *
 * `captureAsyncStorageDump` uses `isWebBackupStorageKey` instead, which also covers the
 * index and the version marker; this list stays only for callers that genuinely need the
 * prefix itself.
 */
export const ASYNC_STORAGE_EXCLUDED_PREFIXES = [WEB_BACKUP_DATA_PREFIX];

/** Table names in dependency order for restore (parents before children). */
export const RESTORE_ORDER: string[] = [
  // Independent master tables
  'muscles',
  'exercises',
  'users',
  'foods',
  'food_portions',
  'supplements',
  'ble_devices',
  'gyms',
  'meals',
  'workout_templates',
  'workout_plans',
  'settings',
  'debug_dump',

  // Template-dependent tables
  'schedules',
  'workout_plan_templates',
  'workout_template_exercises',
  'workout_template_sets',

  // Exercise junction tables
  'exercise_muscles',
  'exercise_aliases',
  'exercise_restrictions',
  'exercise_user_settings',

  // Food/Meal junction tables
  'food_food_portions',
  'meal_food_portions',
  'meal_foods',

  // Goal and tracking tables
  'nutrition_goals',
  'weekly_reviews',
  'nutrition_target_periods',
  'nutrition_checkins',
  'exercise_goals',
  'menstrual_cycles',
  'cycle_periods',
  'cycle_day_logs',
  'cycle_contexts',

  // Log tables (depend on templates and master data)
  'workout_logs',
  'workout_log_exercises',
  'workout_log_sets',
  'nutrition_logs',
  'fasted_days',
  'period_logs',
  'user_metrics',
  'user_metrics_notes',

  // Chat messages (independent)
  'chat_messages',

  // AI custom prompts (independent)
  'ai_custom_prompts',

  // Saved for later (independent)
  'saved_for_later_groups',
  'saved_for_later_items',

  // Scratchpad notes (independent)
  'notes',
];

export const SETTINGS_EXCLUDED_TYPES = [
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  CLAUDE_API_KEY_SETTING_TYPE,
];
