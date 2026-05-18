import { Q } from '@nozbe/watermelondb';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { DATABASE_NAME } from '@/constants/database';
import { database } from '@/database/database-instance';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { clearActiveWorkoutLogId, getActiveWorkoutLogId } from '@/utils/activeWorkoutStorage';
import { handleError } from '@/utils/handleError';

type IntegrityIssue = {
  table: string;
  message: string;
  rowId?: number;
};

export type WorkoutDatabaseRepairResult = {
  attempted: boolean;
  repaired: boolean;
  reindexed: boolean;
  deletedWorkoutIds: string[];
  issues: IntegrityIssue[];
};

const WORKOUT_TABLES = ['workout_logs', 'workout_log_exercises', 'workout_log_sets'] as const;

let repairInFlight: Promise<WorkoutDatabaseRepairResult> | null = null;

function wdbDir(): string {
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

function isLikelyCorruptionError(error: unknown): boolean {
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

// openDatabaseSync is synchronous; no async wrapper needed.
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
    handleError(error, 'WorkoutDatabaseRecoveryService.openRawDatabase');
    return null;
  }
}

// Runs a single full integrity_check (PRAGMA integrity_check(N) accepts only an integer,
// not a table name) and filters results to issues that name a workout table.
async function collectIntegrityIssues(db: SQLiteDatabase): Promise<IntegrityIssue[]> {
  try {
    const rows = (await db.getAllAsync('PRAGMA integrity_check;')) as Record<string, unknown>[];
    const issues: IntegrityIssue[] = [];

    for (const row of rows) {
      const message = readSingleColumnValue(row);
      if (!message || message === 'ok') {
        continue;
      }

      const matchedTable = WORKOUT_TABLES.find((t) => message.includes(t));
      if (matchedTable) {
        issues.push(parseIntegrityIssue(matchedTable, message));
      }
    }

    return issues;
  } catch (error) {
    // If the PRAGMA itself errors the DB state is unknowable; treat as an issue.
    return [
      {
        table: WORKOUT_TABLES[0],
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

async function resolveWorkoutIdsFromIssues(
  db: SQLiteDatabase,
  issues: IntegrityIssue[]
): Promise<string[]> {
  const workoutIds = new Set<string>();

  for (const issue of issues) {
    if (issue.rowId == null) {
      continue;
    }

    if (issue.table === 'workout_logs') {
      const workoutId = await querySingleValue(
        db,
        'SELECT id FROM workout_logs WHERE rowid = ? LIMIT 1',
        [issue.rowId]
      );
      if (workoutId) {
        workoutIds.add(workoutId);
      }
      continue;
    }

    if (issue.table === 'workout_log_exercises') {
      const workoutId = await querySingleValue(
        db,
        'SELECT workout_log_id FROM workout_log_exercises WHERE rowid = ? LIMIT 1',
        [issue.rowId]
      );
      if (workoutId) {
        workoutIds.add(workoutId);
      }
      continue;
    }

    if (issue.table === 'workout_log_sets') {
      const logExerciseId = await querySingleValue(
        db,
        'SELECT log_exercise_id FROM workout_log_sets WHERE rowid = ? LIMIT 1',
        [issue.rowId]
      );
      if (!logExerciseId) {
        continue;
      }

      const workoutId =
        (await querySingleValue(
          db,
          'SELECT workout_log_id FROM workout_log_exercises WHERE id = ? LIMIT 1',
          [logExerciseId]
        )) ??
        (await querySingleValue(
          db,
          'SELECT workout_log_id FROM workout_log_exercises WHERE rowid = (SELECT rowid FROM workout_log_exercises WHERE id = ? LIMIT 1) LIMIT 1',
          [logExerciseId]
        ));

      if (workoutId) {
        workoutIds.add(workoutId);
      }
    }
  }

  return [...workoutIds];
}

async function reindexWorkoutTables(): Promise<boolean> {
  try {
    await database.adapter.unsafeExecute({
      sqls: WORKOUT_TABLES.map((table) => [`REINDEX "${table}"`, []]),
    });
    return true;
  } catch (error) {
    handleError(error, 'WorkoutDatabaseRecoveryService.reindexWorkoutTables');
    return false;
  }
}

async function softDeleteWorkoutLogs(workoutIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(workoutIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return;
  }

  await database.write(async (writer) => {
    for (const workoutLogId of uniqueIds) {
      try {
        const activeWorkoutLogId = await getActiveWorkoutLogId();
        const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

        await writer.callWriter(() => workoutLog.markAsDeleted());

        const logExercises = await database
          .get<WorkoutLogExercise>('workout_log_exercises')
          .query(Q.where('workout_log_id', workoutLogId), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        for (const logExercise of logExercises) {
          const sets = await database
            .get<WorkoutLogSet>('workout_log_sets')
            .query(Q.where('log_exercise_id', logExercise.id), Q.where('deleted_at', Q.eq(null)))
            .fetch();

          for (const set of sets) {
            await writer.callWriter(() => set.markAsDeleted());
          }

          await writer.callWriter(() => logExercise.markAsDeleted());
        }

        if (activeWorkoutLogId === workoutLogId) {
          await clearActiveWorkoutLogId();
        }
      } catch (error) {
        handleError(error, 'WorkoutDatabaseRecoveryService.softDeleteWorkoutLogs');
        // Log and continue — don't let one failed deletion abort the rest.
      }
    }
  });
}

async function repairWorkoutDatabase(error: unknown): Promise<WorkoutDatabaseRepairResult> {
  const result: WorkoutDatabaseRepairResult = {
    attempted: true,
    repaired: false,
    reindexed: false,
    deletedWorkoutIds: [],
    issues: [],
  };

  if (!isLikelyCorruptionError(error)) {
    result.attempted = false;
    return result;
  }

  // Open a single raw connection for all PRAGMA reads; close it in the finally block.
  const db = openRawDatabase();
  if (!db) {
    return result;
  }

  try {
    const initialIssues = await collectIntegrityIssues(db);
    result.issues = initialIssues;

    result.reindexed = await reindexWorkoutTables();

    const postReindexIssues = await collectIntegrityIssues(db);
    if (postReindexIssues.length === 0) {
      result.repaired = true;
      return result;
    }

    // postReindexIssues.length > 0 is guaranteed here; no fallback to initialIssues needed.
    const workoutIdsToDelete = await resolveWorkoutIdsFromIssues(db, postReindexIssues);

    if (workoutIdsToDelete.length === 0) {
      return result;
    }

    await softDeleteWorkoutLogs(workoutIdsToDelete);
    result.deletedWorkoutIds = workoutIdsToDelete;

    result.reindexed = (await reindexWorkoutTables()) || result.reindexed;

    const finalIssues = await collectIntegrityIssues(db);
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

export class WorkoutDatabaseRecoveryService {
  static async repairIfNeeded(error: unknown): Promise<WorkoutDatabaseRepairResult> {
    if (!isLikelyCorruptionError(error)) {
      return {
        attempted: false,
        repaired: false,
        reindexed: false,
        deletedWorkoutIds: [],
        issues: [],
      };
    }

    if (repairInFlight) {
      return repairInFlight;
    }

    repairInFlight = repairWorkoutDatabase(error)
      .catch((repairError) => {
        handleError(repairError, 'WorkoutDatabaseRecoveryService.repairIfNeeded');
        return {
          attempted: true,
          repaired: false,
          reindexed: false,
          deletedWorkoutIds: [],
          issues: [],
        };
      })
      .finally(() => {
        repairInFlight = null;
      });

    return repairInFlight;
  }
}
