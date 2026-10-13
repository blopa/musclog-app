import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

import { weeklyReviewTables } from '@/database/weeklyReviewSchema';

const migrationV32 = {
  toVersion: 32,
  steps: [
    addColumns({
      table: 'nutrition_goals',
      columns: [{ name: 'target_mode', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'workout_log_sets',
      columns: [
        { name: 'prescription_json', type: 'string', isOptional: true },
        { name: 'rir_recorded', type: 'boolean', isOptional: true },
      ],
    }),
    ...weeklyReviewTables.map(createTable),
  ],
};

export default migrationV32;
