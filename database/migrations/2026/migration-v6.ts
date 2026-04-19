import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

const migrationV6 = {
  toVersion: 6,
  steps: [
    addColumns({
      table: 'nutrition_logs',
      columns: [
        { name: 'group_id', type: 'string', isOptional: true },
        { name: 'logged_meal_name', type: 'string', isOptional: true },
      ],
    }),
  ],
};

export default migrationV6;
