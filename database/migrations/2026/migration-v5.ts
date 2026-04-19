import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

const migrationV5 = {
  toVersion: 5,
  steps: [
    addColumns({
      table: 'meals',
      columns: [{ name: 'prepared_weight_grams', type: 'number', isOptional: true }],
    }),
  ],
};

export default migrationV5;
