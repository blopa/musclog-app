import {
  addColumns,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Version 1: Initial schema
    // No migration needed as this is the initial version

    // Version 2: Add source column to exercises and backfill existing rows.
    // unsafeExecuteSql is ignored by the LokiJS adapter (web) — the JS fallback
    // in app/_layout.tsx covers that platform.
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'exercises',
          columns: [{ name: 'source', type: 'string', isOptional: true }],
        }),
        // Default all existing exercises to 'user' first, then promote the
        // first 105 (oldest by created_at) to 'app' — those are the exercises
        // seeded from the bundled JSON during production seeding.
        unsafeExecuteSql(
          "UPDATE exercises SET source = 'user' WHERE source IS NULL OR source = '';"
        ),
        unsafeExecuteSql(
          "UPDATE exercises SET source = 'app' WHERE rowid IN (SELECT rowid FROM exercises ORDER BY created_at ASC LIMIT 105);"
        ),
      ],
    },

    // Version 3: Reset totalVolume for all existing workout logs.
    // The volume formula changed from simple reps×weight to average-1RM across
    // seven published formulas (accounting for RIR and bodyweight exercises).
    // Old values are ~7.5× smaller than new ones, so keeping them would produce
    // false trends in the volume chart. Resetting to NULL is safer: the trend
    // chart already filters out null-volume workouts, so old sessions simply
    // drop out of the chart rather than distorting it.
    {
      toVersion: 3,
      steps: [
        unsafeExecuteSql('UPDATE workout_logs SET total_volume = NULL;'),
        // Add source column to food_portions and backfill existing rows.
        // unsafeExecuteSql is ignored by the LokiJS adapter (web) — the JS fallback
        // in app/_layout.tsx covers that platform.
        addColumns({
          table: 'food_portions',
          columns: [{ name: 'source', type: 'string', isOptional: true }],
        }),
        unsafeExecuteSql(
          "UPDATE food_portions SET source = 'user' WHERE source IS NULL OR source = '';"
        ),
        // The first 9 portions (oldest by created_at) are always the common app-seeded portions
        // from createCommonPortions() in prod.ts (10 entries but 50g is deduplicated → 9 unique rows).
        unsafeExecuteSql(
          "UPDATE food_portions SET source = 'app' WHERE rowid IN (SELECT rowid FROM food_portions ORDER BY created_at ASC LIMIT 9);"
        ),
      ],
    },

    // Version 4: Replace volume_calculation_type with workout_insights_type (per-template insights mode).
    // Also drop deprecated `food_portions.is_default` (unused; catalog vs user rows use `source`).
    {
      toVersion: 4,
      steps: [
        unsafeExecuteSql('ALTER TABLE food_portions DROP COLUMN is_default;'),
        unsafeExecuteSql('ALTER TABLE workout_templates DROP COLUMN volume_calculation_type;'),
        addColumns({
          table: 'workout_templates',
          columns: [{ name: 'workout_insights_type', type: 'string', isOptional: true }],
        }),
      ],
    },

    // Version 5: Add prepared_weight_grams to meals.
    // Lets users record the cooked/finished weight of a recipe (e.g. 500g after
    // cooking 800g of raw ingredients). Used as the reference for portion scaling
    // (½×, 1×, …) instead of the raw ingredient sum when set.
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'meals',
          columns: [{ name: 'prepared_weight_grams', type: 'number', isOptional: true }],
        }),
      ],
    },

    // Version 6: Add group_id and logged_meal_name to nutrition_logs.
    // Allows multiple nutrition log rows (e.g. AI meal ingredients or saved meal foods)
    // to be grouped and displayed as a single meal entry in the food diary.
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'nutrition_logs',
          columns: [
            { name: 'group_id', type: 'string', isOptional: true },
            { name: 'logged_meal_name', type: 'string', isOptional: true },
          ],
        }),
      ],
    },

    // Version 7: Replace locally-copied exercise image file:// URIs with GitHub
    // Also add order_index column to preserve JSON file ordering for app exercises
    {
      toVersion: 7,
      steps: [
        // Add order_index column to exercises table
        addColumns({
          table: 'exercises',
          columns: [{ name: 'order_index', type: 'number', isOptional: true }],
        }),
        // Old DB stores filenames as bare numbers: "1.png", "2.png", etc.
        // New URL format: .../refs/tags/2.5.15/assets/exercises/exercise1.png
        // SUBSTR(..., INSTR(..., '/exercises/') + 11) extracts "1.png"; prepend "exercise".
        unsafeExecuteSql(
          "UPDATE exercises SET image_url = 'https://raw.githubusercontent.com/blopa/musclog-app/refs/tags/2.5.15/assets/exercises/exercise' || SUBSTR(image_url, INSTR(image_url, '/exercises/') + 11) WHERE source = 'app' AND image_url LIKE 'file://%/exercises/%.png' AND image_url NOT LIKE '%/exercises/fallback.png';"
        ),
        unsafeExecuteSql(
          "UPDATE exercises SET image_url = NULL WHERE source = 'app' AND image_url LIKE '%/exercises/fallback.png';"
        ),
      ],
    },

    // Version 8: Make target body-composition columns nullable and backfill
    // existing sentinel 0 values to NULL. Body fat, BMI, and FFMI can all be
    // unset, but the schema was missing isOptional so WatermelonDB sanitized
    // missing values to 0 on read/write.
    {
      toVersion: 8,
      steps: [
        unsafeExecuteSql(
          'UPDATE nutrition_goals SET target_body_fat = NULL WHERE target_body_fat = 0;'
        ),
        unsafeExecuteSql('UPDATE nutrition_goals SET target_bmi = NULL WHERE target_bmi = 0;'),
        unsafeExecuteSql('UPDATE nutrition_goals SET target_ffmi = NULL WHERE target_ffmi = 0;'),
        unsafeExecuteSql(
          'UPDATE nutrition_checkins SET target_body_fat = NULL WHERE target_body_fat = 0;'
        ),
        unsafeExecuteSql('UPDATE nutrition_checkins SET target_bmi = NULL WHERE target_bmi = 0;'),
        unsafeExecuteSql('UPDATE nutrition_checkins SET target_ffmi = NULL WHERE target_ffmi = 0;'),
        createTable({
          name: 'exercise_goals',
          columns: [
            { name: 'exercise_id', type: 'string', isOptional: true },
            { name: 'exercise_name_snapshot', type: 'string', isOptional: true },
            { name: 'goal_type', type: 'string' },
            { name: 'target_weight', type: 'number', isOptional: true },
            { name: 'baseline_1rm', type: 'number', isOptional: true },
            { name: 'target_sessions_per_week', type: 'number', isOptional: true },
            { name: 'target_steps_per_day', type: 'number', isOptional: true },
            { name: 'target_distance_m', type: 'number', isOptional: true },
            { name: 'target_duration_s', type: 'number', isOptional: true },
            { name: 'target_pace_ms_per_m', type: 'number', isOptional: true },
            { name: 'target_date', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'effective_until', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        unsafeExecuteSql(
          'CREATE INDEX IF NOT EXISTS exercise_goals_exercise_id ON exercise_goals(exercise_id);'
        ),
        unsafeExecuteSql(
          'CREATE INDEX IF NOT EXISTS exercise_goals_goal_type ON exercise_goals(goal_type);'
        ),
      ],
    },
    {
      toVersion: 9,
      steps: [
        // Clean up orphan meal_foods and food_food_portions that reference
        // deleted or missing foods/food_portions. Prevents WatermelonDB relation errors.
        // meal_foods: soft-delete rows with invalid food_id (null, empty, soft-deleted, or missing)
        unsafeExecuteSql(
          "UPDATE meal_foods SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_id IS NULL OR food_id = '' OR food_id IN (SELECT id FROM foods WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM foods WHERE foods.id = meal_foods.food_id));"
        ),
        // meal_foods: soft-delete rows with invalid portion_id (empty, soft-deleted, or missing)
        unsafeExecuteSql(
          "UPDATE meal_foods SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND portion_id IS NOT NULL AND (portion_id = '' OR portion_id IN (SELECT id FROM food_portions WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM food_portions WHERE food_portions.id = meal_foods.portion_id));"
        ),
        // food_food_portions: soft-delete rows with invalid food_id
        unsafeExecuteSql(
          "UPDATE food_food_portions SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_id IS NULL OR food_id = '' OR food_id IN (SELECT id FROM foods WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM foods WHERE foods.id = food_food_portions.food_id));"
        ),
        // food_food_portions: soft-delete rows with invalid food_portion_id
        unsafeExecuteSql(
          "UPDATE food_food_portions SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_portion_id IS NULL OR food_portion_id = '' OR food_portion_id IN (SELECT id FROM food_portions WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM food_portions WHERE food_portions.id = food_food_portions.food_portion_id));"
        ),
      ],
    },
    {
      toVersion: 10,
      steps: [
        createTable({
          name: 'saved_for_later_groups',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'original_meal_type', type: 'string' },
            { name: 'original_date', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'saved_for_later_items',
          columns: [
            { name: 'group_id', type: 'string', isIndexed: true },
            { name: 'food_id', type: 'string', isOptional: true },
            { name: 'amount', type: 'number' },
            { name: 'portion_id', type: 'string', isOptional: true },
            { name: 'logged_food_name', type: 'string', isOptional: true },
            { name: 'logged_calories', type: 'string' },
            { name: 'logged_protein', type: 'string' },
            { name: 'logged_carbs', type: 'string' },
            { name: 'logged_fat', type: 'string' },
            { name: 'logged_fiber', type: 'string' },
            { name: 'logged_micros_json', type: 'string', isOptional: true },
            { name: 'logged_meal_name', type: 'string', isOptional: true },
            { name: 'original_group_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
