import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 22: Add period_logs table and life_stage column to menstrual_cycles.
//
// period_logs stores each actual period event (start + optional end date), replacing
// the single last_period_start_date anchor. Phase predictions are now calculated from
// real history rather than fixed averages the user may not know.
//
// life_stage ('regular' | 'pcos' | 'perimenopause' | 'postpartum' | 'post_pill') lets
// the app show context-specific prediction disclaimers and wider uncertainty bands.
//
// last_period_start_date on menstrual_cycles is kept as a cached denormalization (now
// isOptional) and is synced whenever a period_log is created or deleted.
const migrationV22 = {
  toVersion: 22,
  steps: [
    createTable({
      name: 'period_logs',
      columns: [
        { name: 'menstrual_cycle_id', type: 'string', isIndexed: true },
        { name: 'start_date', type: 'number' },
        { name: 'end_date', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'timezone', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'menstrual_cycles',
      columns: [{ name: 'life_stage', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV22;
