import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

import migrationV2 from '@/database/migrations/2026/04/migration-v2';
import migrationV3 from '@/database/migrations/2026/04/migration-v3';
import migrationV4 from '@/database/migrations/2026/04/migration-v4';
import migrationV5 from '@/database/migrations/2026/04/migration-v5';
import migrationV6 from '@/database/migrations/2026/04/migration-v6';
import migrationV7 from '@/database/migrations/2026/04/migration-v7';
import migrationV8 from '@/database/migrations/2026/04/migration-v8';
import migrationV9 from '@/database/migrations/2026/04/migration-v9';
import migrationV10 from '@/database/migrations/2026/04/migration-v10';
import migrationV11 from '@/database/migrations/2026/04/migration-v11';
import migrationV12 from '@/database/migrations/2026/04/migration-v12';
import migrationV13 from '@/database/migrations/2026/04/migration-v13';
import migrationV14 from '@/database/migrations/2026/04/migration-v14';
import migrationV15 from '@/database/migrations/2026/05/migration-v15';
import migrationV16 from '@/database/migrations/2026/05/migration-v16';
import migrationV17 from '@/database/migrations/2026/05/migration-v17';
import migrationV18 from '@/database/migrations/2026/05/migration-v18';
import migrationV19 from '@/database/migrations/2026/05/migration-v19';
import migrationV20 from '@/database/migrations/2026/06/migration-v20';
import migrationV21 from '@/database/migrations/2026/06/migration-v21';
import migrationV22 from '@/database/migrations/2026/06/migration-v22';

export const migrations = schemaMigrations({
  migrations: [
    // Version 1: Initial schema
    // No migration needed as this is the initial version

    // Version 2: Add source column to exercises and backfill existing rows.
    // unsafeExecuteSql is ignored by the LokiJS adapter (web) — the JS fallback
    // in app/_layout.tsx covers that platform.
    migrationV2,

    // Version 3: Reset totalVolume for all existing workout logs.
    // The volume formula changed from simple reps×weight to average-1RM across
    // seven published formulas (accounting for RIR and bodyweight exercises).
    // Old values are ~7.5× smaller than new ones, so keeping them would produce
    // false trends in the volume chart. Resetting to NULL is safer: the trend
    // chart already filters out null-volume workouts, so old sessions simply
    // drop out of the chart rather than distorting it.
    migrationV3,

    // Version 4: Replace volume_calculation_type with workout_insights_type (per-template insights mode).
    // Also drop deprecated `food_portions.is_default` (unused; catalog vs user rows use `source`).
    migrationV4,

    // Version 5: Add prepared_weight_grams to meals.
    // Lets users record the cooked/finished weight of a recipe (e.g. 500g after
    // cooking 800g of raw ingredients). Used as the reference for portion scaling
    // (½×, 1×, …) instead of the raw ingredient sum when set.
    migrationV5,

    // Version 6: Add group_id and logged_meal_name to nutrition_logs.
    // Allows multiple nutrition log rows (e.g. AI meal ingredients or saved meal foods)
    // to be grouped and displayed as a single meal entry in the food diary.
    migrationV6,

    // Version 7: Replace locally-copied exercise image file:// URIs with GitHub
    // Also add order_index column to preserve JSON file ordering for app exercises
    migrationV7,

    // Version 8: Make target body-composition columns nullable and backfill
    // existing sentinel 0 values to NULL. Body fat, BMI, and FFMI can all be
    // unset, but the schema was missing isOptional so WatermelonDB sanitized
    // missing values to 0 on read/write.
    migrationV8,
    // Version 9: Clean up orphan meal_foods and food_food_portions that reference
    // deleted or missing foods/food_portions. Prevents WatermelonDB relation errors.
    migrationV9,
    // Version 10: Add saved_for_later_groups and saved_for_later_items tables
    migrationV10,
    // Version 11: Add muscles catalogue and exercise_muscles junction table
    migrationV11,
    // Version 12: Add debug_dump table for sanitized LLM request/response logs
    migrationV12,
    // Version 13: Add supplement reminders and supplement_id on user_metrics
    migrationV13,
    // Version 14: Add is_dynamic column to nutrition_goals
    migrationV14,
    // Version 15: Add private/custom named servings for foods and meals add optional notes to saved-for-later meals
    migrationV15,
    // Version 16: Replace is_drop_set boolean with set_type string on log/template sets; add nutriscore/ecoscore/nova_group/labels_json to foods
    migrationV16,
    // Version 17: Add ble_devices table for app-level BLE sensor management
    migrationV17,
    // Version 18: Reassign IDs of app-seeded exercises to sequential integers
    // ordered by created_at. Updates all referencing tables (exercise_goals,
    // exercise_muscles, workout_template_exercises, workout_log_exercises).
    migrationV18,
    // Version 19: Add rep counting columns to workout_log_sets (rep_data_json)
    migrationV19,
    // Version 20: Add timezone column to nutrition_logs and workout_logs.
    // Legacy user_metrics.timezone IANA values are converted to offset format by the
    // boot-time backfill UserMetricService.backfillTimezoneOffsets() (DST-aware, can't be SQL).
    // Legacy nutrition_logs null timezones are repaired by
    // TimezoneMigrationService.repairNullTimezoneNutritionLogs().
    migrationV20,
    // Version 21: Add timezone column to menstrual_cycles, nutrition_checkins,
    // saved_for_later_groups, nutrition_goals, and exercise_goals.
    // Null rows are filled by the boot-time backfill TimezoneMigrationService.backfillMissingTimezones().
    migrationV21,
    // Version 22: Add period_logs table and life_stage column to menstrual_cycles.
    // period_logs stores actual period start/end events so cycle length is calculated
    // from real history rather than a user-entered average. last_period_start_date on
    // menstrual_cycles becomes optional (kept as a cached denormalization).
    migrationV22,
  ],
});
