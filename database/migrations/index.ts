import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'nutrition_checkins',
          columns: [{ name: 'completed', type: 'boolean', isOptional: true }],
        }),
      ],
    },
  ],
});
