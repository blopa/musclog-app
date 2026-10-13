import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Encrypted cycle records. Purely additive: the three tables hold one encrypted JSON `payload`
 * each, and `menstrual_cycles.config` holds the encrypted fallback averages. The legacy
 * period_logs rows and period_flow / period_symptoms metrics are converted at boot by
 * CycleDataEncryptionMigration (it needs the app's encryption key, which SQL cannot reach).
 */
const migrationV36 = {
  toVersion: 36,
  steps: [
    createTable({
      name: 'cycle_periods',
      columns: [
        { name: 'cycle_id', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'cycle_day_logs',
      columns: [
        { name: 'payload', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'cycle_contexts',
      columns: [
        { name: 'cycle_id', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'menstrual_cycles',
      columns: [{ name: 'config', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV36;
