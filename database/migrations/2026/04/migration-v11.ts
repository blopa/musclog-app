import { createTable } from '@nozbe/watermelondb/Schema/migrations';

const migrationV11 = {
  toVersion: 11,
  steps: [
    createTable({
      name: 'muscles',
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'muscle_group', type: 'string', isIndexed: true },
        { name: 'display_name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'exercise_muscles',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'muscle_id', type: 'string', isIndexed: true },
        // 'primary' | 'secondary' — defaults to 'primary' until the JSON distinguishes them
        { name: 'role', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV11;
