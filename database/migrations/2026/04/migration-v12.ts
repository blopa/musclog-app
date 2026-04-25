import { createTable } from '@nozbe/watermelondb/Schema/migrations';

const migrationV12 = {
  toVersion: 12,
  steps: [
    createTable({
      name: 'debug_dump',
      columns: [
        { name: 'provider', type: 'string', isIndexed: true },
        { name: 'direction', type: 'string', isIndexed: true },
        { name: 'operation', type: 'string', isIndexed: true },
        { name: 'payload_json', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV12;
