import type { ColumnSchema, TableSchemaSpec } from '@nozbe/watermelondb/Schema';

/**
 * The tables exactly as migration v32 created them. Never add a column here: v32's `createTable`
 * is built from this array, so a later column would be created by v32 and then fail its own
 * `addColumns` on an upgrade. Later columns live in the lists below.
 */
export const weeklyReviewTables: TableSchemaSpec[] = [
  {
    name: 'nutrition_target_periods',
    columns: [
      { name: 'nutrition_goal_id', type: 'string', isIndexed: true },
      { name: 'effective_from', type: 'number', isIndexed: true },
      { name: 'effective_until', type: 'number', isOptional: true },
      { name: 'total_calories', type: 'number' },
      { name: 'protein', type: 'number' },
      { name: 'carbs', type: 'number' },
      { name: 'fats', type: 'number' },
      { name: 'fiber', type: 'number' },
      { name: 'source_review_id', type: 'string', isOptional: true },
      { name: 'created_at', type: 'number' },
      { name: 'updated_at', type: 'number' },
      { name: 'deleted_at', type: 'number', isOptional: true },
    ],
  },
  {
    name: 'weekly_reviews',
    columns: [
      { name: 'period_start', type: 'number' },
      { name: 'period_end', type: 'number', isIndexed: true },
      { name: 'timezone', type: 'string' },
      { name: 'nutrition_goal_id', type: 'string', isOptional: true },
      { name: 'training_reviewed_at', type: 'number', isOptional: true },
      { name: 'nutrition_reviewed_at', type: 'number', isOptional: true },
      { name: 'nutrition_decision', type: 'string', isOptional: true },
      { name: 'recommendation_json', type: 'string', isOptional: true },
      { name: 'accepted_json', type: 'string', isOptional: true },
      { name: 'created_at', type: 'number' },
      { name: 'updated_at', type: 'number' },
      { name: 'deleted_at', type: 'number', isOptional: true },
    ],
  },
];

/** Added to `weekly_reviews` by migration v34: the training half's decision and its snapshot. */
export const weeklyReviewTrainingColumns: ColumnSchema[] = [
  { name: 'training_decision', type: 'string', isOptional: true },
  { name: 'training_json', type: 'string', isOptional: true },
];

/** The current shape of the weekly-review tables: v32's tables plus every later column. */
export const weeklyReviewSchemaTables: TableSchemaSpec[] = weeklyReviewTables.map((table) =>
  table.name === 'weekly_reviews'
    ? { ...table, columns: [...table.columns, ...weeklyReviewTrainingColumns] }
    : table
);
