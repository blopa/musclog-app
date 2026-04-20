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
    // Version 11: Add target_muscles_json to exercises for detailed per-muscle targeting
    migrationV11,
  ],
});
