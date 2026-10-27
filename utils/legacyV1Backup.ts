/**
 * Musclog 1.x JSON backups.
 *
 * A 1.x export is the old SQLite database dumped table by table:
 * `{ "<SQLite table name>": [row, …] }`, with the original camelCase column names and
 * no `_exportVersion`. Both 1.x export paths write plaintext values: the native dump
 * decrypted `UserMetrics`/`UserNutrition` before writing, and the web build never
 * encrypted them. The optional passphrase wraps the whole file with the same
 * CryptoJS AES call 2.0 uses, so it is removed before the JSON is parsed.
 *
 * `MigrationService` already turns that schema into 2.0 records when the 1.x database
 * is still on the device. Importing a 1.x JSON loads these rows into an in-memory
 * SQLite database and runs the same migration over it, so the conversion has one
 * implementation. This module is the pure half: detection and the SQL that rebuilds
 * the tables.
 */

/** The 1.x tables `MigrationService` reads. Every one is created, empty if the dump lacks it. */
export const LEGACY_V1_TABLES = [
  'FitnessGoals',
  'UserMetrics',
  'User',
  'Food',
  'UserNutrition',
  'Exercise',
  'Workout',
  'WorkoutEvent',
  'Set',
] as const;

export type LegacyV1Table = (typeof LEGACY_V1_TABLES)[number];

export type LegacyV1Row = Record<string, unknown>;

export type LegacyV1Dump = Partial<Record<LegacyV1Table, LegacyV1Row[]>> & Record<string, unknown>;

export type LegacySqlValue = string | number | null;

export interface LegacyV1TablePlan {
  table: LegacyV1Table;
  columns: string[];
  rows: LegacySqlValue[][];
}

/**
 * Columns `MigrationService`'s SQL names in WHERE / ORDER BY / JOIN clauses. They must
 * exist even when no row in the dump carries them, or the query fails instead of
 * reading NULL.
 */
const REQUIRED_COLUMNS: Record<LegacyV1Table, readonly string[]> = {
  FitnessGoals: ['id', 'deletedAt'],
  UserMetrics: ['id', 'deletedAt'],
  User: ['id', 'deletedAt'],
  Food: ['id', 'deletedAt'],
  UserNutrition: ['id', 'deletedAt'],
  Exercise: ['id', 'deletedAt'],
  Workout: ['id', 'deletedAt'],
  WorkoutEvent: ['id', 'deletedAt'],
  Set: ['id', 'deletedAt', 'workoutId', 'setOrder'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A 1.x dump has no `_exportVersion` (every 2.0 export does, Game Boy ones included
 * once expanded) and at least one of the 1.x tables as an array.
 */
export function isLegacyV1Dump(value: unknown): value is LegacyV1Dump {
  if (!isRecord(value) || '_exportVersion' in value) {
    return false;
  }

  return LEGACY_V1_TABLES.some((table) => Array.isArray(value[table]));
}

/**
 * Values go into untyped columns, which store exactly what is bound, so the migration
 * reads back the same types the 1.x database returned. Only booleans and objects need
 * converting: a web (Dexie) export can hold them, SQLite cannot.
 */
export function toLegacySqlValue(value: unknown): LegacySqlValue {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return JSON.stringify(value);
}

/** One plan per 1.x table: the union of the rows' columns plus the required ones. */
export function planLegacyV1Tables(dump: LegacyV1Dump): LegacyV1TablePlan[] {
  return LEGACY_V1_TABLES.map((table) => {
    const source = dump[table];
    const rows = Array.isArray(source) ? source.filter(isRecord) : [];
    const columns = [...REQUIRED_COLUMNS[table]];
    const seen = new Set(columns);

    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!seen.has(column)) {
          seen.add(column);
          columns.push(column);
        }
      }
    }

    return {
      table,
      columns,
      rows: rows.map((row) => columns.map((column) => toLegacySqlValue(row[column]))),
    };
  });
}

/** Column names come from the backup file, so they are quoted, never trusted. */
export function quoteSqlIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function legacyCreateTableSql(plan: LegacyV1TablePlan): string {
  return `CREATE TABLE ${quoteSqlIdentifier(plan.table)} (${plan.columns
    .map(quoteSqlIdentifier)
    .join(', ')});`;
}

export function legacyInsertSql(plan: LegacyV1TablePlan): string {
  return `INSERT INTO ${quoteSqlIdentifier(plan.table)} (${plan.columns
    .map(quoteSqlIdentifier)
    .join(', ')}) VALUES (${plan.columns.map(() => '?').join(', ')});`;
}
