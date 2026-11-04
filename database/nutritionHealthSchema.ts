import type { TableSchemaSpec } from '@nozbe/watermelondb/Schema';

/** Permanent ownership and ignored-original facts, never an evicting cache. */
export const nutritionHealthOwnershipTable: TableSchemaSpec = {
  name: 'nutrition_health_ownership',
  columns: [
    { name: 'kind', type: 'string', isIndexed: true },
    { name: 'record_id', type: 'string', isIndexed: true },
    { name: 'created_at', type: 'number' },
  ],
};
