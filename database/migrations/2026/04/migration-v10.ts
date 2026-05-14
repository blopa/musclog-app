import { createTable } from '@nozbe/watermelondb/Schema/migrations';

const migrationV10 = {
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
};

export default migrationV10;
