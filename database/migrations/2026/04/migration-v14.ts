import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

const migrationV14 = {
  toVersion: 14,
  steps: [
    addColumns({
      table: 'nutrition_goals',
      columns: [{ name: 'is_dynamic', type: 'boolean', isOptional: true }],
    }),
  ],
};

export default migrationV14;
