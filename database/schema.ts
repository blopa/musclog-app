import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // Workout templates
    tableSchema({
      name: 'workouts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'is_template', type: 'boolean' },
        { name: 'repeat_days', type: 'string', isOptional: true },
        { name: 'volume_calc_method', type: 'string', isOptional: true },
      ],
    }),
    // Actual performed workout sessions
    tableSchema({
      name: 'workout_sessions',
      columns: [
        { name: 'workout_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'started_at', type: 'number' },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'duration', type: 'number', isOptional: true },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'exhaustion', type: 'number', isOptional: true },
        { name: 'enjoyment', type: 'number', isOptional: true },
        { name: 'total_volume', type: 'number', isOptional: true },
      ],
    }),
    // Exercise library
    tableSchema({
      name: 'exercises',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'muscle_group', type: 'string' },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'is_custom', type: 'boolean' },
      ],
    }),
    // Join table between workouts/sessions and exercises
    tableSchema({
      name: 'workout_exercises',
      columns: [
        { name: 'workout_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'sort_order', type: 'number' },
        { name: 'superset_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'is_session', type: 'boolean' },
      ],
    }),
    // Individual set records
    tableSchema({
      name: 'sets',
      columns: [
        { name: 'workout_exercise_id', type: 'string', isIndexed: true },
        { name: 'reps', type: 'number' },
        { name: 'partial_reps', type: 'number', isOptional: true },
        { name: 'weight', type: 'number', isOptional: true },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'is_completed', type: 'boolean' },
        { name: 'is_bodyweight', type: 'boolean' },
        { name: 'extra_weight', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
      ],
    }),
    // Nutrition tracking
    tableSchema({
      name: 'food_logs',
      columns: [
        { name: 'food_name', type: 'string' },
        { name: 'external_id', type: 'string', isOptional: true },
        { name: 'external_source', type: 'string', isOptional: true },
        { name: 'calories', type: 'number' },
        { name: 'protein', type: 'number' },
        { name: 'carbs', type: 'number' },
        { name: 'fat', type: 'number' },
        { name: 'fiber', type: 'number', isOptional: true },
        { name: 'sugar', type: 'number', isOptional: true },
        { name: 'meal_type', type: 'string' },
        { name: 'grams', type: 'number' },
        { name: 'consumed_at', type: 'number', isIndexed: true },
      ],
    }),
    // Body metrics tracking
    tableSchema({
      name: 'user_metrics',
      columns: [
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'value', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'recorded_at', type: 'number', isIndexed: true },
      ],
    }),
  ],
});
