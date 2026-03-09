import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'menstrual_cycles',
          columns: [{ name: 'sync_goal', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
