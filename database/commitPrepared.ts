import type { Database, Model } from '@nozbe/watermelondb';

/** WatermelonDB prepares updates in its model cache before SQLite/Loki commits them. */
export async function commitPrepared(
  db: Database,
  existing: Model[],
  prepare: () => Model[]
): Promise<void> {
  const snapshots = existing.map((record) => ({
    record,
    raw: { ...record._raw },
    state: record._preparedState,
  }));
  try {
    const operations = prepare();
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
