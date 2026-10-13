/**
 * The migrations and `schema.ts` describe the same database twice, and WatermelonDB checks neither
 * against the other: a column added to the schema but not to its migration exists on a fresh
 * install and is missing on every upgraded phone (reads come back `undefined`, writes are dropped);
 * the reverse leaves a column the app never declares. These tests make that drift a build failure.
 */

import type { ColumnSchema } from '@nozbe/watermelondb';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import { migrations } from '@/database/migrations';
import { schema } from '@/database/schema';

type Step =
  | { type: 'create_table'; schema: { name: string; columnArray: ColumnSchema[] } }
  | { type: 'add_columns'; table: string; columns: ColumnSchema[] }
  | { type: 'sql'; sql: string };

const sorted = migrations.sortedMigrations as unknown as { toVersion: number; steps: Step[] }[];

/** Every column a migration declares, with the version that declared it. */
const migratedColumns = sorted.flatMap(({ toVersion, steps }) =>
  steps.flatMap((step) => {
    if (step.type === 'create_table') {
      return step.schema.columnArray.map((column) => ({
        toVersion,
        table: step.schema.name,
        column,
      }));
    }
    if (step.type === 'add_columns') {
      return step.columns.map((column) => ({ toVersion, table: step.table, column }));
    }
    return [];
  })
);

const normalized = (column: ColumnSchema) => ({
  name: column.name,
  type: column.type,
  isOptional: !!column.isOptional,
  isIndexed: !!column.isIndexed,
});

/**
 * Drift that already shipped and so cannot be fixed by editing its migration (a phone that ran it
 * will never run it again). Upgraded databases simply lack these indexes, and keep a nullable
 * `set_type` that every writer fills anyway. Fixing them needs a NEW migration — and a raw-SQL
 * `CREATE INDEX` step makes that migration data-touching (`migrationSafety.ts`: a pre-migration
 * snapshot on every upgrade) and is ignored by LokiJS on web, so it is a decision, not a cleanup.
 * Never add a column from v27 onwards here: new drift is a bug in the migration being written.
 */
const KNOWN_SHIPPED_DRIFT = new Set<string>([
  'exercise_goals.exercise_id', // v8: migration has no index, schema indexes it
  'exercise_goals.goal_type', // v8: migration has no index, schema indexes it
  'saved_for_later_items.food_id', // v10: migration has no index, schema indexes it
  'workout_log_sets.set_type', // v16: migration made it optional, schema requires it
  'workout_template_sets.set_type', // v16: migration made it optional, schema requires it
]);

describe('migrations ↔ schema parity', () => {
  it('lists no drift for the migrations that have not shipped yet', () => {
    const fromV27 = migratedColumns.filter(({ toVersion }) => toVersion >= 27);
    expect(
      fromV27.filter(({ table, column }) => KNOWN_SHIPPED_DRIFT.has(`${table}.${column.name}`))
    ).toEqual([]);
  });

  it('ends at the schema version, with no gaps', () => {
    expect(sorted.at(-1)?.toVersion).toBe(CURRENT_DATABASE_VERSION);
    expect(schema.version).toBe(CURRENT_DATABASE_VERSION);
    sorted.forEach((migration, index) => {
      if (index > 0) {
        expect(migration.toVersion).toBe(sorted[index - 1].toVersion + 1);
      }
    });
  });

  it('declares every migrated column in the schema, with the same definition', () => {
    const mismatches = migratedColumns
      .filter(({ table, column }) => !KNOWN_SHIPPED_DRIFT.has(`${table}.${column.name}`))
      .flatMap(({ toVersion, table, column }) => {
        const declared = schema.tables[table]?.columns[column.name];
        if (!declared) {
          return [`v${toVersion}: ${table}.${column.name} is not in schema.ts`];
        }
        return JSON.stringify(normalized(declared)) === JSON.stringify(normalized(column))
          ? []
          : [
              `v${toVersion}: ${table}.${column.name} is ${JSON.stringify(normalized(column))} ` +
                `in the migration but ${JSON.stringify(normalized(declared))} in schema.ts`,
            ];
      });

    expect(mismatches).toEqual([]);
  });

  it('migrates every column of every table a migration created', () => {
    // A table created by a migration must get ALL of its schema columns from migrations: either
    // in its createTable or in a later addColumns. (Tables older than the first migration came
    // from the base schema and cannot be checked this way.)
    const createdTables = new Set(
      sorted.flatMap(({ steps }) =>
        steps.flatMap((step) => (step.type === 'create_table' ? [step.schema.name] : []))
      )
    );
    const migrated = new Set(migratedColumns.map(({ table, column }) => `${table}.${column.name}`));

    const missing = [...createdTables].flatMap((table) =>
      Object.keys(schema.tables[table]?.columns ?? {})
        .map((column) => `${table}.${column}`)
        .filter((key) => !migrated.has(key))
    );

    expect(missing).toEqual([]);
  });

  it('migrates every column added to an existing table since v27', () => {
    // The base tables cannot be diffed as a whole, so this pins the recent additions explicitly:
    // each is declared by exactly one migration.
    const recent = [
      'exercises.search_text',
      'workout_logs.notes',
      'workout_logs.distance_m',
      'workout_logs.activity',
      'workout_log_exercises.replaced_exercise_id',
      'workout_log_exercises.substitution_reason',
      'workout_log_sets.adjustment_json',
    ];

    for (const key of recent) {
      const [table, column] = key.split('.');
      expect(schema.tables[table].columns[column]).toBeDefined();
      expect(
        migratedColumns.filter((entry) => entry.table === table && entry.column.name === column)
      ).toHaveLength(1);
    }
  });
});

describe('measurement columns are metric, and say so', () => {
  // The database always stores metric (kg, m, g); the UI converts. Older columns predate the
  // naming rule (`workout_log_sets.weight` is kilograms), so it applies from v27 on: a new number
  // column that holds a mass or a distance names its metric unit, so nobody can mistake it for a
  // display value and write pounds or miles into it.
  const MEASUREMENT = /weight|distance|height|length|mass|load|increment/;
  const METRIC_SUFFIX = /_(kg|g|grams|m|cm)$/;

  it('names the unit of every measurement column added since v27', () => {
    const unnamed = migratedColumns
      .filter(
        ({ toVersion, column }) =>
          toVersion >= 27 && column.type === 'number' && MEASUREMENT.test(column.name)
      )
      .filter(({ column }) => !METRIC_SUFFIX.test(column.name))
      .map(({ table, column }) => `${table}.${column.name}`);

    expect(unnamed).toEqual([]);
  });

  it('keeps unit preferences as display overrides, never as a unit for stored numbers', () => {
    // `weight_unit` columns only choose how kilograms are SHOWN. They must be strings next to
    // kilogram columns, never a number column's own unit.
    const unitColumns = migratedColumns.filter(({ column }) => column.name === 'weight_unit');

    expect(unitColumns.map(({ table }) => table).sort()).toEqual([
      'exercise_user_settings',
      'gyms',
    ]);
    for (const { column } of unitColumns) {
      expect(column).toMatchObject({ type: 'string', isOptional: true });
    }
  });
});
