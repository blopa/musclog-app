import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

const migrationV13 = {
  toVersion: 13,
  steps: [
    createTable({
      name: 'supplements',
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'has_reminder', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'user_metrics',
      columns: [{ name: 'supplement_id', type: 'string', isOptional: true, isIndexed: true }],
    }),
  ],
};

export default migrationV13;
