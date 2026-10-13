import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

/** Per-exercise bodyweight rep ceiling (`utils/bodyweightRepCeiling.ts`). Purely additive. */
const migrationV35 = {
  toVersion: 35,
  steps: [
    addColumns({
      table: 'exercise_user_settings',
      columns: [{ name: 'rep_ceiling', type: 'number', isOptional: true }],
    }),
  ],
};

export default migrationV35;
