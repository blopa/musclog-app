import type { TableSchemaSpec } from '@nozbe/watermelondb/Schema';

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
