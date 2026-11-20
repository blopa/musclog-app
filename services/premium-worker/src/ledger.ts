// D1 budget ledger (plan 8.2). SQL moved verbatim from spikes/premium-p0/ledger/ledger.ts, with
// the revision 3 changes: reservations carry body_hash (an Idempotency-Key bound to its body),
// and an overrun settle records itself for the breaker in the same batch.
import { recordOverrunStatements } from './breaker';
import { stmt, type Params } from './db';
import { DAY_MS } from './finance';

export { DAY_MS };

const GUARDS = `
  NOT EXISTS (SELECT 1 FROM meta WHERE key = 'breaker' AND value = 'open')
  AND COALESCE((SELECT value FROM meta WHERE key = 'daily_full'), '0') = '0'
  AND EXISTS (SELECT 1 FROM devices d WHERE d.rc_id = :rc AND d.status = 'active')
  AND EXISTS (SELECT 1 FROM periods p WHERE p.payment_key = :pk AND p.status = 'active'
        AND :now >= p.period_start AND :now < p.period_end
        AND p.spent_u + p.reserved_u + :r <= CASE WHEN :now < p.early_until THEN p.early_cap_u ELSE p.cap_u END
        AND (CASE WHEN p.day = :day THEN p.day_spent_u ELSE 0 END) + p.reserved_u + :r <= p.daily_cap_u
        AND (CASE WHEN p.day = :day THEN p.day_requests ELSE 0 END) < :max_requests_per_day
        AND p.inflight < :max_inflight)`;

export const RESERVE_INSERT = `INSERT OR IGNORE INTO reservations
  (payment_key, req_id, body_hash, reserved_u, state, hold_token, created_at, expires_at)
  SELECT :pk, :id, :bh, :r, 'pending', :hold, :now, :exp WHERE ${GUARDS}`;

export const RESERVE_READMIT = `UPDATE reservations SET state = 'pending', hold_token = :hold, reserved_u = :r,
  created_at = :now, expires_at = :exp, settled_u = NULL, settled_at = NULL
  WHERE payment_key = :pk AND req_id = :id AND state = 'refunded' AND body_hash = :bh AND ${GUARDS}`;

export const RESERVE_PERIOD = `UPDATE periods SET
    reserved_u = reserved_u + (SELECT reserved_u FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'pending'),
    inflight = inflight + 1, last_activity_at = :now
  WHERE payment_key = :pk
    AND EXISTS (SELECT 1 FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'pending')`;

export const RESERVE_HOLD = `UPDATE reservations SET state = 'held'
  WHERE payment_key = :pk AND req_id = :id AND state = 'pending'`;

export const SETTLE_PERIOD = `UPDATE periods SET
    spent_u = spent_u + :a,
    reserved_u = reserved_u - (SELECT reserved_u FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'held'),
    inflight = inflight - 1,
    day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + :a,
    day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1,
    day = :day
  WHERE payment_key = :pk
    AND EXISTS (SELECT 1 FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'held')`;

export const SETTLE_RES = `UPDATE reservations SET state = :final, settled_u = :a, settled_at = :now
  WHERE payment_key = :pk AND req_id = :id AND state = 'held'`;

export type ReservationState = 'pending' | 'held' | 'settled' | 'refunded' | 'expired';

export interface ReservationRow {
  payment_key: string;
  req_id: string;
  body_hash: string;
  reserved_u: number;
  settled_u: number | null;
  state: ReservationState;
  hold_token: string;
  created_at: number;
  expires_at: number;
  settled_at: number | null;
}

export interface PeriodRow {
  payment_key: string;
  lineage_key: string;
  rc_subscription_id: string;
  store: 'app_store' | 'play_store';
  period_start: number;
  period_end: number;
  proceeds_u: number;
  net_proceeds_u: number;
  cap_u: number;
  early_cap_u: number;
  early_until: number;
  daily_cap_u: number;
  spent_u: number;
  reserved_u: number;
  inflight: number;
  day: string;
  day_spent_u: number;
  day_requests: number;
  status: 'active' | 'revoked';
  last_activity_at: number;
  created_at: number;
}

export interface ReserveInput {
  pk: string;
  id: string;
  rc: string;
  /** Body hash bound to the Idempotency-Key. */
  bh: string;
  r: number;
  hold: string;
  now: number;
  ttlMs?: number;
  day: string;
  maxReq: number;
  maxInflight: number;
}
export type ReserveOutcome =
  | 'admitted'
  | 'in_progress'
  | 'already_processed'
  | 'idempotency_mismatch'
  | 'budget_exhausted'
  | 'daily_limit'
  | 'busy'
  | 'hosted_disabled'
  | 'daily_full'
  | 'no_period'
  | 'no_device';

const rp = (i: ReserveInput): Params => ({
  pk: i.pk,
  id: i.id,
  rc: i.rc,
  bh: i.bh,
  r: i.r,
  hold: i.hold,
  now: i.now,
  exp: i.now + (i.ttlMs ?? 120000),
  day: i.day,
  max_requests_per_day: i.maxReq,
  max_inflight: i.maxInflight,
});

/** Statements of one reserve attempt. `readmit` swaps statement 1 for the refunded variant. */
export function reserveStatements(
  db: D1Database,
  i: ReserveInput,
  readmit = false
): D1PreparedStatement[] {
  const p = rp(i);
  return [
    stmt(db, readmit ? RESERVE_READMIT : RESERVE_INSERT, p),
    stmt(db, RESERVE_PERIOD, p),
    stmt(db, RESERVE_HOLD, p),
  ];
}

export async function getReservation(
  db: D1Database,
  pk: string,
  id: string
): Promise<ReservationRow | null> {
  return db
    .prepare('SELECT * FROM reservations WHERE payment_key = ?1 AND req_id = ?2')
    .bind(pk, id)
    .first<ReservationRow>();
}

/** Admitted only when this attempt's token owns the row AND it is held (a replay after settle is not admitted). */
export function isAdmitted(
  row: Pick<ReservationRow, 'hold_token' | 'state'> | null,
  hold: string
): boolean {
  return !!row && row.hold_token === hold && row.state === 'held';
}

export async function reserve(
  db: D1Database,
  i: ReserveInput
): Promise<{ outcome: ReserveOutcome; row: ReservationRow | null; metas: D1Meta[] }> {
  const metas: D1Meta[] = [];
  let res = await db.batch(reserveStatements(db, i));
  metas.push(...res.map((x) => x.meta));
  let row = await getReservation(db, i.pk, i.id);
  if (row && row.body_hash !== i.bh) {
    return { outcome: 'idempotency_mismatch', row, metas };
  }
  if (row && row.hold_token !== i.hold && row.state === 'refunded') {
    res = await db.batch(reserveStatements(db, i, true));
    metas.push(...res.map((x) => x.meta));
    row = await getReservation(db, i.pk, i.id);
  }
  let outcome: ReserveOutcome;
  if (row) {
    if (isAdmitted(row, i.hold)) outcome = 'admitted';
    else if (row.hold_token === i.hold)
      outcome = row.state === 'pending' ? 'in_progress' : 'already_processed';
    else
      outcome =
        row.state === 'held' || row.state === 'pending' ? 'in_progress' : 'already_processed';
  } else outcome = await diagnose(db, i);
  return { outcome, row, metas };
}

async function diagnose(db: D1Database, i: ReserveInput): Promise<ReserveOutcome> {
  const br = await db
    .prepare("SELECT value FROM meta WHERE key = 'breaker'")
    .first<{ value: string }>();
  if (br?.value === 'open') return 'hosted_disabled';
  const df = await db
    .prepare("SELECT value FROM meta WHERE key = 'daily_full'")
    .first<{ value: string }>();
  if (df?.value === '1') return 'daily_full';
  const dev = await db
    .prepare("SELECT 1 AS x FROM devices WHERE rc_id = ?1 AND status = 'active'")
    .bind(i.rc)
    .first();
  if (!dev) return 'no_device';
  const p = await db
    .prepare('SELECT * FROM periods WHERE payment_key = ?1')
    .bind(i.pk)
    .first<PeriodRow>();
  if (!p || p.status !== 'active' || i.now < p.period_start || i.now >= p.period_end)
    return 'no_period';
  const cap = i.now < p.early_until ? p.early_cap_u : p.cap_u;
  if (p.spent_u + p.reserved_u + i.r > cap) return 'budget_exhausted';
  const sameDay = p.day === i.day;
  if ((sameDay ? p.day_spent_u : 0) + p.reserved_u + i.r > p.daily_cap_u) return 'daily_limit';
  if ((sameDay ? p.day_requests : 0) >= i.maxReq) return 'daily_limit';
  if (p.inflight >= i.maxInflight) return 'busy';
  return 'no_period';
}

/** The caller's live period: active device, active period, `now` inside it. Null when none. */
export async function findLivePeriod(
  db: D1Database,
  rcId: string,
  now: number
): Promise<PeriodRow | null> {
  return db
    .prepare(
      `SELECT p.* FROM devices d JOIN periods p ON p.lineage_key = d.lineage_key
       WHERE d.rc_id = ?1 AND d.status = 'active' AND p.status = 'active'
         AND p.period_start <= ?2 AND ?2 < p.period_end
       ORDER BY p.period_start DESC LIMIT 1`
    )
    .bind(rcId, now)
    .first<PeriodRow>();
}

export interface SettleInput {
  pk: string;
  id: string;
  final: 'settled' | 'refunded' | 'expired';
  a: number;
  now: number;
  day: string;
}
export function settleStatements(db: D1Database, s: SettleInput): D1PreparedStatement[] {
  const p: Params = {
    pk: s.pk,
    id: s.id,
    final: s.final,
    a: s.final === 'refunded' ? 0 : s.a,
    now: s.now,
    day: s.day,
  };
  return [stmt(db, SETTLE_PERIOD, p), stmt(db, SETTLE_RES, p)];
}
export async function settle(db: D1Database, s: SettleInput) {
  return db.batch(settleStatements(db, s));
}

/**
 * Settle, and when the actual cost exceeded the reservation also record the overrun (opening the
 * breaker at the limit) in the same atomic batch.
 */
export async function settleWithOverrun(
  db: D1Database,
  s: SettleInput,
  reservedU: number,
  overrunsLimit: number
): Promise<{ results: D1Result[]; overrun: boolean }> {
  const overrun = s.final !== 'refunded' && s.a > reservedU;
  const stmts = settleStatements(db, s);
  if (overrun) stmts.push(...recordOverrunStatements(db, s.now, overrunsLimit));
  const results = await db.batch(stmts);
  return { results, overrun };
}

export const STALE_MS = 5 * 60_000;
const HELD_EXPIRED = `payment_key = :pk AND req_id = :id AND state = 'held' AND expires_at < :now`;
const OWN_RESERVED = `(SELECT reserved_u FROM reservations WHERE ${HELD_EXPIRED})`;
/** Sweep settle: both statements guarded by held AND expired; charges the row's own reserved_u (no :a). */
export const SWEEP_PERIOD = `UPDATE periods SET
    spent_u = spent_u + ${OWN_RESERVED},
    reserved_u = reserved_u - ${OWN_RESERVED},
    inflight = inflight - 1,
    day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + ${OWN_RESERVED},
    day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1,
    day = :day
  WHERE payment_key = :pk AND EXISTS (SELECT 1 FROM reservations WHERE ${HELD_EXPIRED})`;
export const SWEEP_RES = `UPDATE reservations SET state = 'expired', settled_u = reserved_u, settled_at = :now
  WHERE ${HELD_EXPIRED}`;
export function sweepStatements(
  db: D1Database,
  s: { pk: string; id: string; now: number; day: string }
): D1PreparedStatement[] {
  const p: Params = { pk: s.pk, id: s.id, now: s.now, day: s.day };
  return [stmt(db, SWEEP_PERIOD, p), stmt(db, SWEEP_RES, p)];
}

/** Cron sweep over periods that ended less than a day ago (uses periods_end). */
export async function sweep(db: D1Database, now: number, day: string) {
  const metas: D1Meta[] = [];
  const ps = await db
    .prepare(
      'SELECT payment_key FROM periods WHERE period_end > ?1 AND reserved_u > 0 AND last_activity_at < ?2'
    )
    .bind(now - DAY_MS, now - STALE_MS)
    .all<{ payment_key: string }>();
  metas.push(ps.meta);
  let swept = 0;
  for (const { payment_key } of ps.results) {
    const rs = await db
      .prepare(
        "SELECT req_id FROM reservations WHERE payment_key = ?1 AND state = 'held' AND expires_at < ?2"
      )
      .bind(payment_key, now)
      .all<{ req_id: string }>();
    metas.push(rs.meta);
    for (const r of rs.results) {
      const out = await db.batch(sweepStatements(db, { pk: payment_key, id: r.req_id, now, day }));
      metas.push(...out.map((x) => x.meta));
      swept += out[1]!.meta.changes;
    }
  }
  return { swept, metas };
}

/** Cron: sets meta.daily_full to '1' when today's settled request count over live periods reaches globalMax.
 *  Writes only when the value changes. */
export async function updateDailyFull(db: D1Database, now: number, day: string, globalMax: number) {
  return db
    .prepare(
      `INSERT INTO meta (key, value)
      SELECT 'daily_full', CASE WHEN COALESCE(SUM(CASE WHEN day = ?1 THEN day_requests ELSE 0 END), 0) >= ?2 THEN '1' ELSE '0' END
      FROM periods WHERE period_end > ?3
    ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`
    )
    .bind(day, globalMax, now - DAY_MS)
    .run();
}

export const PRUNE_MS = 7 * 86_400_000;
export const PERIOD_PRUNE_MS = 60 * 86_400_000;
/** Returns the two DELETE results: reservations (7 days) and periods ended more than 60 days ago. */
export async function prune(db: D1Database, now: number) {
  const res = await db
    .prepare(
      "DELETE FROM reservations WHERE state IN ('settled','refunded','expired') AND settled_at < ?1"
    )
    .bind(now - PRUNE_MS)
    .run();
  const per = await db
    .prepare('DELETE FROM periods WHERE period_end < ?1')
    .bind(now - PERIOD_PRUNE_MS)
    .run();
  return { reservations: res, periods: per };
}
