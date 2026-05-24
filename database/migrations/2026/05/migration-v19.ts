import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

const migrationV19 = {
  toVersion: 19,
  steps: [
    addColumns({
      table: 'workout_log_sets',
      columns: [{ name: 'rep_data_json', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV19;
