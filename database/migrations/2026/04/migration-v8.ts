import { createTable, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV8 = {
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
};

export default migrationV8;
