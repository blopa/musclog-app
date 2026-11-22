// Seed helpers for ledger-level tests (devices, periods) over the migrated Miniflare D1.
import { NOW } from './ctx';
import { dayKey } from '../../src/db';
import type { PeriodRow } from '../../src/ledger';

export { NOW };
export const DAY = dayKey(NOW); // '2027-01-15'
export const DAY_MS = 86_400_000;

export interface DeviceSeed {
  rc: string;
  lineage: string;
  status?: 'active' | 'revoked';
  lastNonceTs?: number;
  verifiedAt?: number;
}

export function seedDevice(db: D1Database, o: DeviceSeed): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO devices (rc_id, public_key, lineage_key, status, last_nonce_ts, verified_at, created_at)
       VALUES (?1, x'00', ?2, ?3, ?4, ?5, 0)`
    )
    .bind(o.rc, o.lineage, o.status ?? 'active', o.lastNonceTs ?? 0, o.verifiedAt ?? 0);
}

export interface PeriodSeed {
  pk?: string;
  lineage?: string;
  cap?: number;
  early?: number;
  earlyUntil?: number;
  daily?: number;
  start?: number;
  end?: number;
  status?: 'active' | 'revoked';
  /** Overrides net_proceeds_u; cap must then still satisfy cap * 1055 <= net * 500. */
  netProceeds?: number;
}

export function seedPeriod(db: D1Database, o: PeriodSeed = {}): D1PreparedStatement {
  const pk = o.pk ?? 'pk1';
  const cap = o.cap ?? 1_000_000;
  const net = o.netProceeds ?? Math.ceil((cap * 1055) / 500);
  return db
    .prepare(
      `INSERT INTO periods (payment_key, lineage_key, rc_subscription_id, store, period_start, period_end,
         proceeds_u, net_proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u, status, created_at)
       VALUES (?1, ?2, 'sub-' || ?1, 'play_store', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0)`
    )
    .bind(
      pk,
      o.lineage ?? 'lin-' + pk,
      o.start ?? NOW - DAY_MS,
      o.end ?? NOW + 30 * DAY_MS,
      net + 10,
      net,
      cap,
      o.early ?? cap,
      o.earlyUntil ?? 0,
      o.daily ?? cap,
      o.status ?? 'active'
    );
}

/** Device + period, like the spike harness's seed. */
export async function seed(
  db: D1Database,
  o: PeriodSeed & { rc?: string; deviceStatus?: 'active' | 'revoked' } = {}
): Promise<{ pk: string; rc: string }> {
  const pk = o.pk ?? 'pk1';
  const rc = o.rc ?? 'rc1';
  await db.batch([
    seedDevice(db, {
      rc,
      lineage: o.lineage ?? 'lin-' + pk,
      status: o.deviceStatus ?? 'active',
    }),
    seedPeriod(db, o),
  ]);
  return { pk, rc };
}

export async function getPeriod(db: D1Database, pk = 'pk1'): Promise<PeriodRow> {
  return (await db
    .prepare('SELECT * FROM periods WHERE payment_key = ?1')
    .bind(pk)
    .first<PeriodRow>())!;
}

export async function wipe(db: D1Database): Promise<void> {
  await db.batch(
    ['reservations', 'periods', 'devices', 'meta'].map((t) => db.prepare(`DELETE FROM ${t}`))
  );
}
