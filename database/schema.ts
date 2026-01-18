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
        { name: 'set_order', type: 'number' },
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
        { name: 'rest_time', type: 'number' },
        { name: 'difficulty_level', type: 'number' }, // 1-10 (RPE)
        { name: 'is_drop_set', type: 'boolean' },
        { name: 'set_order', type: 'number' },
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
        { name: 'value', type: 'number' },
        { name: 'unit', type: 'string' },
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
        { name: 'activity_level', type: 'number' },
        { name: 'lifting_experience', type: 'string' }, // 'beginner', 'intermediate', 'advanced'
        { name: 'photo_uri', type: 'string', isOptional: true },
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
