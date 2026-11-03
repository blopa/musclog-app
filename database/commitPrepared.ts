import type { Database, Model } from '@nozbe/watermelondb';

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
    for (const { record, raw, state } of snapshots) {
      record._raw = raw;
      record._preparedState = state;
    }

    throw error;
  }
}
