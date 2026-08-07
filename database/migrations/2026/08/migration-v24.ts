import { createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 24: Add notes table.
//
// Free-form scratchpad entries the user writes while cooking ("70g of broccoli") without
// committing to a nutrition log yet. A note can later be piped into the coach's TRACK_MEAL
// flow, which is what actually creates NutritionLog rows — notes themselves never affect
// macros, goals, or any aggregate.
//
// Stored in PLAINTEXT on purpose, unlike saved_for_later_groups.note (encrypted): the list
// query stays SQL-side, so encrypting the body would force full-table decryption on every
// render. Do not add encryption without rewriting the list query and the backup path.
//
// created_at is indexed because the only read path is
// `WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT n` (the paged "Load more" list).
const migrationV24 = {
  toVersion: 24,
  steps: [
    createTable({
      name: 'notes',
      columns: [
        { name: 'title', type: 'string', isOptional: true },
        { name: 'body', type: 'string' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV24;
