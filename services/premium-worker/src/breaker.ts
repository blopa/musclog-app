// Kill switch (plan 8.3). meta keys: breaker ('open'), breaker_reason, overruns (JSON array of
// ms timestamps in the last 24 h). The breaker is opened by code and closed only by hand
// (runbook); nothing here ever closes it.
import { stmt } from './db';

export type BreakerReason =
  | 'global_spend'
  | 'zdr_unavailable'
  | 'zdr_check_failed'
  | 'reconciliation'
  | 'overruns'
  | 'upstream_402'
  | 'upstream_403';

const UPSERT_IF_CHANGED = `ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`;

/** Opens the breaker; writes only when the stored value differs. */
export function openBreakerStatements(
  db: D1Database,
  reason: BreakerReason
): D1PreparedStatement[] {
  return [
    stmt(db, `INSERT INTO meta (key, value) VALUES ('breaker', 'open') ${UPSERT_IF_CHANGED}`, {}),
    stmt(
      db,
      `INSERT INTO meta (key, value) VALUES ('breaker_reason', :reason) ${UPSERT_IF_CHANGED}`,
      { reason }
    ),
  ];
}

export async function openBreaker(db: D1Database, reason: BreakerReason): Promise<void> {
  await db.batch(openBreakerStatements(db, reason));
}

export async function isBreakerOpen(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM meta WHERE key = 'breaker'")
    .first<{ value: string }>();
  return row?.value === 'open';
}

const DAY_MS = 86_400_000;

/**
 * Records one overrun (a settle above its reservation) and opens the breaker, in the same batch,
 * once `limit` overruns fall in the last 24 h.
 */
export function recordOverrunStatements(
  db: D1Database,
  now: number,
  limit: number
): D1PreparedStatement[] {
  const p = { now, since: now - DAY_MS, limit };
  const reached = `(SELECT json_array_length(value) FROM meta WHERE key = 'overruns') >= :limit`;
  return [
    stmt(
      db,
      `INSERT INTO meta (key, value) VALUES ('overruns', json_array(CAST(:now AS INTEGER)))
       ON CONFLICT(key) DO UPDATE SET value = (
         SELECT json_group_array(v) FROM (
           SELECT value AS v FROM json_each(meta.value) WHERE value > :since
           UNION ALL SELECT CAST(:now AS INTEGER)
         ))`,
      p
    ),
    stmt(
      db,
      `INSERT INTO meta (key, value) SELECT 'breaker', 'open' WHERE ${reached} ${UPSERT_IF_CHANGED}`,
      p
    ),
    stmt(
      db,
      `INSERT INTO meta (key, value) SELECT 'breaker_reason', 'overruns' WHERE ${reached} ${UPSERT_IF_CHANGED}`,
      p
    ),
  ];
}
