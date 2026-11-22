// Corrected D1 budget ledger SQL (plan 8.2, P0 spike). Pure SQL + tiny wrappers.
export interface Db {
  prepare(sql: string): any;
  batch(stmts: any[]): Promise<any[]>;
}
export type Params = Record<string, string | number | null>;

/** Turns `:name` placeholders into ?N and binds. Same name = same ?N. */
export function stmt(db: Db, sql: string, p: Params) {
  const order: string[] = [];
  const text = sql.replace(/:([a-z_]+)/g, (_m, n: string) => {
    let i = order.indexOf(n);
    if (i < 0) {
      if (!(n in p)) throw new Error(`missing param ${n}`);
      order.push(n);
      i = order.length - 1;
    }
    return `?${i + 1}`;
  });
  return db.prepare(text).bind(...order.map((n) => p[n]));
}

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
  (payment_key, req_id, reserved_u, state, hold_token, created_at, expires_at)
  SELECT :pk, :id, :r, 'pending', :hold, :now, :exp WHERE ${GUARDS}`;

export const RESERVE_READMIT = `UPDATE reservations SET state = 'pending', hold_token = :hold, reserved_u = :r,
  created_at = :now, expires_at = :exp, settled_u = NULL, settled_at = NULL
  WHERE payment_key = :pk AND req_id = :id AND state = 'refunded' AND ${GUARDS}`;

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

export interface ReserveInput {
  pk: string;
  id: string;
  rc: string;
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
  r: i.r,
  hold: i.hold,
  now: i.now,
  exp: i.now + (i.ttlMs ?? 120000),
  day: i.day,
  max_requests_per_day: i.maxReq,
  max_inflight: i.maxInflight,
});

/** Statements of one reserve attempt. `readmit` swaps statement 1 for the refunded variant. */
export function reserveStatements(db: Db, i: ReserveInput, readmit = false) {
  const p = rp(i);
  return [
    stmt(db, readmit ? RESERVE_READMIT : RESERVE_INSERT, p),
    stmt(db, RESERVE_PERIOD, p),
    stmt(db, RESERVE_HOLD, p),
  ];
}

export async function getReservation(db: Db, pk: string, id: string) {
  return db
    .prepare('SELECT * FROM reservations WHERE payment_key = ?1 AND req_id = ?2')
    .bind(pk, id)
    .first();
}

/** Admitted only when this attempt's token owns the row AND it is held (a replay after settle is not admitted). */
export function isAdmitted(row: any, hold: string): boolean {
  return !!row && row.hold_token === hold && row.state === 'held';
}

export async function reserve(db: Db, i: ReserveInput) {
  const metas: any[] = [];
  let res = await db.batch(reserveStatements(db, i));
  metas.push(...res.map((x) => x.meta));
  let row: any = await getReservation(db, i.pk, i.id);
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

async function diagnose(db: Db, i: ReserveInput): Promise<ReserveOutcome> {
  const br: any = await db.prepare("SELECT value FROM meta WHERE key = 'breaker'").first();
  if (br?.value === 'open') return 'hosted_disabled';
  const df: any = await db.prepare("SELECT value FROM meta WHERE key = 'daily_full'").first();
  if (df?.value === '1') return 'daily_full';
  const dev: any = await db
    .prepare("SELECT 1 AS x FROM devices WHERE rc_id = ?1 AND status = 'active'")
    .bind(i.rc)
    .first();
  if (!dev) return 'no_device';
  const p: any = await db
    .prepare('SELECT * FROM periods WHERE payment_key = ?1')
    .bind(i.pk)
    .first();
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

export interface SettleInput {
  pk: string;
  id: string;
  final: 'settled' | 'refunded' | 'expired';
  a: number;
  now: number;
  day: string;
}
export function settleStatements(db: Db, s: SettleInput) {
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
export async function settle(db: Db, s: SettleInput) {
  return db.batch(settleStatements(db, s));
}

export const STALE_MS = 5 * 60_000;
export const DAY_MS = 86_400_000;
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
export function sweepStatements(db: Db, s: { pk: string; id: string; now: number; day: string }) {
  const p: Params = { pk: s.pk, id: s.id, now: s.now, day: s.day };
  return [stmt(db, SWEEP_PERIOD, p), stmt(db, SWEEP_RES, p)];
}

/** Cron sweep over periods that ended less than a day ago (uses periods_end). */
export async function sweep(db: Db, now: number, day: string) {
  const metas: any[] = [];
  const ps = await db
    .prepare(
      'SELECT payment_key FROM periods WHERE period_end > ?1 AND reserved_u > 0 AND last_activity_at < ?2'
    )
    .bind(now - DAY_MS, now - STALE_MS)
    .all();
  metas.push(ps.meta);
  let swept = 0;
  for (const { payment_key } of ps.results as any[]) {
    const rs = await db
      .prepare(
        "SELECT req_id FROM reservations WHERE payment_key = ?1 AND state = 'held' AND expires_at < ?2"
      )
      .bind(payment_key, now)
      .all();
    metas.push(rs.meta);
    for (const r of rs.results as any[]) {
      const out = await db.batch(sweepStatements(db, { pk: payment_key, id: r.req_id, now, day }));
      metas.push(...out.map((x) => x.meta));
      swept += out[1].meta.changes;
    }
  }
  return { swept, metas };
}

/** Cron: sets meta.daily_full to '1' when today's settled request count over live periods reaches globalMax.
 *  Writes only when the value changes. */
export async function updateDailyFull(db: Db, now: number, day: string, globalMax: number) {
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
export async function prune(db: Db, now: number) {
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
