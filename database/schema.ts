import { appSchema, tableSchema } from '@nozbe/watermelondb';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';

export const schema = appSchema({
  // when updating database schema, also update export version in exportImport.ts
  version: CURRENT_DATABASE_VERSION,
  tables: [
    // 1. Master List of Exercises
    tableSchema({
      name: 'exercises',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'muscle_group', type: 'string', isIndexed: true },
        { name: 'equipment_type', type: 'string', isIndexed: true }, // Dumbbell, Barbell, Bodyweight
        { name: 'mechanic_type', type: 'string' }, // 'compound' or 'isolation'
        { name: 'source', type: 'string', isOptional: true }, // 'app' or 'user'
        { name: 'load_multiplier', type: 'number' }, // Load multiplier for volume calculations
        { name: 'order_index', type: 'number', isOptional: true }, // JSON order for app exercises
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Exercise goals: snapshot per row; current = effective_until IS NULL
    tableSchema({
      name: 'exercise_goals',
      columns: [
        // Exercise reference (for 1rm goals)
        { name: 'exercise_id', type: 'string', isOptional: true, isIndexed: true },
        // Denormalised name — survives exercise rename/soft-delete
        { name: 'exercise_name_snapshot', type: 'string', isOptional: true },

        // Goal classification
        { name: 'goal_type', type: 'string', isIndexed: true },
        // '1rm' | 'consistency' | 'steps_per_day' | 'distance_per_session' | 'pace' | 'duration'

        // --- 1RM / Strength fields ---
        { name: 'target_weight', type: 'number', isOptional: true }, // kg (metric always)
        // Baseline 1RM at goal creation — used for progress % and regression anchor
        { name: 'baseline_1rm', type: 'number', isOptional: true }, // kg

        // --- Consistency fields ---
        { name: 'target_sessions_per_week', type: 'number', isOptional: true },

        // --- Future cardio fields (TBA) ---
        { name: 'target_steps_per_day', type: 'number', isOptional: true },
        { name: 'target_distance_m', type: 'number', isOptional: true }, // metres
        { name: 'target_duration_s', type: 'number', isOptional: true }, // seconds
        { name: 'target_pace_ms_per_m', type: 'number', isOptional: true }, // ms per metre

        // Shared
        { name: 'target_date', type: 'string', isOptional: true }, // ISO date string, user-overridable
        { name: 'notes', type: 'string', isOptional: true },

        // Snapshot-based history (same pattern as nutrition_goals)
        { name: 'effective_until', type: 'number', isOptional: true }, // null = currently active

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE BLUEPRINT: What the user "plans" to do
    tableSchema({
      name: 'workout_templates',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'workout_insights_type', type: 'string', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'type', type: 'string', isOptional: true },
        { name: 'week_days_json', type: 'string', isOptional: true },
        { name: 'is_archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // 3. Scheduling (Separated for flexibility)
    tableSchema({
      name: 'schedules',
      columns: [
        { name: 'template_id', type: 'string', isIndexed: true },
        { name: 'day_of_week', type: 'string' }, // e.g., 'Monday', 'Tuesday'
        { name: 'reminder_time', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE BLUEPRINT EXERCISES: Exercise blocks within a workout template
    // This intermediate entity allows the same exercise to appear multiple times
    // with different notes/configurations
    tableSchema({
      name: 'workout_template_exercises',
      columns: [
        { name: 'template_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'exercise_order', type: 'number' },
        { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE BLUEPRINT SETS: The default reps/weight for a routine
    tableSchema({
      name: 'workout_template_sets',
      columns: [
        { name: 'template_exercise_id', type: 'string', isIndexed: true },
        { name: 'target_reps', type: 'number' },
        { name: 'target_weight', type: 'number' },
        { name: 'rest_time_after', type: 'number', isOptional: true },
        { name: 'set_order', type: 'number' },
        { name: 'is_drop_set', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE HISTORY: The actual session performed
    tableSchema({
      name: 'workout_logs',
      columns: [
        { name: 'template_id', type: 'string', isIndexed: true }, // Optional link to blueprint
        { name: 'external_id', type: 'string', isOptional: true, isIndexed: true }, // ID from external data integrations (e.g. Health Connect) for sync deduplication
        { name: 'workout_name', type: 'string' }, // We save the name here so it's permanent
        { name: 'started_at', type: 'number', isIndexed: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'total_volume', type: 'number', isOptional: true },
        { name: 'calories_burned', type: 'number', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'type', type: 'string', isOptional: true },
        { name: 'exhaustion_level', type: 'number' },
        { name: 'workout_score', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE HISTORY EXERCISES: Exercise blocks within a logged workout session
    tableSchema({
      name: 'workout_log_exercises',
      columns: [
        { name: 'workout_log_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'template_exercise_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'exercise_order', type: 'number' },
        { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE HISTORY SETS: What actually happened
    tableSchema({
      name: 'workout_log_sets',
      columns: [
        { name: 'log_exercise_id', type: 'string', isIndexed: true }, // Link to the log exercise block
        { name: 'reps', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'partials', type: 'number', isOptional: true }, // Partial reps (defaults to 0)
        { name: 'rest_time_after', type: 'number' },
        { name: 'reps_in_reserve', type: 'number' },
        { name: 'is_skipped', type: 'boolean', isOptional: true },
        { name: 'difficulty_level', type: 'number' }, // 1-10 (RPE)
        { name: 'is_drop_set', type: 'boolean' },
        { name: 'set_order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Represents a food item with macros per 100g standard
    tableSchema({
      name: 'foods',
      columns: [
        { name: 'is_ai_generated', type: 'boolean' },
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'brand', type: 'string', isOptional: true, isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'description', type: 'string', isOptional: true }, // Ingredients, allergens, etc. (from external sources or user input)

        // Macros per standard serving (usually 100g or 1 serving)
        { name: 'calories', type: 'number' },
        { name: 'protein', type: 'number' },
        { name: 'carbs', type: 'number' },
        { name: 'fat', type: 'number' },
        { name: 'fiber', type: 'number' },
        { name: 'external_id', type: 'string', isOptional: true, isIndexed: true }, // ID from external data integrations (e.g. USDA, Open Food Facts)

        // Extended data (Fiber, Sugar, Sodium, Vitamins, Alcohol, etc.) stored as JSON
        // Usage: @json decorator in the Model
        { name: 'micros_json', type: 'string', isOptional: true },

        { name: 'is_favorite', type: 'boolean' }, // Quick access
        { name: 'source', type: 'string', isOptional: true }, // 'user', 'usda', 'ai', 'openfood', 'foundation'
        { name: 'image_url', type: 'string', isOptional: true }, // URL to product image

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Global Food Portions (Reusable Serving Sizes)
    // These are generic portion definitions without food_id, reusable across all foods
    tableSchema({
      name: 'food_portions',
      columns: [
        { name: 'name', type: 'string' }, // e.g., "1 Cup", "1 Slice", "3 oz", "100g"
        { name: 'gram_weight', type: 'number' }, // How many grams is this portion?
        { name: 'icon', type: 'string', isOptional: true }, // e.g., 'droplet', 'scale', 'egg', 'cup'
        { name: 'source', type: 'string', isOptional: true }, // 'app' or 'user'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Junction table: Food -> Food Portions (Many-to-Many)
    // Links foods to their applicable portions
    tableSchema({
      name: 'food_food_portions',
      columns: [
        { name: 'food_id', type: 'string', isIndexed: true },
        { name: 'food_portion_id', type: 'string', isIndexed: true },
        // Per-food default portion among linked global portions.
        { name: 'is_default', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // 3. Meals (Collections/Recipes)
    // The "Header" for a recipe. Macros are inferred from children.
    tableSchema({
      name: 'meals',
      columns: [
        { name: 'is_ai_generated', type: 'boolean' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true }, // URL to meal image
        { name: 'is_favorite', type: 'boolean' },
        { name: 'prepared_weight_grams', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // 4. Meal Ingredients
    // Links Meals -> Foods with a specific quantity
    tableSchema({
      name: 'meal_foods',
      columns: [
        { name: 'meal_id', type: 'string', isIndexed: true },
        { name: 'food_id', type: 'string', isIndexed: true },

        // How much of the food?
        // We store the raw amount (e.g., 200) and the unit used (e.g., 'g' or 'portion_id')
        // Ideally, normalize to grams for easiest math, OR store reference to portion
        { name: 'amount', type: 'number' },
        { name: 'portion_id', type: 'string', isOptional: true }, // If null, assume base unit (grams)

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // 5. Nutrition Logs (The Daily Diary)
    // Records an instance of eating a food
    tableSchema({
      name: 'nutrition_logs',
      columns: [
        { name: 'food_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' }, // 'breakfast', 'lunch', 'dinner', 'snack', 'other'
        { name: 'external_id', type: 'string', isOptional: true, isIndexed: true }, // ID from external data integrations (e.g. Health Connect) for sync deduplication

        { name: 'amount', type: 'number' }, // Quantity eaten
        { name: 'portion_id', type: 'string', isOptional: true }, // Unit used (e.g., linked to food_portions)

        // IMPORTANT: logged base macros, scaled to 100g - so if 100g of a food has 100 kcal, but the "amount" in this table is 200g, then the logged macros will be 200 kcal
        { name: 'logged_food_name', type: 'string', isOptional: true }, // isEncrypted: true
        { name: 'logged_calories', type: 'string' }, // isEncrypted: true
        { name: 'logged_protein', type: 'string' }, // isEncrypted: true
        { name: 'logged_carbs', type: 'string' }, // isEncrypted: true
        { name: 'logged_fat', type: 'string' }, // isEncrypted: true
        { name: 'logged_fiber', type: 'string' }, // isEncrypted: true
        { name: 'logged_micros_json', type: 'string', isOptional: true }, // isEncrypted: true

        { name: 'group_id', type: 'string', isOptional: true }, // Groups related logs into a single meal (e.g. AI meal, saved meal)
        { name: 'logged_meal_name', type: 'string', isOptional: true }, // Display name for the meal group

        { name: 'date', type: 'number', isIndexed: true }, // Not encrypted (for querying/sorting)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // User Metrics
    tableSchema({
      // track height, weight, fat percentage, flow intensity, energy level, mood, basal body temp, etc.
      name: 'user_metrics',
      columns: [
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'external_id', type: 'string', isOptional: true, isIndexed: true }, // ID from external data integrations (e.g. Health Connect) for sync deduplication
        // Encrypted at rest (utils/encryption.ts)
        { name: 'value', type: 'string' }, // isEncrypted: true
        { name: 'unit', type: 'string', isOptional: true }, // isEncrypted: true
        { name: 'date', type: 'number', isIndexed: true }, // Not encrypted (for querying/sorting)
        { name: 'timezone', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // User Metrics Notes
    tableSchema({
      name: 'user_metrics_notes',
      columns: [
        { name: 'user_metric_id', type: 'string', isIndexed: true },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'menstrual_cycles',
      columns: [
        { name: 'avg_cycle_length', type: 'number' }, // Default 28
        { name: 'avg_period_duration', type: 'number' }, // Default 5
        { name: 'use_hormonal_birth_control', type: 'boolean' },
        { name: 'birth_control_type', type: 'string', isOptional: true }, // 'pill', 'iud', etc.
        { name: 'last_period_start_date', type: 'number' }, // The "Anchor Date"
        { name: 'sync_goal', type: 'string', isOptional: true }, // 'performance', 'symptoms', 'energy'
        { name: 'is_active', type: 'boolean' }, // Allow users to turn tracking off
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Settings
    tableSchema({
      name: 'settings',
      columns: [
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // User Profile
    tableSchema({
      name: 'users',
      columns: [
        { name: 'full_name', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'date_of_birth', type: 'number' },
        { name: 'gender', type: 'string' }, // 'male', 'female', 'other'
        { name: 'fitness_goal', type: 'string' }, // 'weight_loss'
        { name: 'weight_goal', type: 'string' }, // 'lose' | 'gain' | 'maintain'
        { name: 'activity_level', type: 'number' },
        { name: 'lifting_experience', type: 'string' }, // 'beginner', 'intermediate', 'advanced'
        { name: 'avatar_icon', type: 'string', isOptional: true }, // 'person', 'fitness_center', 'bolt', 'monitoring', 'directions_run', 'emoji_events'
        { name: 'avatar_color', type: 'string', isOptional: true }, // 'emerald', 'blue', 'purple', 'pink', 'orange', 'teal'
        { name: 'sync_id', type: 'string', isIndexed: true }, // Primary sync identifier (UUID)
        { name: 'external_account_id', type: 'string', isIndexed: true, isOptional: true }, // OAuth provider ID
        { name: 'external_account_provider', type: 'string', isOptional: true }, // 'google', 'apple', etc.
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Nutrition goals: snapshot per row; current = effective_until IS NULL
    tableSchema({
      name: 'nutrition_goals',
      columns: [
        { name: 'total_calories', type: 'number' },
        { name: 'protein', type: 'number' },
        { name: 'carbs', type: 'number' },
        { name: 'fats', type: 'number' },
        { name: 'fiber', type: 'number' },
        { name: 'eating_phase', type: 'string' }, // 'cut', 'maintain', 'bulk'
        { name: 'target_weight', type: 'number' },
        { name: 'target_body_fat', type: 'number', isOptional: true },
        { name: 'target_bmi', type: 'number', isOptional: true },
        { name: 'target_ffmi', type: 'number', isOptional: true },
        { name: 'target_date', type: 'number', isOptional: true },
        { name: 'effective_until', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Midterm check-ins for a nutrition goal (targets at intermediate dates)
    tableSchema({
      name: 'nutrition_checkins',
      columns: [
        { name: 'nutrition_goal_id', type: 'string', isIndexed: true },
        { name: 'checkin_date', type: 'number', isIndexed: true },
        { name: 'target_weight', type: 'number' },
        { name: 'target_body_fat', type: 'number', isOptional: true },
        { name: 'target_bmi', type: 'number', isOptional: true },
        { name: 'target_ffmi', type: 'number', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Loggy Chat Messages
    tableSchema({
      name: 'chat_messages',
      columns: [
        { name: 'sender', type: 'string' }, // 'user' | 'coach'
        { name: 'message', type: 'string' },
        { name: 'message_type', type: 'string' }, // 'text' for now
        { name: 'context', type: 'string' }, // 'nutrition' | 'exercise' | 'general'
        { name: 'payload_json', type: 'string', isOptional: true },
        { name: 'summarized_message', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Saved For Later Groups
    tableSchema({
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

    // Saved For Later Items
    tableSchema({
      name: 'saved_for_later_items',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'food_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'portion_id', type: 'string', isOptional: true },
        // Snapshotted macros (encrypted)
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

    // AI Custom Prompts
    tableSchema({
      name: 'ai_custom_prompts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'context', type: 'string' }, // 'nutrition' | 'exercise' | 'general'
        { name: 'type', type: 'string' }, // 'system' | 'memory'
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Canonical muscle catalogue (seeded from bundled data)
    tableSchema({
      name: 'muscles',
      columns: [
        { name: 'name', type: 'string', isIndexed: true }, // snake_case key, e.g. 'triceps'
        { name: 'muscle_group', type: 'string', isIndexed: true }, // e.g. 'arms', 'chest'
        { name: 'display_name', type: 'string' }, // Human-readable, e.g. 'Triceps'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Junction: which muscles an exercise targets
    tableSchema({
      name: 'exercise_muscles',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'muscle_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
