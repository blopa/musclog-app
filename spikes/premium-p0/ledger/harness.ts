import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Db } from './ledger';

export async function openDb(schemaText?: string) {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: ['DB'],
    d1Persist: false,
  });
  const db = (await mf.getD1Database('DB')) as unknown as Db & { exec(s: string): Promise<any> };
  const sql = (schemaText ?? readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch(sql.map((s) => db.prepare(s)));
  return { mf, db };
}

export const NOW = 1_800_000_000_000;
export const DAY = '2027-01-15';

export async function seed(
  db: Db,
  o: {
    pk?: string;
    rc?: string;
    cap?: number;
    early?: number;
    earlyUntil?: number;
    daily?: number;
  } = {}
) {
  const pk = o.pk ?? 'pk1',
    rc = o.rc ?? 'rc1';
  const cap = o.cap ?? 1_000_000;
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO devices VALUES (?1, x'00', ?2, 'active', 0, 0)")
      .bind(rc, 'lin-' + pk),
    db
      .prepare(
        `INSERT INTO periods (payment_key, lineage_key, store, period_start, period_end, proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u, created_at)
      VALUES (?1, ?2, 'play_store', ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`
      )
      .bind(
        pk,
        'lin-' + pk,
        NOW - 86_400_000,
        NOW + 30 * 86_400_000,
        Math.ceil((cap * 1055) / 500) + 10,
        cap,
        o.early ?? cap,
        o.earlyUntil ?? 0,
        o.daily ?? cap
      ),
  ]);
  return { pk, rc };
}
export async function period(db: Db, pk = 'pk1') {
  return (await db.prepare('SELECT * FROM periods WHERE payment_key = ?1').bind(pk).first()) as any;
}
export async function wipe(db: Db) {
  await db.batch(
    ['reservations', 'periods', 'devices', 'meta'].map((t) => db.prepare(`DELETE FROM ${t}`))
  );
}
