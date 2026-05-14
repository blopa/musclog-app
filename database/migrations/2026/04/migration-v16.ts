import { addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV16 = {
  toVersion: 16,
  steps: [
    addColumns({
      table: 'workout_log_sets',
      columns: [{ name: 'set_type', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'workout_template_sets',
      columns: [{ name: 'set_type', type: 'string', isOptional: true }],
    }),
    // Backfill set_type from is_drop_set
    unsafeExecuteSql(
      "UPDATE workout_log_sets SET set_type = CASE WHEN is_drop_set = 1 THEN 'drop_set' ELSE 'normal' END WHERE set_type IS NULL;"
    ),
    unsafeExecuteSql(
      "UPDATE workout_template_sets SET set_type = CASE WHEN is_drop_set = 1 THEN 'drop_set' ELSE 'normal' END WHERE set_type IS NULL;"
    ),
    // Drop old boolean column
    unsafeExecuteSql('ALTER TABLE workout_log_sets DROP COLUMN is_drop_set;'),
    unsafeExecuteSql('ALTER TABLE workout_template_sets DROP COLUMN is_drop_set;'),
  ],
};

export default migrationV16;
