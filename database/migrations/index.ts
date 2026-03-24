import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'supplements',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'dosage', type: 'string', isOptional: true },
            { name: 'has_reminder', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'user_metrics',
          columns: [
            { name: 'supplement_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
  ],
});
