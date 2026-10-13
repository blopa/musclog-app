import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

const migrationV33 = {
  toVersion: 33,
  steps: [
    addColumns({
      table: 'workout_log_exercises',
      columns: [{ name: 'superset_slot_id', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV33;
