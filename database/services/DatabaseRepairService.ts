import { Model, Q } from '@nozbe/watermelondb';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { DATABASE_NAME } from '@/constants/database';
import { database } from '@/database/database-instance';
import { handleError } from '@/utils/handleError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrityIssue = {
  table: string;
  message: string;
  rowId?: number;
};

export interface ChildSpec {
  table: string;
  /** Column in THIS table that points to the parent's `id`. */
  fkColumn: string;
  children?: ChildSpec[];
}

export interface TableGroupDescriptor {
  rootTable: string;
  children: ChildSpec[];
}

export interface DatabaseRepairResult {
  attempted: boolean;
  repaired: boolean;
  reindexed: boolean;
  deletedRootIds: string[];
  issues: IntegrityIssue[];
}

// ---------------------------------------------------------------------------
// Descriptors for every table group in the app
// ---------------------------------------------------------------------------

export const REPAIR_DESCRIPTORS = {
  workoutLogs: {
    rootTable: 'workout_logs',
    children: [
      {
        table: 'workout_log_exercises',
        fkColumn: 'workout_log_id',
        children: [{ table: 'workout_log_sets', fkColumn: 'log_exercise_id' }],
      },
    ],
  },
  workoutTemplates: {
    rootTable: 'workout_templates',
    children: [
      {
        table: 'workout_template_exercises',
        fkColumn: 'template_id',
        children: [{ table: 'workout_template_sets', fkColumn: 'template_exercise_id' }],
      },
      { table: 'schedules', fkColumn: 'template_id' },
      // workout_logs reference template_id but are NOT cascade-deleted with templates
    ],
  },
  nutritionLogs: {
    rootTable: 'nutrition_logs',
    // Leaf table — corrupt rows are soft-deleted directly, no children
    children: [],
  },
  userMetrics: {
    rootTable: 'user_metrics',
    children: [{ table: 'user_metrics_notes', fkColumn: 'user_metric_id' }],
  },
  nutritionGoals: {
    rootTable: 'nutrition_goals',
    children: [{ table: 'nutrition_checkins', fkColumn: 'nutrition_goal_id' }],
  },
  savedForLater: {
    rootTable: 'saved_for_later_groups',
    children: [{ table: 'saved_for_later_items', fkColumn: 'group_id' }],
  },
  meals: {
    rootTable: 'meals',
    children: [
      { table: 'meal_foods', fkColumn: 'meal_id' },
      { table: 'meal_food_portions', fkColumn: 'meal_id' },
    ],
  },
  foods: {
    rootTable: 'foods',
    children: [{ table: 'food_food_portions', fkColumn: 'food_id' }],
  },
} satisfies Record<string, TableGroupDescriptor>;

// ---------------------------------------------------------------------------
// Resolution chain — maps each table to the sequence of SQL lookups needed
// to walk from a corrupt row (rowid) up to the root record's id.
// ---------------------------------------------------------------------------

type LookupStep = {
  table: string;
  selectCol: string;
  whereCol: 'rowid' | 'id';
};

function buildResolutionChains(descriptor: TableGroupDescriptor): Map<string, LookupStep[]> {
  const chains = new Map<string, LookupStep[]>();

  chains.set(descriptor.rootTable, [
    { table: descriptor.rootTable, selectCol: 'id', whereCol: 'rowid' },
  ]);

  function traverse(specs: ChildSpec[], ancestorSteps: LookupStep[]): void {
    for (const spec of specs) {
      chains.set(spec.table, [
        { table: spec.table, selectCol: spec.fkColumn, whereCol: 'rowid' },
        ...ancestorSteps,
      ]);

      if (spec.children?.length) {
        traverse(spec.children, [
          { table: spec.table, selectCol: spec.fkColumn, whereCol: 'id' },
          ...ancestorSteps,
        ]);
      }
    }
  }

  traverse(descriptor.children, []);
  return chains;
}

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

function isLikelyCorruptionError(error: unknown): boolean {
  // TODO: use a util function to avoid having nested ternary
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return [
    'SQLITE_IOERR_SHORT_READ',
    'SQLiteDiskIOException',
    'database disk image is malformed',
    'SQLITE_CORRUPT',
    'SQLITE_NOTADB',
    'database or disk is full',
    'code 522',
  ].some((needle) => message.includes(needle));
}

function wdbDir(): string {
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

function openRawDatabase(): SQLiteDatabase | null {
  if (Platform.OS === 'web') {
    return null;
  }

  const directory = wdbDir();
  if (!directory) {
    return null;
  }

  try {
    return openDatabaseSync(`${DATABASE_NAME}.db`, { useNewConnection: true }, directory);
  } catch (error) {
    handleError(error, 'DatabaseRepairService.openRawDatabase');
    return null;
  }
}

function readSingleColumnValue(row: Record<string, unknown> | undefined): string | null {
  if (!row) {
    return null;
  }

  const value = Object.values(row)[0];
  if (value == null) {
    return null;
  }

  return String(value);
}

function parseIntegrityIssue(table: string, message: string): IntegrityIssue {
  const rowMatch = message.match(/\brow\s+(\d+)\s+/i);
  return {
    table,
    message,
    rowId: rowMatch ? Number(rowMatch[1]) : undefined,
  };
}

// Runs a single full PRAGMA integrity_check and filters to issues that mention
// one of the watched tables. PRAGMA integrity_check(N) only accepts an integer;
// table-name arguments are not valid SQLite syntax.
//
// SQLite sometimes reports corruption via page numbers or index names that don't
// directly contain the table name (e.g. "on page 42" with no table reference).
// Those rows are still returned — attributed to the root table with no rowId —
// so the caller knows repair is needed even if we can't resolve a specific record.
async function collectIntegrityIssues(
  db: SQLiteDatabase,
  watchedTables: ReadonlySet<string>,
  rootTable: string
): Promise<IntegrityIssue[]> {
  try {
    const rows = (await db.getAllAsync('PRAGMA integrity_check;')) as Record<string, unknown>[];
    const issues: IntegrityIssue[] = [];

    for (const row of rows) {
      const message = readSingleColumnValue(row);
      if (!message || message === 'ok') {
        continue;
      }

      const matchedTable = [...watchedTables].find((t) => message.includes(t));
      // Attribute unmatched issues to the root table — no rowId, so
      // resolveRootIdsFromIssues will skip them, but their presence still
      // signals that reindex / soft-delete should be attempted.
      issues.push(parseIntegrityIssue(matchedTable ?? rootTable, message));
    }

    return issues;
  } catch (error) {
    // If the PRAGMA itself errors, the DB state is unknowable — treat as an issue.
    return [
      {
        table: rootTable,
        message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      },
    ];
  }
}

async function querySingleValue(
  db: SQLiteDatabase,
  sql: string,
  args: (string | number | boolean | null)[]
): Promise<string | null> {
  try {
    const rows = (await db.getAllAsync(sql, args)) as Record<string, unknown>[];
    return readSingleColumnValue(rows[0]);
  } catch {
    return null;
  }
}

async function resolveRootIdsFromIssues(
  db: SQLiteDatabase,
  issues: IntegrityIssue[],
  chains: Map<string, LookupStep[]>
): Promise<string[]> {
  const rootIds = new Set<string>();

  for (const issue of issues) {
    if (issue.rowId == null) {
      continue;
    }

    const chain = chains.get(issue.table);
    if (!chain) {
      continue;
    }

    let currentValue: string | number = issue.rowId;
    let failed = false;

    for (const step of chain) {
      const result = await querySingleValue(
        db,
        `SELECT ${step.selectCol} FROM ${step.table} WHERE ${step.whereCol} = ? LIMIT 1`,
        [currentValue]
      );

      if (!result) {
        failed = true;
        break;
      }

      currentValue = result;
    }

    if (!failed && currentValue != null) {
      rootIds.add(String(currentValue));
    }
  }

  return [...rootIds];
}

async function reindexTables(tableNames: readonly string[]): Promise<boolean> {
  try {
    await database.adapter.unsafeExecute({
      sqls: tableNames.map((table) => [`REINDEX "${table}"`, []]),
    });
    return true;
  } catch (error) {
    handleError(error, 'DatabaseRepairService.reindexTables');
    return false;
  }
}

// Recursively soft-deletes children (depth-first) then the parent record.
// Must be called from within an open database.write() block.
async function cascadeMarkDeleted(
  writer: Parameters<Parameters<typeof database.write>[0]>[0],
  records: Model[],
  childSpecs: ChildSpec[]
): Promise<void> {
  for (const record of records) {
    for (const spec of childSpecs) {
      const children = await database
        .get<Model>(spec.table)
        .query(Q.where(spec.fkColumn, record.id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      await cascadeMarkDeleted(writer, children, spec.children ?? []);
    }

    await writer.callWriter(() => record.markAsDeleted());
  }
}

async function softDeleteRootRecords(
  rootIds: string[],
  descriptor: TableGroupDescriptor
): Promise<void> {
  const uniqueIds = [...new Set(rootIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return;
  }

  // One write transaction per root so each deletion is atomic: if anything
  // fails mid-tree the entire transaction rolls back, leaving that root's
  // graph untouched rather than in a partially-deleted state.
  for (const rootId of uniqueIds) {
    try {
      await database.write(async (writer) => {
        const rootRecord = await database.get<Model>(descriptor.rootTable).find(rootId);

        for (const childSpec of descriptor.children) {
          const children = await database
            .get<Model>(childSpec.table)
            .query(Q.where(childSpec.fkColumn, rootId), Q.where('deleted_at', Q.eq(null)))
            .fetch();

          await cascadeMarkDeleted(writer, children, childSpec.children ?? []);
        }

        await writer.callWriter(() => rootRecord.markAsDeleted());
      });
    } catch (error) {
      handleError(error, 'DatabaseRepairService.softDeleteRootRecords');
      // Log and continue — don't let one failed deletion abort the rest.
    }
  }
}

function allTablesInDescriptor(descriptor: TableGroupDescriptor): string[] {
  const tables: string[] = [descriptor.rootTable];

  function collect(specs: ChildSpec[]): void {
    for (const spec of specs) {
      tables.push(spec.table);
      if (spec.children?.length) {
        collect(spec.children);
      }
    }
  }

  collect(descriptor.children);
  return tables;
}

// ---------------------------------------------------------------------------
// Core repair orchestration
// ---------------------------------------------------------------------------

async function runRepair(
  error: unknown,
  descriptor: TableGroupDescriptor
): Promise<DatabaseRepairResult> {
  const result: DatabaseRepairResult = {
    attempted: true,
    repaired: false,
    reindexed: false,
    deletedRootIds: [],
    issues: [],
  };

  if (!isLikelyCorruptionError(error)) {
    result.attempted = false;
    return result;
  }

  const db = openRawDatabase();
  if (!db) {
    return result;
  }

  const tables = allTablesInDescriptor(descriptor);
  const watchedTables = new Set(tables);
  const chains = buildResolutionChains(descriptor);

  try {
    const initialIssues = await collectIntegrityIssues(db, watchedTables, descriptor.rootTable);
    result.issues = initialIssues;

    result.reindexed = await reindexTables(tables);

    const postReindexIssues = await collectIntegrityIssues(db, watchedTables, descriptor.rootTable);
    if (postReindexIssues.length === 0) {
      result.repaired = true;
      return result;
    }

    // postReindexIssues.length > 0 is guaranteed here.
    const rootIdsToDelete = await resolveRootIdsFromIssues(db, postReindexIssues, chains);

    if (rootIdsToDelete.length === 0) {
      return result;
    }

    await softDeleteRootRecords(rootIdsToDelete, descriptor);
    result.deletedRootIds = rootIdsToDelete;

    result.reindexed = (await reindexTables(tables)) || result.reindexed;

    const finalIssues = await collectIntegrityIssues(db, watchedTables, descriptor.rootTable);
    result.repaired = finalIssues.length === 0;
    result.issues = finalIssues.length > 0 ? finalIssues : postReindexIssues;

    return result;
  } finally {
    try {
      db.closeSync();
    } catch {
      // best effort
    }
  }
}

// ---------------------------------------------------------------------------
// Per-group in-flight deduplication
// ---------------------------------------------------------------------------

const repairsInFlight = new Map<string, Promise<DatabaseRepairResult>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class DatabaseRepairService {
  static async repairIfNeeded(
    error: unknown,
    descriptor: TableGroupDescriptor
  ): Promise<DatabaseRepairResult> {
    if (!isLikelyCorruptionError(error)) {
      return {
        attempted: false,
        repaired: false,
        reindexed: false,
        deletedRootIds: [],
        issues: [],
      };
    }

    const key = descriptor.rootTable;
    const existing = repairsInFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = runRepair(error, descriptor)
      .catch((repairError) => {
        handleError(repairError, 'DatabaseRepairService.repairIfNeeded');
        return {
          attempted: true,
          repaired: false,
          reindexed: false,
          deletedRootIds: [],
          issues: [],
        };
      })
      .finally(() => {
        repairsInFlight.delete(key);
      });

    repairsInFlight.set(key, promise);
    return promise;
  }
}

/**
 * Convenience wrapper used by service catch blocks.
 * Attempts repair; if something was fixed, retries the operation once.
 * Returns null if repair had no effect or the retry also failed.
 */
export async function retryAfterRepair<T>(
  error: unknown,
  descriptor: TableGroupDescriptor,
  retry: () => Promise<T>
): Promise<T | null> {
  const repair = await DatabaseRepairService.repairIfNeeded(error, descriptor);

  if (!repair.attempted || (!repair.reindexed && repair.deletedRootIds.length === 0)) {
    return null;
  }

  try {
    return await retry();
  } catch (retryError) {
    handleError(retryError, 'DatabaseRepairService.retryAfterRepair');
    return null;
  }
}
