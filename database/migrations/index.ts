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
        createTable({
          name: 'ai_custom_prompts',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'content', type: 'string' },
            { name: 'context', type: 'string' },
            { name: 'is_active', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'nutrition_checkins',
          columns: [{ name: 'status', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
