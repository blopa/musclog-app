import { Model, Q } from '@nozbe/watermelondb';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  type ChildSpec,
  DATABASE_NAME,
  REPAIR_DESCRIPTORS,
  type TableGroupDescriptor,
} from '@/constants/database';
import { database } from '@/database/database-instance';
import { deleteBleDataPointsFiles } from '@/utils/bleWorkoutDataStorage';
import { handleError } from '@/utils/handleError';

export type { ChildSpec, TableGroupDescriptor }; // TODO: is this necessary?
export { REPAIR_DESCRIPTORS }; // TODO: is this necessary?

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrityIssue = {
  table: string;
  message: string;
  rowId?: number;
};

export interface DatabaseRepairResult {
  attempted: boolean;
  repaired: boolean;
  reindexed: boolean;
  deletedRootIds: string[];
  issues: IntegrityIssue[];
}

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
      if (matchedTable) {
        // Known table — extract rowId so the resolver can walk up the chain.
        issues.push(parseIntegrityIssue(matchedTable, message));
      } else {
        // Table name not in the message (page-level or index-only report).
        // Include without a rowId: the resolver will skip it, but its presence
        // keeps postReindexIssues.length > 0 so repair still proceeds.
        issues.push({ table: rootTable, message });
      }
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
// When collectByTable is provided, each deleted record's ID is appended to the
// corresponding table entry so callers can do post-write cleanup (e.g. files).
async function cascadeMarkDeleted(
  writer: Parameters<Parameters<typeof database.write>[0]>[0],
  records: Model[],
  childSpecs: ChildSpec[],
  collectByTable?: Map<string, string[]>
): Promise<void> {
  for (const record of records) {
    for (const spec of childSpecs) {
      const children = await database
        .get<Model>(spec.table)
        .query(Q.where(spec.fkColumn, record.id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      await cascadeMarkDeleted(writer, children, spec.children ?? [], collectByTable);
    }

    if (collectByTable) {
      const table = (record.constructor as typeof Model).table;
      const arr = collectByTable.get(table);
      if (arr) {
        arr.push(record.id);
      } else {
        collectByTable.set(table, [record.id]);
      }
    }

    await writer.callWriter(() => record.markAsDeleted());
  }
}

// Returns the IDs that were actually successfully soft-deleted (may be fewer than
// the input if individual deletions fail and roll back).
async function softDeleteRootRecords(
  rootIds: string[],
  descriptor: TableGroupDescriptor
): Promise<string[]> {
  const uniqueIds = [...new Set(rootIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return [];
  }

  const deletedIds: string[] = [];

  // One write transaction per root so each deletion is atomic: if anything
  // fails mid-tree the entire transaction rolls back, leaving that root's
  // graph untouched rather than in a partially-deleted state.
  for (const rootId of uniqueIds) {
    const collectByTable = new Map<string, string[]>();
    try {
      await database.write(async (writer) => {
        const rootRecord = await database.get<Model>(descriptor.rootTable).find(rootId);

        for (const childSpec of descriptor.children) {
          const children = await database
            .get<Model>(childSpec.table)
            .query(Q.where(childSpec.fkColumn, rootId), Q.where('deleted_at', Q.eq(null)))
            .fetch();

          await cascadeMarkDeleted(writer, children, childSpec.children ?? [], collectByTable);
        }

        await writer.callWriter(() => rootRecord.markAsDeleted());
      });
      deletedIds.push(rootId);

      const deletedSetIds = collectByTable.get('workout_log_sets') ?? [];
      void deleteBleDataPointsFiles(deletedSetIds).catch(() => {});
    } catch (error) {
      handleError(error, 'DatabaseRepairService.softDeleteRootRecords');
      // Log and continue — don't let one failed deletion abort the rest.
    }
  }

  return deletedIds;
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

    result.deletedRootIds = await softDeleteRootRecords(rootIdsToDelete, descriptor);

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
 * Returns `undefined` if repair had no effect or the retry also failed,
 * so callers can safely check `repaired !== undefined` even when T includes null.
 */
export async function retryAfterRepair<T>(
  error: unknown,
  descriptor: TableGroupDescriptor,
  retry: () => Promise<T>
): Promise<T | undefined> {
  const repair = await DatabaseRepairService.repairIfNeeded(error, descriptor);

  if (!repair.attempted || (!repair.reindexed && repair.deletedRootIds.length === 0)) {
    return undefined;
  }

  try {
    return await retry();
  } catch (retryError) {
    handleError(retryError, 'DatabaseRepairService.retryAfterRepair');
    return undefined;
  }
}
