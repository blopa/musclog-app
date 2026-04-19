import { addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV4 = {
  toVersion: 4,
  steps: [
    unsafeExecuteSql('ALTER TABLE food_portions DROP COLUMN is_default;'),
    unsafeExecuteSql('ALTER TABLE workout_templates DROP COLUMN volume_calculation_type;'),
    addColumns({
      table: 'workout_templates',
      columns: [{ name: 'workout_insights_type', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV4;
