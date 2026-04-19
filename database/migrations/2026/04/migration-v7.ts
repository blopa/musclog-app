import { addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV7 = {
  toVersion: 7,
  steps: [
    // Add order_index column to exercises table
    addColumns({
      table: 'exercises',
      columns: [{ name: 'order_index', type: 'number', isOptional: true }],
    }),
    // Old DB stores filenames as bare numbers: "1.png", "2.png", etc.
    // New URL format: .../refs/tags/2.5.15/assets/exercises/exercise1.png
    // SUBSTR(..., INSTR(..., '/exercises/') + 11) extracts "1.png"; prepend "exercise".
    unsafeExecuteSql(
      "UPDATE exercises SET image_url = 'https://raw.githubusercontent.com/blopa/musclog-app/refs/tags/2.5.15/assets/exercises/exercise' || SUBSTR(image_url, INSTR(image_url, '/exercises/') + 11) WHERE source = 'app' AND image_url LIKE 'file://%/exercises/%.png' AND image_url NOT LIKE '%/exercises/fallback.png';"
    ),
    unsafeExecuteSql(
      "UPDATE exercises SET image_url = NULL WHERE source = 'app' AND image_url LIKE '%/exercises/fallback.png';"
    ),
  ],
};

export default migrationV7;
