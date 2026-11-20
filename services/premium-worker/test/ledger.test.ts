// Moved from spikes/premium-p0/ledger/ledger.test.ts onto the Worker's real D1 (Miniflare),
// adapted only for the revision 3 columns (body_hash) plus the new cases.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { isBreakerOpen } from '../src/breaker';
import { stmt } from '../src/db';
import {
  findLivePeriod,
  getReservation,
  isAdmitted,
  prune,
  reserve,
  reserveStatements,
  settle,
  settleStatements,
  settleWithOverrun,
  sweep,
  sweepStatements,
  updateDailyFull,
  type ReserveInput,
} from '../src/ledger';
import { countingDb } from './fakes/countingDb';
import { DAY, DAY_MS, NOW, getPeriod, seed, seedDevice, seedPeriod, wipe } from './fakes/seed';

const db = env.DB;
beforeEach(async () => {
  await wipe(db);
});

let n = 0;
const rin = (o: Partial<ReserveInput> = {}): ReserveInput => ({
  pk: 'pk1',
  id: 'req' + ++n,
  rc: 'rc1',
  bh: 'bh1',
  r: 100,
  hold: 'h' + ++n,
  now: NOW,
  day: DAY,
  maxReq: 1000,
  maxInflight: 1000,
  ...o,
});
const metaValue = async (key: string) =>
  (await db.prepare('SELECT value FROM meta WHERE key = ?1').bind(key).first<{ value: string }>())
    ?.value;
const insertRes = (id: string, r: number, state: string) =>
  db
    .prepare(
      `INSERT INTO reservations (payment_key, req_id, body_hash, reserved_u, state, hold_token, created_at, expires_at)
       VALUES ('pk1', ?1, 'bh1', ?2, ?3, 'h', 0, 0)`
    )
    .bind(id, r, state);

describe('1. revision-2 bug reproduction', () => {
  it('replaying the old token-guarded settle batch double-charges', async () => {
    // Revision 2's schema and SQL, kept local (tables prefixed old_ so they never touch the real ones).
    await db.batch([
      db.prepare('DROP TABLE IF EXISTS old_periods'),
      db.prepare('DROP TABLE IF EXISTS old_reservations'),
      db.prepare(`CREATE TABLE old_periods (payment_key TEXT PRIMARY KEY, spent_u INTEGER NOT NULL DEFAULT 0, reserved_u INTEGER NOT NULL DEFAULT 0 CHECK (reserved_u >= 0),
        inflight INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL DEFAULT '', day_spent_u INTEGER NOT NULL DEFAULT 0, day_requests INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID`),
      db.prepare(`CREATE TABLE old_reservations (payment_key TEXT NOT NULL, req_id TEXT NOT NULL, reserved_u INTEGER NOT NULL, settled_u INTEGER, state TEXT NOT NULL,
        hold_token TEXT NOT NULL, settle_token TEXT, created_at INTEGER, expires_at INTEGER, settled_at INTEGER, PRIMARY KEY (payment_key, req_id)) WITHOUT ROWID`),
      db.prepare("INSERT INTO old_periods VALUES ('p', 0, 200, 2, '', 0, 0)"),
      db.prepare(
        "INSERT INTO old_reservations VALUES ('p','a',100,NULL,'held','h1',NULL,0,0,NULL)"
      ),
      db.prepare(
        "INSERT INTO old_reservations VALUES ('p','b',100,NULL,'held','h2',NULL,0,0,NULL)"
      ),
    ]);
    const params = { pk: 'p', id: 'a', final: 'settled', a: 60, now: NOW, day: DAY, tok: 'tok1' };
    const oldSettle = () => [
      stmt(
        db,
        `UPDATE old_reservations SET state = :final, settled_u = :a, settled_at = :now, settle_token = :tok WHERE payment_key = :pk AND req_id = :id AND state = 'held'`,
        params
      ),
      stmt(
        db,
        `UPDATE old_periods SET spent_u = spent_u + :a,
        reserved_u = MAX(0, reserved_u - (SELECT reserved_u FROM old_reservations WHERE payment_key=:pk AND req_id=:id)),
        inflight = MAX(0, inflight - 1),
        day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + :a,
        day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1, day = :day
        WHERE payment_key = :pk AND EXISTS (SELECT 1 FROM old_reservations WHERE payment_key = :pk AND req_id = :id AND settle_token = :tok)`,
        params
      ),
    ];
    await db.batch(oldSettle());
    const once = await db.prepare("SELECT * FROM old_periods WHERE payment_key='p'").first<any>();
    await db.batch(oldSettle()); // replay after a commit whose response was lost
    const twice = await db.prepare("SELECT * FROM old_periods WHERE payment_key='p'").first<any>();
    await db.batch([
      db.prepare('DROP TABLE old_periods'),
      db.prepare('DROP TABLE old_reservations'),
    ]);
    expect(once.spent_u).toBe(60);
    expect(twice.spent_u).toBe(120); // double charge
    expect(twice.reserved_u).toBe(0); // request b's hold silently released too
    expect(twice.inflight).toBe(0);
    expect(twice.day_requests).toBe(2);
  });
});

describe('2. replay is idempotent', () => {
  it('reserve replay x5 changes the period once', async () => {
    await seed(db);
    const i = rin();
    expect((await reserve(db, i)).outcome).toBe('admitted');
    const after1 = await getPeriod(db);
    for (let k = 0; k < 5; k++) await db.batch(reserveStatements(db, i));
    const after = await getPeriod(db);
    expect(after).toEqual(after1);
    expect(after.reserved_u).toBe(100);
    expect(after.inflight).toBe(1);
  });
  it('settle replay x5 charges once', async () => {
    await seed(db);
    const i = rin();
    await reserve(db, i);
    const s = { pk: i.pk, id: i.id, final: 'settled' as const, a: 70, now: NOW + 1000, day: DAY };
    for (let k = 0; k < 6; k++) await db.batch(settleStatements(db, s));
    expect(await getPeriod(db)).toMatchObject({
      spent_u: 70,
      reserved_u: 0,
      inflight: 0,
      day_spent_u: 70,
      day_requests: 1,
    });
  });
  it('reserve replay after settle does not resurrect the hold', async () => {
    await seed(db);
    const i = rin();
    await reserve(db, i);
    await settle(db, { pk: i.pk, id: i.id, final: 'settled', a: 50, now: NOW, day: DAY });
    for (let k = 0; k < 3; k++) await db.batch(reserveStatements(db, i));
    expect(await getPeriod(db)).toMatchObject({ spent_u: 50, reserved_u: 0, inflight: 0 });
    const again = await reserve(db, i); // same token, but no longer held
    expect(again.outcome).toBe('already_processed');
  });
});

describe('3. 100 concurrent reserves on a nearly full period', () => {
  it('never exceeds cap; admitted count exact; concurrent settle keeps invariants', async () => {
    await seed(db, { cap: 3750 });
    const ins = Array.from({ length: 100 }, () => rin({ r: 100 }));
    const res = await Promise.all(ins.map((i) => reserve(db, i)));
    const admitted = res.filter((x) => x.outcome === 'admitted');
    expect(admitted.length).toBe(37);
    expect(res.filter((x) => x.outcome === 'budget_exhausted').length).toBe(63);
    let p = await getPeriod(db);
    expect(p.spent_u + p.reserved_u).toBeLessThanOrEqual(3750);
    expect(p).toMatchObject({ reserved_u: 3700, inflight: 37 });
    await Promise.all(
      admitted.map((x, k) =>
        settle(db, {
          pk: 'pk1',
          id: x.row!.req_id,
          final: 'settled',
          a: 50 + (k % 3) * 20,
          now: NOW,
          day: DAY,
        })
      )
    );
    p = await getPeriod(db);
    const expected = admitted.reduce((a, _x, k) => a + 50 + (k % 3) * 20, 0);
    expect(p).toMatchObject({ reserved_u: 0, inflight: 0, spent_u: expected, day_requests: 37 });
  });
  it('max_inflight and max_requests_per_day guards hold under concurrency', async () => {
    await seed(db);
    const res = await Promise.all(
      Array.from({ length: 20 }, () => reserve(db, rin({ maxInflight: 2 })))
    );
    expect(res.filter((x) => x.outcome === 'admitted').length).toBe(2);
    expect(res.filter((x) => x.outcome === 'busy').length).toBe(18);
  });
});

describe('4. same req_id, different hold token', () => {
  it('in_progress while held, already_processed after settle/expire, refunded re-admitted once', async () => {
    await seed(db);
    const a = rin();
    expect((await reserve(db, a)).outcome).toBe('admitted');
    expect((await reserve(db, { ...a, hold: 'other' })).outcome).toBe('in_progress');
    expect((await getPeriod(db)).reserved_u).toBe(100); // no double reservation
    await settle(db, { pk: 'pk1', id: a.id, final: 'settled', a: 40, now: NOW, day: DAY });
    expect((await reserve(db, { ...a, hold: 'other2' })).outcome).toBe('already_processed');
    const e = rin();
    await reserve(db, e);
    await settle(db, { pk: 'pk1', id: e.id, final: 'expired', a: 100, now: NOW, day: DAY });
    expect((await reserve(db, { ...e, hold: 'x' })).outcome).toBe('already_processed');
    // refunded
    const r = rin();
    await reserve(db, r);
    await settle(db, { pk: 'pk1', id: r.id, final: 'refunded', a: 999, now: NOW, day: DAY });
    let p = await getPeriod(db);
    expect(p.spent_u).toBe(40 + 100); // refund charged 0
    const h1 = await reserve(db, { ...r, hold: 'again1' });
    expect(h1.outcome).toBe('admitted');
    const h2 = await reserve(db, { ...r, hold: 'again2' });
    expect(h2.outcome).toBe('in_progress');
    p = await getPeriod(db);
    expect(p).toMatchObject({ reserved_u: 100, inflight: 1 });
    // replay of the readmit batch is a no-op too
    await db.batch(reserveStatements(db, { ...r, hold: 'again1' }, true));
    expect(await getPeriod(db)).toMatchObject({ reserved_u: 100, inflight: 1 });
  });
  it('concurrent readmits of one refunded req admit exactly once', async () => {
    await seed(db);
    const r = rin();
    await reserve(db, r);
    await settle(db, { pk: 'pk1', id: r.id, final: 'refunded', a: 0, now: NOW, day: DAY });
    const out = await Promise.all(
      Array.from({ length: 10 }, (_v, k) => reserve(db, { ...r, hold: 'c' + k }))
    );
    expect(out.filter((x) => x.outcome === 'admitted').length).toBe(1);
    expect((await getPeriod(db)).reserved_u).toBe(100);
  });
});

describe('4b. Idempotency-Key bound to its body (revision 3)', () => {
  it('same key with a different body hash is idempotency_mismatch and charges nothing more', async () => {
    await seed(db);
    const a = rin();
    expect((await reserve(db, a)).outcome).toBe('admitted');
    const before = await getPeriod(db);
    const m = await reserve(db, { ...a, hold: 'other', bh: 'different' });
    expect(m.outcome).toBe('idempotency_mismatch');
    expect(await getPeriod(db)).toEqual(before);
    expect(await getReservation(db, 'pk1', a.id)).toMatchObject({
      state: 'held',
      hold_token: a.hold,
      body_hash: 'bh1',
    });
    // the same hash and token is still the admitted one
    expect((await reserve(db, a)).outcome).toBe('admitted');
  });
  it('a mismatch after settle stays a mismatch (not already_processed)', async () => {
    await seed(db);
    const a = rin();
    await reserve(db, a);
    await settle(db, { pk: 'pk1', id: a.id, final: 'settled', a: 30, now: NOW, day: DAY });
    expect((await reserve(db, { ...a, hold: 'o', bh: 'x' })).outcome).toBe('idempotency_mismatch');
    expect((await reserve(db, { ...a, hold: 'o' })).outcome).toBe('already_processed');
  });
  it('a refunded row is not readmitted with a different hash', async () => {
    await seed(db);
    const r = rin();
    await reserve(db, r);
    await settle(db, { pk: 'pk1', id: r.id, final: 'refunded', a: 0, now: NOW, day: DAY });
    const m = await reserve(db, { ...r, hold: 'new', bh: 'different' });
    expect(m.outcome).toBe('idempotency_mismatch');
    expect(await getPeriod(db)).toMatchObject({ reserved_u: 0, inflight: 0 });
    expect(await getReservation(db, 'pk1', r.id)).toMatchObject({ state: 'refunded' });
    // the readmit SQL itself also refuses a different hash
    const out = await db.batch(reserveStatements(db, { ...r, hold: 'new', bh: 'different' }, true));
    expect(out[0]!.meta.changes).toBe(0);
    // while the same hash is readmitted
    expect((await reserve(db, { ...r, hold: 'new' })).outcome).toBe('admitted');
  });
});

describe('5. crash, sweep, races', () => {
  const LATER = NOW + 20 * 60_000;
  it('sweep charges reserved_u once; late settle is a no-op; sweep twice is a no-op', async () => {
    await seed(db);
    const i = rin();
    await reserve(db, i);
    expect((await sweep(db, LATER, DAY)).swept).toBe(1);
    expect(await getPeriod(db)).toMatchObject({ spent_u: 100, reserved_u: 0, inflight: 0 });
    await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 30, now: LATER, day: DAY });
    expect((await sweep(db, LATER + 1, DAY)).swept).toBe(0);
    expect(await getPeriod(db)).toMatchObject({ spent_u: 100, reserved_u: 0, inflight: 0 });
    expect((await getReservation(db, 'pk1', i.id))!.state).toBe('expired');
  });
  it('sweep racing a settle charges exactly once (either winner)', async () => {
    await seed(db);
    const ins = Array.from({ length: 20 }, () => rin());
    await Promise.all(ins.map((i) => reserve(db, i)));
    await Promise.all([
      sweep(db, LATER, DAY),
      ...ins.map((i) =>
        settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 10, now: LATER, day: DAY })
      ),
    ]);
    const p = await getPeriod(db);
    expect(p).toMatchObject({ reserved_u: 0, inflight: 0 });
    const rows = await db
      .prepare('SELECT state, settled_u FROM reservations')
      .all<{ state: string; settled_u: number }>();
    const charged = rows.results.reduce((a, r) => a + r.settled_u, 0);
    expect(p.spent_u).toBe(charged);
    expect(rows.results.every((r) => r.state === 'settled' || r.state === 'expired')).toBe(true);
  });
  it('sweep ignores recent activity and unexpired holds', async () => {
    await seed(db);
    await reserve(db, rin());
    expect((await sweep(db, NOW + 60_000, DAY)).swept).toBe(0);
  });
  it('a stale sweep leaves a re-admitted refunded hold untouched (guards held AND expires_at < now)', async () => {
    await seed(db);
    const i = rin({ r: 100 });
    await reserve(db, i);
    await settle(db, { pk: 'pk1', id: i.id, final: 'refunded', a: 0, now: NOW, day: DAY });
    await reserve(db, { ...i, hold: 'new', r: 300, now: LATER - 1000 }); // fresh hold, expires in the future
    const before = await getPeriod(db);
    const out = await db.batch(sweepStatements(db, { pk: 'pk1', id: i.id, now: LATER, day: DAY })); // stale sweep
    expect(out[0]!.meta.changes + out[1]!.meta.changes).toBe(0);
    expect(await getPeriod(db)).toEqual(before);
    expect(before).toMatchObject({ reserved_u: 300, inflight: 1 });
    expect(await getReservation(db, 'pk1', i.id)).toMatchObject({
      state: 'held',
      hold_token: 'new',
      reserved_u: 300,
    });
  });
  it("the sweep charges the row's own reserved_u, and replaying the sweep batch charges once", async () => {
    await seed(db);
    const i = rin({ r: 250 });
    await reserve(db, i);
    for (let k = 0; k < 4; k++)
      await db.batch(sweepStatements(db, { pk: 'pk1', id: i.id, now: LATER, day: DAY }));
    expect(await getPeriod(db)).toMatchObject({
      spent_u: 250,
      reserved_u: 0,
      inflight: 0,
      day_requests: 1,
    });
  });
  it('read-back admits only the owning token while held', async () => {
    expect(isAdmitted({ hold_token: 'a', state: 'held' }, 'a')).toBe(true);
    expect(isAdmitted({ hold_token: 'a', state: 'settled' }, 'a')).toBe(false);
    expect(isAdmitted({ hold_token: 'b', state: 'held' }, 'a')).toBe(false);
    expect(isAdmitted(null, 'a')).toBe(false);
  });
});

describe('5b. global daily admission flag', () => {
  it('cron sets daily_full at globalMax; reserves are then refused with zero writes besides the flag', async () => {
    await seed(db, { pk: 'pkA', rc: 'rcA' });
    await seed(db, { pk: 'pkB', rc: 'rcB' });
    for (const [pk, rc] of [
      ['pkA', 'rcA'],
      ['pkB', 'rcB'],
      ['pkB', 'rcB'],
    ] as const) {
      const i = rin({ pk, rc });
      await reserve(db, i);
      await settle(db, { pk, id: i.id, final: 'settled', a: 10, now: NOW, day: DAY });
    }
    const below = await updateDailyFull(db, NOW, DAY, 4);
    expect(await metaValue('daily_full')).toBe('0');
    expect((await reserve(db, rin({ pk: 'pkA', rc: 'rcA' }))).outcome).toBe('admitted');
    const unchanged = await updateDailyFull(db, NOW, DAY, 4); // still below: no write
    expect(unchanged.meta.rows_written).toBe(0);
    const held = await db
      .prepare("SELECT req_id FROM reservations WHERE state='held'")
      .first<{ req_id: string }>();
    await settle(db, { pk: 'pkA', id: held!.req_id, final: 'settled', a: 10, now: NOW, day: DAY });
    const hit = await updateDailyFull(db, NOW, DAY, 4); // 4 settled requests today
    expect(await metaValue('daily_full')).toBe('1');
    expect(hit.meta.rows_written).toBeGreaterThan(0);
    expect(below.meta.rows_written).toBeGreaterThan(0); // first creation of the flag
    const snap = async () =>
      JSON.stringify([
        (await db.prepare('SELECT * FROM periods ORDER BY payment_key').all()).results,
        (await db.prepare('SELECT * FROM reservations ORDER BY req_id').all()).results,
      ]);
    const before = await snap();
    const outs = await Promise.all(
      Array.from({ length: 10 }, () => reserve(db, rin({ pk: 'pkA', rc: 'rcA' })))
    );
    expect(outs.every((o) => o.outcome === 'daily_full')).toBe(true);
    expect(outs.flatMap((o) => o.metas).every((m) => m.rows_written === 0)).toBe(true);
    expect(await snap()).toBe(before);
    // next day the count restarts and the cron reopens admission
    const reopened = await updateDailyFull(db, NOW + DAY_MS, '2027-01-16', 4);
    expect(await metaValue('daily_full')).toBe('0');
    expect(reopened.meta.rows_written).toBeGreaterThan(0);
  });
});

describe('6. overrun', () => {
  it('a > reserved_u is charged in full, once; may push spent past cap', async () => {
    await seed(db, { cap: 1000 });
    const i = rin({ r: 100 });
    await reserve(db, i);
    const s = { pk: 'pk1', id: i.id, final: 'settled' as const, a: 450, now: NOW, day: DAY };
    for (let k = 0; k < 3; k++) await settle(db, s);
    expect(await getPeriod(db)).toMatchObject({ spent_u: 450, reserved_u: 0, inflight: 0 });
  });
});

describe('6b. settleWithOverrun and the breaker', () => {
  const overrunOnce = async (limit: number, now = NOW) => {
    const i = rin({ r: 100, now });
    await reserve(db, i);
    return settleWithOverrun(
      db,
      { pk: 'pk1', id: i.id, final: 'settled', a: 250, now, day: DAY },
      100,
      limit
    );
  };
  it('an overrun is charged in full and recorded', async () => {
    await seed(db, { cap: 100_000 });
    const out = await overrunOnce(3);
    expect(out.overrun).toBe(true);
    expect(await getPeriod(db)).toMatchObject({ spent_u: 250, reserved_u: 0, inflight: 0 });
    expect(JSON.parse((await metaValue('overruns'))!)).toEqual([NOW]);
    expect(await isBreakerOpen(db)).toBe(false);
  });
  it('2 overruns in 24 h keep the breaker closed; the 3rd opens it with reason overruns', async () => {
    await seed(db, { cap: 100_000 });
    await overrunOnce(3, NOW);
    await overrunOnce(3, NOW + 1000);
    expect(await isBreakerOpen(db)).toBe(false);
    expect(await metaValue('breaker_reason')).toBeUndefined();
    await overrunOnce(3, NOW + 2000);
    expect(await isBreakerOpen(db)).toBe(true);
    expect(await metaValue('breaker_reason')).toBe('overruns');
    expect(JSON.parse((await metaValue('overruns'))!)).toHaveLength(3);
    // a 4th reserve is now refused
    expect((await reserve(db, rin({ now: NOW + 3000 }))).outcome).toBe('hosted_disabled');
  });
  it('overruns older than 24 h are dropped', async () => {
    await seed(db, { cap: 100_000 });
    await db
      .prepare("INSERT INTO meta (key, value) VALUES ('overruns', ?1)")
      .bind(JSON.stringify([NOW - 2 * DAY_MS, NOW - DAY_MS - 1]))
      .run();
    await overrunOnce(2, NOW);
    expect(JSON.parse((await metaValue('overruns'))!)).toEqual([NOW]);
    expect(await isBreakerOpen(db)).toBe(false);
  });
  it('a non-overrun settle (and a refund) writes no meta row', async () => {
    await seed(db, { cap: 100_000 });
    const a = rin({ r: 100 });
    await reserve(db, a);
    const ok = await settleWithOverrun(
      db,
      { pk: 'pk1', id: a.id, final: 'settled', a: 100, now: NOW, day: DAY },
      100,
      1
    );
    expect(ok.overrun).toBe(false);
    const b = rin({ r: 100 });
    await reserve(db, b);
    const rf = await settleWithOverrun(
      db,
      { pk: 'pk1', id: b.id, final: 'refunded', a: 999, now: NOW, day: DAY },
      100,
      1
    );
    expect(rf.overrun).toBe(false);
    const rows = await db.prepare('SELECT COUNT(*) AS c FROM meta').first<{ c: number }>();
    expect(rows!.c).toBe(0);
  });
});

describe('7. CHECK constraints', () => {
  it('reserved_u < 0 fails and rolls back the whole settle batch', async () => {
    await seed(db);
    // corrupt: held reservation of 500 while the period only reserves 100
    await db.batch([
      db.prepare("UPDATE periods SET reserved_u = 100, inflight = 1 WHERE payment_key='pk1'"),
      insertRes('bad', 500, 'held'),
    ]);
    await expect(
      settle(db, { pk: 'pk1', id: 'bad', final: 'settled', a: 5, now: NOW, day: DAY })
    ).rejects.toThrow();
    expect((await getReservation(db, 'pk1', 'bad'))!.state).toBe('held');
    expect(await getPeriod(db)).toMatchObject({ spent_u: 0, reserved_u: 100, inflight: 1 });
  });
  it('inflight < 0 fails the batch too', async () => {
    await seed(db);
    await db.batch([insertRes('bad', 0, 'held')]);
    await expect(
      settle(db, { pk: 'pk1', id: 'bad', final: 'settled', a: 5, now: NOW, day: DAY })
    ).rejects.toThrow();
    expect((await getPeriod(db)).spent_u).toBe(0);
  });
  it('financial CHECK on periods rejects an over-large cap and rolls back', async () => {
    await seed(db);
    await expect(
      db.batch([
        db.prepare("UPDATE periods SET spent_u = 5 WHERE payment_key='pk1'"),
        db.prepare("UPDATE periods SET cap_u = cap_u * 2 WHERE payment_key='pk1'"),
      ])
    ).rejects.toThrow();
    expect((await getPeriod(db)).spent_u).toBe(0);
  });
  it('net_proceeds_u above proceeds_u is rejected', async () => {
    await seed(db);
    await expect(
      db.prepare("UPDATE periods SET net_proceeds_u = proceeds_u + 1 WHERE payment_key='pk1'").run()
    ).rejects.toThrow();
  });
});

describe('8. findLivePeriod', () => {
  it('active device + live period returns the row', async () => {
    await seed(db);
    const p = await findLivePeriod(db, 'rc1', NOW);
    expect(p).toMatchObject({ payment_key: 'pk1', status: 'active' });
  });
  it('picks the latest live period of the lineage', async () => {
    await seed(db);
    await seedPeriod(db, { pk: 'pk2', lineage: 'lin-pk1', start: NOW - 1000 }).run();
    expect((await findLivePeriod(db, 'rc1', NOW))!.payment_key).toBe('pk2');
  });
  it('revoked device, revoked period, expired period and unknown device give null', async () => {
    await seed(db, { pk: 'a', rc: 'rcA', deviceStatus: 'revoked' });
    await seed(db, { pk: 'b', rc: 'rcB', status: 'revoked' });
    await seed(db, { pk: 'c', rc: 'rcC', end: NOW - 1 });
    await seed(db, { pk: 'd', rc: 'rcD', start: NOW + 1000 });
    for (const rc of ['rcA', 'rcB', 'rcC', 'rcD', 'nobody']) {
      expect(await findLivePeriod(db, rc, NOW)).toBeNull();
    }
    await db.batch([seedDevice(db, { rc: 'rcE', lineage: 'lin-e' })]);
    expect(await findLivePeriod(db, 'rcE', NOW)).toBeNull(); // device without a period
  });
});

describe('9. cost measurement (D1 result meta from Miniflare)', () => {
  it('rows written per operation', async () => {
    await seed(db, { cap: 1_000_000 });
    const c = countingDb(db);
    const i = rin();
    const r = await reserve(c.db, i);
    expect(r.outcome).toBe('admitted');
    expect(r.metas.reduce((a, m) => a + m.rows_written, 0)).toBe(3);
    expect(c.rowsWritten()).toBe(3);
    const s = await settle(db, {
      pk: 'pk1',
      id: i.id,
      final: 'settled',
      a: 50,
      now: NOW,
      day: DAY,
    });
    expect(s.reduce((a, x) => a + x.meta.rows_written, 0)).toBe(2);
    await db.prepare('UPDATE periods SET cap_u = 1, early_cap_u = 1').run();
    const rej = await reserve(db, rin());
    expect(rej.outcome).toBe('budget_exhausted');
    expect(rej.metas.reduce((a, m) => a + m.rows_written, 0)).toBe(0);
  });
  it('prune deletes settled rows older than 7 days and periods ended 60 days ago', async () => {
    await seed(db, { pk: 'live' });
    await seed(db, { pk: 'old', rc: 'rcOld', start: NOW - 90 * DAY_MS, end: NOW - 61 * DAY_MS });
    await db.batch([
      db
        .prepare(
          `INSERT INTO reservations (payment_key, req_id, body_hash, reserved_u, settled_u, state, hold_token, created_at, expires_at, settled_at)
           VALUES ('live','oldres','b',1,1,'settled','h',0,0,?1), ('live','newres','b',1,1,'settled','h',0,0,?2)`
        )
        .bind(NOW - 8 * DAY_MS, NOW),
    ]);
    const out = await prune(db, NOW);
    expect(out.reservations.meta.changes).toBe(1);
    expect(out.periods.meta.changes).toBe(1);
  });
});

describe('10. countingDb wrapper', () => {
  it('counts rows written by an INSERT and by a batch, equal to the real result meta', async () => {
    const c = countingDb(db);
    const one = await c.db.prepare("INSERT INTO meta (key, value) VALUES ('a','1')").run();
    expect(one.meta.rows_written).toBeGreaterThan(0);
    expect(c.rowsWritten()).toBe(one.meta.rows_written);
    const two = await c.db
      .prepare("INSERT INTO meta (key, value) VALUES ('b','1'), ('c','2')")
      .run();
    expect(two.meta.rows_written).toBe(2 * one.meta.rows_written); // per-row cost scales with rows
    const out = await c.db.batch([
      c.db.prepare("INSERT INTO meta (key, value) VALUES ('d','3')"),
      c.db.prepare('UPDATE meta SET value = ?1 WHERE key = ?2').bind('9', 'a'),
    ]);
    const batchTotal = out.reduce((a, r) => a + r.meta.rows_written, 0);
    expect(c.rowsWritten()).toBe(one.meta.rows_written + two.meta.rows_written + batchTotal);
    c.reset();
    expect(c.rowsWritten()).toBe(0);
    expect(c.rowsRead()).toBe(0);
  });
  it('counts first() and all() reads and returns the same values as the real db', async () => {
    await db.prepare("INSERT INTO meta (key, value) VALUES ('a','1'), ('b','2')").run();
    const c = countingDb(db);
    const row = await c.db
      .prepare('SELECT value FROM meta WHERE key = ?1')
      .bind('a')
      .first<{ value: string }>();
    expect(row).toEqual({ value: '1' });
    expect(
      await c.db.prepare('SELECT value FROM meta WHERE key = ?1').bind('b').first('value')
    ).toBe('2');
    expect(
      await c.db.prepare('SELECT value FROM meta WHERE key = ?1').bind('zz').first()
    ).toBeNull();
    expect(c.rowsRead()).toBeGreaterThan(0);
    expect(c.rowsWritten()).toBe(0);
    const all = await c.db.prepare('SELECT * FROM meta').all();
    expect(all.results).toHaveLength(2);
  });
});
