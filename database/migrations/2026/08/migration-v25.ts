import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 25: Add named workout plans and contextual plan membership.
//
// Membership is optional and many-to-many: existing workout templates remain Unplanned and this
// migration invents no parent rows. A plan's cycle_type decides the authoritative membership
// field: weekly plans use week_days_json, while rotating plans use position. Weekly membership
// weekdays and standalone schedules have mutually exclusive read contexts and are never mirrored.
// The old workout_templates.week_days_json column is retained only for compatibility with legacy
// migrated rows; normal save paths no longer write it. workout_logs.plan_id is stamped now for
// future per-plan history, but no analytics read it in this version.
//
// Every step is additive, so applying v25 cannot modify an existing row and does not require the
// pre-migration database snapshot.
const migrationV25 = {
  toVersion: 25,
  steps: [
    createTable({
      name: 'workout_plans',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'cycle_type', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'difficulty', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'workout_plan_templates',
      columns: [
        { name: 'plan_id', type: 'string', isIndexed: true },
        { name: 'template_id', type: 'string', isIndexed: true },
        { name: 'week_days_json', type: 'string', isOptional: true },
        { name: 'position', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'workout_logs',
      columns: [{ name: 'plan_id', type: 'string', isOptional: true, isIndexed: true }],
    }),
  ],
};

export default migrationV25;
