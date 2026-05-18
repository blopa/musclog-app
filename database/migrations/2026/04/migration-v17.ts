import { createTable } from '@nozbe/watermelondb/Schema/migrations';

const migrationV17 = {
  toVersion: 17,
  steps: [
    createTable({
      name: 'ble_devices',
      columns: [
        { name: 'device_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'nickname', type: 'string', isOptional: true },
        { name: 'platform', type: 'string' },
        { name: 'last_connected_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV17;
