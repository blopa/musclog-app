import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1, // no need to change for now
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
        { name: 'load_multiplier', type: 'number' }, // Load multiplier for volume calculations
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
        { name: 'volume_calculation_type', type: 'string' },
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

    // THE BLUEPRINT SETS: The default reps/weight for a routine
    tableSchema({
      name: 'workout_template_sets',
      columns: [
        { name: 'template_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'target_reps', type: 'number' },
        { name: 'target_weight', type: 'number' },
        { name: 'rest_time_after', type: 'number', isOptional: true },
        { name: 'set_order', type: 'number' },
        { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
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
        { name: 'workout_name', type: 'string' }, // We save the name here so it's permanent
        { name: 'started_at', type: 'number', isIndexed: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'total_volume', type: 'number', isOptional: true },
        { name: 'calories_burned', type: 'number', isOptional: true },
        { name: 'exhaustion_level', type: 'number' },
        { name: 'workout_score', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // THE HISTORY SETS: What actually happened
    tableSchema({
      name: 'workout_log_sets',
      columns: [
        { name: 'workout_log_id', type: 'string', isIndexed: true }, // Link to the history log
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'reps', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'partials', type: 'number', isOptional: true }, // Partial reps (defaults to 0)
        { name: 'rest_time_after', type: 'number' },
        { name: 'reps_in_reserve', type: 'number' },
        { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
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

        // Macros per standard serving (usually 100g or 1 serving)
        { name: 'calories', type: 'number' },
        { name: 'protein', type: 'number' },
        { name: 'carbs', type: 'number' },
        { name: 'fat', type: 'number' },
        { name: 'fiber', type: 'number' },

        // Extended data (Fiber, Sugar, Sodium, Vitamins, Alcohol, etc.) stored as JSON
        // Usage: @json decorator in the Model
        { name: 'micros_json', type: 'string', isOptional: true },

        { name: 'is_favorite', type: 'boolean' }, // Quick access
        { name: 'source', type: 'string', isOptional: true }, // 'user', 'api', 'scanned'
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
        { name: 'is_default', type: 'boolean' }, // Exactly one per food should be true
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

        { name: 'amount', type: 'number' }, // Quantity eaten
        { name: 'portion_id', type: 'string', isOptional: true }, // Unit used (e.g., linked to food_portions)

        // logged data must be encrypted later on
        { name: 'logged_food_name', type: 'string', isOptional: true },
        { name: 'logged_calories', type: 'number' },
        { name: 'logged_protein', type: 'number' },
        { name: 'logged_carbs', type: 'number' },
        { name: 'logged_fat', type: 'number' },
        { name: 'logged_fiber', type: 'number' },
        { name: 'logged_micros_json', type: 'string', isOptional: true },
        { name: 'date', type: 'number', isIndexed: true }, // Midnight timestamp for the day

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // User Metrics
    tableSchema({
      name: 'user_metrics',
      columns: [
        { name: 'type', type: 'string', isIndexed: true },
        // value, unit and date must be encrypted later on
        { name: 'value', type: 'number' },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'date', type: 'number', isIndexed: true },

        { name: 'timezone', type: 'string' },
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
        { name: 'fitness_goal', type: 'string' },
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
        { name: 'target_body_fat', type: 'number' },
        { name: 'target_bmi', type: 'number' },
        { name: 'target_ffmi', type: 'number' },
        { name: 'target_date', type: 'number', isOptional: true },
        { name: 'effective_until', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
