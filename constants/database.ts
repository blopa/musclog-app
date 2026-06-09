export const DEFAULT_BATCH_SIZE = 5;

export const CURRENT_DATABASE_VERSION = 20;

export const SEEDING_COMPLETE_KEY = 'seeding_complete';
export const ENCRYPTION_KEY = 'encryptionKey';

export const DATABASE_NAME = 'musclog';

export interface ChildSpec {
  table: string;
  fkColumn: string;
  children?: ChildSpec[];
}

export interface TableGroupDescriptor {
  rootTable: string;
  children: ChildSpec[];
}

export const REPAIR_DESCRIPTORS = {
  workoutLogs: {
    rootTable: 'workout_logs',
    children: [
      {
        table: 'workout_log_exercises',
        fkColumn: 'workout_log_id',
        children: [{ table: 'workout_log_sets', fkColumn: 'log_exercise_id' }],
      },
    ],
  },
  workoutTemplates: {
    rootTable: 'workout_templates',
    children: [
      {
        table: 'workout_template_exercises',
        fkColumn: 'template_id',
        children: [{ table: 'workout_template_sets', fkColumn: 'template_exercise_id' }],
      },
      { table: 'schedules', fkColumn: 'template_id' },
    ],
  },
  nutritionLogs: {
    rootTable: 'nutrition_logs',
    children: [],
  },
  userMetrics: {
    rootTable: 'user_metrics',
    children: [{ table: 'user_metrics_notes', fkColumn: 'user_metric_id' }],
  },
  nutritionGoals: {
    rootTable: 'nutrition_goals',
    children: [{ table: 'nutrition_checkins', fkColumn: 'nutrition_goal_id' }],
  },
  savedForLater: {
    rootTable: 'saved_for_later_groups',
    children: [{ table: 'saved_for_later_items', fkColumn: 'group_id' }],
  },
  meals: {
    rootTable: 'meals',
    children: [
      { table: 'meal_foods', fkColumn: 'meal_id' },
      { table: 'meal_food_portions', fkColumn: 'meal_id' },
    ],
  },
  foods: {
    rootTable: 'foods',
    children: [{ table: 'food_food_portions', fkColumn: 'food_id' }],
  },
} satisfies Record<string, TableGroupDescriptor>;
