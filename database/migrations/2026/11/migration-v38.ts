import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

/** Where an imported workout came from, so a repeated import adds nothing and one can be undone. */
const migrationV38 = {
  toVersion: 38,
  steps: [
    addColumns({
      table: 'workout_logs',
      columns: [
        { name: 'import_source', type: 'string', isOptional: true },
        { name: 'import_key', type: 'string', isOptional: true, isIndexed: true },
        { name: 'import_batch_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
  ],
};

export default migrationV38;
