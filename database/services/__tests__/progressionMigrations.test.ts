import { schema } from '@/database/schema';
import migration31 from '@/database/migrations/2026/10/migration-v31';
import migration32 from '@/database/migrations/2026/10/migration-v32';
import migration33 from '@/database/migrations/2026/10/migration-v33';
import migration34 from '@/database/migrations/2026/10/migration-v34';
import migration35 from '@/database/migrations/2026/10/migration-v35';
import { weeklyReviewTrainingColumns } from '@/database/weeklyReviewSchema';
import { RESTORE_ORDER } from '@/constants/exportImport';
import { CURRENT_DATABASE_VERSION } from '@/constants/database';

it('keeps v35 purely additive: one optional rep ceiling column, mirrored in the schema', () => {
  expect(migration35.toVersion).toBe(35);
  expect(migration35.steps).toEqual([
    expect.objectContaining({ type: 'add_columns', table: 'exercise_user_settings' }),
  ]);
  expect(schema.tables.exercise_user_settings.columns.rep_ceiling).toMatchObject({
    type: 'number',
    isOptional: true,
  });
});
it('keeps v31 purely additive and includes all new optional columns in the schema', () => {
  expect(migration31.toVersion).toBe(31);
  expect(migration31.steps).toHaveLength(2);
  for (const table of ['workout_template_exercises', 'workout_log_exercises'])
    expect(schema.tables[table].columns.progression_json).toMatchObject({
      type: 'string',
      isOptional: true,
    });
  expect(schema.tables.workout_log_sets.columns.rir_recorded).toMatchObject({
    type: 'boolean',
    isOptional: true,
  });
  expect(schema.tables.workout_log_sets.columns.prescription_json.isOptional).toBe(true);
  expect(schema.tables.nutrition_goals.columns.target_mode.isOptional).toBe(true);
});
it('uses identical target/review table definitions for native migration and Loki schema with restore dependencies', () => {
  expect(CURRENT_DATABASE_VERSION).toBe(35);
  const laterColumns = new Set(weeklyReviewTrainingColumns.map((column) => column.name));
  for (const step of migration32.steps.filter((step) => step.type === 'create_table')) {
    // v32 created the table; v34 added the training columns on top of it.
    const current = schema.tables[step.schema.name];
    expect({
      ...current,
      columns: Object.fromEntries(
        Object.entries(current.columns).filter(([name]) => !laterColumns.has(name))
      ),
      columnArray: current.columnArray.filter((column) => !laterColumns.has(column.name)),
    }).toEqual(step.schema);
    expect(RESTORE_ORDER).toContain(step.schema.name);
  }
  expect(RESTORE_ORDER.indexOf('nutrition_goals')).toBeLessThan(
    RESTORE_ORDER.indexOf('weekly_reviews')
  );
  expect(RESTORE_ORDER.indexOf('weekly_reviews')).toBeLessThan(
    RESTORE_ORDER.indexOf('nutrition_target_periods')
  );
});

function schemaBeforeProgression() {
  const tables = Object.fromEntries(
    Object.entries(schema.tables)
      .filter(([name]) => !['weekly_reviews', 'nutrition_target_periods'].includes(name))
      .map(([name, table]) => {
        const columns = { ...table.columns };
        for (const column of [
          'progression_json',
          'target_mode',
          'prescription_json',
          'rir_recorded',
          'superset_slot_id',
          'rep_ceiling',
        ])
          delete columns[column];
        return [name, { ...table, columns }];
      })
  );
  return { ...schema, version: 30, tables };
}
it('migrates existing SQLite records through v31 through v35 without changing legacy values', () => {
  const { DatabaseSync } = require('node:sqlite');
  const {
    encodeSchema,
    encodeMigrationSteps,
  } = require('@nozbe/watermelondb/adapters/sqlite/encodeSchema');
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(encodeSchema(schemaBeforeProgression()));
    sqlite.exec(
      `INSERT INTO workout_log_sets (id, weight, reps, reps_in_reserve, completion_status) VALUES ('existing', 60, 10, 0, 'performed'); INSERT INTO nutrition_goals (id, total_calories, is_dynamic) VALUES ('legacy', 2100, 1);`
    );
    sqlite.exec(
      "INSERT INTO workout_log_exercises (id, workout_log_id, exercise_id, exercise_order, group_id) VALUES ('block', 'workout', 'bench', 1, 'superset')"
    );
    sqlite.exec(
      "INSERT INTO exercise_user_settings (id, exercise_id, weight_unit, note) VALUES ('pref', 'pushup', 'kg', 'elbows in')"
    );
    sqlite.exec(
      encodeMigrationSteps([
        ...migration31.steps,
        ...migration32.steps,
        ...migration33.steps,
        ...migration34.steps,
        ...migration35.steps,
      ])
    );
    expect({
      ...sqlite
        .prepare(
          'SELECT exercise_id, group_id, superset_slot_id FROM workout_log_exercises WHERE id = ?'
        )
        .get('block'),
    }).toEqual({ exercise_id: 'bench', group_id: 'superset', superset_slot_id: null });
    const set = sqlite
      .prepare(
        'SELECT weight, reps, reps_in_reserve, rir_recorded, prescription_json FROM workout_log_sets WHERE id = ?'
      )
      .get('existing');
    expect({ ...set }).toEqual({
      weight: 60,
      reps: 10,
      reps_in_reserve: 0,
      rir_recorded: null,
      prescription_json: null,
    });
    expect(
      sqlite.prepare('SELECT target_mode FROM nutrition_goals WHERE id = ?').get('legacy')
        .target_mode
    ).toBeNull();
    // v35 adds the rep ceiling without touching an existing exercise's unit or note.
    expect({
      ...sqlite
        .prepare('SELECT weight_unit, note, rep_ceiling FROM exercise_user_settings WHERE id = ?')
        .get('pref'),
    }).toEqual({ weight_unit: 'kg', note: 'elbows in', rep_ceiling: null });
    for (const name of ['weekly_reviews', 'nutrition_target_periods'])
      expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count).toBe(0);
  } finally {
    sqlite.close();
  }
});
it('migrates a persisted Loki v30 database through all additive migrations', async () => {
  const { Database } = require('@nozbe/watermelondb');
  const LokiAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  const memory = new (require('lokijs').LokiMemoryAdapter)();
  const NutritionGoal = require('@/database/models/NutritionGoal').default;
  const WorkoutLogSet = require('@/database/models/WorkoutLogSet').default;
  const options = {
    dbName: 'progression-migration-test',
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    extraLokiOptions: { autosave: false },
    _testLokiAdapter: memory,
  };
  const old = new Database({
    adapter: new LokiAdapter({ ...options, schema: schemaBeforeProgression() }),
    modelClasses: [NutritionGoal, WorkoutLogSet],
  });
  await old.write(async () => {
    await old.batch(
      old.get('workout_log_sets').prepareCreateFromDirtyRaw({
        id: 'existing',
        weight: 60,
        reps: 10,
        reps_in_reserve: 0,
        completion_status: 'performed',
      }),
      old
        .get('nutrition_goals')
        .prepareCreateFromDirtyRaw({ id: 'legacy', total_calories: 2100, is_dynamic: true })
    );
  });
  const driver = (db) => db.adapter.underlyingAdapter._dispatcher._worker._bridge.driver.loki;
  await new Promise<void>((resolve, reject) =>
    driver(old).saveDatabase((error) => (error ? reject(error) : resolve()))
  );
  driver(old).close();
  const migrated = new Database({
    adapter: new LokiAdapter({
      ...options,
      schema,
      migrations: require('@/database/migrations').migrations,
    }),
    modelClasses: [NutritionGoal, WorkoutLogSet],
  });
  try {
    const set = await migrated.get('workout_log_sets').find('existing');
    expect(set.weight).toBe(60);
    expect(set.reps).toBe(10);
    expect(set.rirRecorded).toBeNull();
    const goal = await migrated.get('nutrition_goals').find('legacy');
    expect(goal.isDynamic).toBe(true);
    expect(goal.targetMode).toBeNull();
    expect((await migrated.get('workout_log_sets').query().fetch()).length).toBe(1);
  } finally {
    driver(migrated).close();
  }
});
