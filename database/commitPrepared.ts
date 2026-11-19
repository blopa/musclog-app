import type { Database, Model } from '@nozbe/watermelondb';

export type CommitFailure = { message: string; at: number; recordCount: number };

let lastCommitFailure: CommitFailure | null = null;

/** The most recent failed `commitPrepared` of this session, for diagnostics only. */
export function getLastCommitFailure(): CommitFailure | null {
  return lastCommitFailure;
}

export type StalePendingRecord = { table: string; id: string; state: string };

/**
 * WatermelonDB prepares updates in its model cache before SQLite/Loki commits them.
 *
 * `prepare` may be async (it can still read), but every existing record it will touch must be in
 * `existing`: a `prepareUpdate` that throws part-way leaves the records prepared before it with a
 * pending state, and WatermelonDB then rejects every later update of them ("Cannot update a record
 * with pending changes") until the app restarts. The snapshot is what puts them back.
 */
export async function commitPrepared(
  db: Database,
  existing: Model[],
  prepare: () => Model[] | Promise<Model[]>
): Promise<void> {
  const snapshots = existing.map((record) => ({
    record,
    raw: { ...record._raw },
    state: record._preparedState,
  }));
  try {
    const operations = await prepare();
    if (operations.length) {
      await db.batch(...operations);
    }
  } catch (error) {
    lastCommitFailure = {
      message: error instanceof Error ? error.message : String(error),
      at: Date.now(),
      recordCount: existing.length,
    };
    for (const { record, raw, state } of snapshots) {
      record._raw = raw;
      record._preparedState = state;
    }

    throw error;
  }
}

/**
 * Drops a pending state that nothing is going to commit, and returns what it dropped.
 *
 * Call it inside the writer, before preparing, for records the caller is about to prepare itself.
 * Writers are serialised and `Database.batch` clears the state of everything it sends, so a record
 * still pending at that point was left behind by a prepare that never reached a batch. Without
 * this, one such leftover makes every later save of the record throw "Cannot update a record with
 * pending changes" until the app restarts (Sentry: `workout_template_sets`, 2.16.5). The record's
 * `_raw` keeps whatever the abandoned prepare wrote, which the new prepare overwrites field by
 * field. The caller should report a non-empty result: it means something upstream leaked, and the
 * leak itself is still unexplained.
 */
export function clearStalePending(records: Model[]): StalePendingRecord[] {
  const cleared: StalePendingRecord[] = [];
  for (const record of records) {
    if (record._preparedState) {
      cleared.push({
        table: (record.constructor as { table?: string }).table ?? 'unknown',
        id: record.id,
        state: String(record._preparedState),
      });
      record._preparedState = null;
    }
  }

  return cleared;
}
