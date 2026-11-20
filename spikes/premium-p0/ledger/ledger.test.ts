import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { DAY, NOW, openDb, period, seed, wipe } from './harness';
import {
  getReservation, isAdmitted, prune, reserve, reserveStatements, settle, settleStatements, stmt, sweep, sweepStatements, updateDailyFull,
  type Db, type ReserveInput,
} from './ledger';

let mf: any; let db: Db;
beforeAll(async () => { ({ mf, db } = await openDb()); });
afterAll(async () => { await mf.dispose(); });
beforeEach(async () => { await wipe(db); });

let n = 0;
const rin = (o: Partial<ReserveInput> = {}): ReserveInput => ({
  pk: 'pk1', id: 'req' + ++n, rc: 'rc1', r: 100, hold: 'h' + ++n, now: NOW, day: DAY, maxReq: 1000, maxInflight: 1000, ...o,
});
const ms = (m: any[]) => m.reduce((a, x) => ({ w: a.w + x.rows_written, r: a.r + x.rows_read }), { w: 0, r: 0 });

describe('1. revision-2 bug reproduction', () => {
  it('replaying the old token-guarded settle batch double-charges', async () => {
    const old = await openDb(`
      CREATE TABLE periods (payment_key TEXT PRIMARY KEY, spent_u INTEGER NOT NULL DEFAULT 0, reserved_u INTEGER NOT NULL DEFAULT 0 CHECK (reserved_u >= 0),
        inflight INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL DEFAULT '', day_spent_u INTEGER NOT NULL DEFAULT 0, day_requests INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID;
      CREATE TABLE reservations (payment_key TEXT NOT NULL, req_id TEXT NOT NULL, reserved_u INTEGER NOT NULL, settled_u INTEGER, state TEXT NOT NULL,
        hold_token TEXT NOT NULL, settle_token TEXT, created_at INTEGER, expires_at INTEGER, settled_at INTEGER, PRIMARY KEY (payment_key, req_id)) WITHOUT ROWID;`);
    const o = old.db;
    // Two requests in flight so the MAX(0, ..) clamp does not mask the symptom: r=100 each, reserved 200, inflight 2.
    await o.batch([
      o.prepare("INSERT INTO periods VALUES ('p', 0, 200, 2, '', 0, 0)"),
      o.prepare("INSERT INTO reservations VALUES ('p','a',100,NULL,'held','h1',NULL,0,0,NULL)"),
      o.prepare("INSERT INTO reservations VALUES ('p','b',100,NULL,'held','h2',NULL,0,0,NULL)"),
    ]);
    const params = { pk: 'p', id: 'a', final: 'settled', a: 60, now: NOW, day: DAY, tok: 'tok1' };
    const oldSettle = () => [
      stmt(o, `UPDATE reservations SET state = :final, settled_u = :a, settled_at = :now, settle_token = :tok WHERE payment_key = :pk AND req_id = :id AND state = 'held'`, params),
      stmt(o, `UPDATE periods SET spent_u = spent_u + :a,
        reserved_u = MAX(0, reserved_u - (SELECT reserved_u FROM reservations WHERE payment_key=:pk AND req_id=:id)),
        inflight = MAX(0, inflight - 1),
        day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + :a,
        day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1, day = :day
        WHERE payment_key = :pk AND EXISTS (SELECT 1 FROM reservations WHERE payment_key = :pk AND req_id = :id AND settle_token = :tok)`, params),
    ];
    await o.batch(oldSettle());
    const once: any = await o.prepare("SELECT * FROM periods WHERE payment_key='p'").first();
    await o.batch(oldSettle()); // replay after a commit whose response was lost
    const twice: any = await o.prepare("SELECT * FROM periods WHERE payment_key='p'").first();
    console.log('OLD once', once, 'OLD replay', twice);
    expect(once.spent_u).toBe(60);
    expect(twice.spent_u).toBe(120); // double charge
    expect(twice.reserved_u).toBe(0); // request b's hold silently released too
    expect(twice.inflight).toBe(0);
    expect(twice.day_requests).toBe(2);
    await old.mf.dispose();
  });
});

describe('2. replay is idempotent', () => {
  it('reserve replay x5 changes the period once', async () => {
    await seed(db);
    const i = rin();
    expect((await reserve(db, i)).outcome).toBe('admitted');
    const after1 = await period(db);
    for (let k = 0; k < 5; k++) await db.batch(reserveStatements(db, i));
    const after = await period(db);
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
    const p = await period(db);
    expect(p).toMatchObject({ spent_u: 70, reserved_u: 0, inflight: 0, day_spent_u: 70, day_requests: 1 });
  });
  it('reserve replay after settle does not resurrect the hold', async () => {
    await seed(db);
    const i = rin();
    await reserve(db, i);
    await settle(db, { pk: i.pk, id: i.id, final: 'settled', a: 50, now: NOW, day: DAY });
    for (let k = 0; k < 3; k++) await db.batch(reserveStatements(db, i));
    expect(await period(db)).toMatchObject({ spent_u: 50, reserved_u: 0, inflight: 0 });
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
    let p = await period(db);
    expect(p.spent_u + p.reserved_u).toBeLessThanOrEqual(3750);
    expect(p).toMatchObject({ reserved_u: 3700, inflight: 37 });
    await Promise.all(admitted.map((x, k) => settle(db, { pk: 'pk1', id: x.row.req_id, final: 'settled', a: 50 + (k % 3) * 20, now: NOW, day: DAY })));
    p = await period(db);
    const expected = admitted.reduce((a, _x, k) => a + 50 + (k % 3) * 20, 0);
    expect(p).toMatchObject({ reserved_u: 0, inflight: 0, spent_u: expected, day_requests: 37 });
  });
  it('max_inflight and max_requests_per_day guards hold under concurrency', async () => {
    await seed(db);
    const res = await Promise.all(Array.from({ length: 20 }, () => reserve(db, rin({ maxInflight: 2 }))));
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
    expect((await period(db)).reserved_u).toBe(100); // no double reservation
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
    let p = await period(db);
    expect(p.spent_u).toBe(40 + 100); // refund charged 0
    const h1 = await reserve(db, { ...r, hold: 'again1' });
    expect(h1.outcome).toBe('admitted');
    const h2 = await reserve(db, { ...r, hold: 'again2' });
    expect(h2.outcome).toBe('in_progress');
    p = await period(db);
    expect(p).toMatchObject({ reserved_u: 100, inflight: 1 });
    // replay of the readmit batch is a no-op too
    await db.batch(reserveStatements(db, { ...r, hold: 'again1' }, true));
    expect(await period(db)).toMatchObject({ reserved_u: 100, inflight: 1 });
  });
  it('concurrent readmits of one refunded req admit exactly once', async () => {
    await seed(db);
    const r = rin();
    await reserve(db, r);
    await settle(db, { pk: 'pk1', id: r.id, final: 'refunded', a: 0, now: NOW, day: DAY });
    const out = await Promise.all(Array.from({ length: 10 }, (_v, k) => reserve(db, { ...r, hold: 'c' + k })));
    expect(out.filter((x) => x.outcome === 'admitted').length).toBe(1);
    expect((await period(db)).reserved_u).toBe(100);
  });
});

describe('5. crash, sweep, races', () => {
  const LATER = NOW + 20 * 60_000;
  it('sweep charges reserved_u once; late settle is a no-op; sweep twice is a no-op', async () => {
    await seed(db);
    const i = rin();
    await reserve(db, i);
    expect((await sweep(db, LATER, DAY)).swept).toBe(1);
    expect(await period(db)).toMatchObject({ spent_u: 100, reserved_u: 0, inflight: 0 });
    await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 30, now: LATER, day: DAY });
    expect((await sweep(db, LATER + 1, DAY)).swept).toBe(0);
    expect(await period(db)).toMatchObject({ spent_u: 100, reserved_u: 0, inflight: 0 });
    expect((await getReservation(db, 'pk1', i.id) as any).state).toBe('expired');
  });
  it('sweep racing a settle charges exactly once (either winner)', async () => {
    await seed(db);
    const ins = Array.from({ length: 20 }, () => rin());
    await Promise.all(ins.map((i) => reserve(db, i)));
    await Promise.all([
      sweep(db, LATER, DAY),
      ...ins.map((i) => settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 10, now: LATER, day: DAY })),
    ]);
    const p = await period(db);
    expect(p).toMatchObject({ reserved_u: 0, inflight: 0 });
    const rows: any = await db.prepare("SELECT state, settled_u FROM reservations").all();
    const charged = rows.results.reduce((a: number, r: any) => a + r.settled_u, 0);
    expect(p.spent_u).toBe(charged);
    expect(rows.results.every((r: any) => r.state === 'settled' || r.state === 'expired')).toBe(true);
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
    const before = await period(db);
    const out = await db.batch(sweepStatements(db, { pk: 'pk1', id: i.id, now: LATER, day: DAY })); // stale sweep
    expect(out[0].meta.changes + out[1].meta.changes).toBe(0);
    expect(await period(db)).toEqual(before);
    expect(before).toMatchObject({ reserved_u: 300, inflight: 1 });
    expect(((await getReservation(db, 'pk1', i.id)) as any)).toMatchObject({ state: 'held', hold_token: 'new', reserved_u: 300 });
  });
  it('the sweep charges the row\'s own reserved_u, and replaying the sweep batch charges once', async () => {
    await seed(db);
    const i = rin({ r: 250 });
    await reserve(db, i);
    for (let k = 0; k < 4; k++) await db.batch(sweepStatements(db, { pk: 'pk1', id: i.id, now: LATER, day: DAY }));
    expect(await period(db)).toMatchObject({ spent_u: 250, reserved_u: 0, inflight: 0, day_requests: 1 });
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
    for (const [pk, rc] of [['pkA', 'rcA'], ['pkB', 'rcB'], ['pkB', 'rcB']]) {
      const i = rin({ pk, rc });
      await reserve(db, i);
      await settle(db, { pk, id: i.id, final: 'settled', a: 10, now: NOW, day: DAY });
    }
    const flag = async () => ((await db.prepare("SELECT value FROM meta WHERE key='daily_full'").first()) as any)?.value;
    const below = await updateDailyFull(db, NOW, DAY, 4);
    expect(await flag()).toBe('0');
    expect((await reserve(db, rin({ pk: 'pkA', rc: 'rcA' }))).outcome).toBe('admitted');
    const unchanged = await updateDailyFull(db, NOW, DAY, 4); // still below: no write
    expect(unchanged.meta.rows_written).toBe(0);
    await settle(db, { pk: 'pkA', id: (await db.prepare("SELECT req_id FROM reservations WHERE state='held'").first() as any).req_id, final: 'settled', a: 10, now: NOW, day: DAY });
    const hit = await updateDailyFull(db, NOW, DAY, 4); // 4 settled requests today
    expect(await flag()).toBe('1');
    expect(hit.meta.rows_written).toBeGreaterThan(0);
    expect(below.meta.rows_written).toBeGreaterThan(0); // first creation of the flag
    const snap = async () => JSON.stringify([(await db.prepare('SELECT * FROM periods ORDER BY payment_key').all() as any).results, (await db.prepare('SELECT * FROM reservations ORDER BY req_id').all() as any).results]);
    const before = await snap();
    const outs = await Promise.all(Array.from({ length: 10 }, () => reserve(db, rin({ pk: 'pkA', rc: 'rcA' }))));
    expect(outs.every((o) => o.outcome === 'daily_full')).toBe(true);
    expect(outs.flatMap((o) => o.metas).every((m) => m.rows_written === 0)).toBe(true);
    expect(await snap()).toBe(before);
    // next day the count restarts and the cron reopens admission
    const reopened = await updateDailyFull(db, NOW + 86_400_000, '2027-01-16', 4);
    expect(await flag()).toBe('0');
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
    expect(await period(db)).toMatchObject({ spent_u: 450, reserved_u: 0, inflight: 0 });
  });
});

describe('7. CHECK constraints', () => {
  it('reserved_u < 0 fails and rolls back the whole settle batch', async () => {
    await seed(db);
    // corrupt: held reservation of 500 while the period only reserves 100
    await db.batch([
      db.prepare("UPDATE periods SET reserved_u = 100, inflight = 1 WHERE payment_key='pk1'"),
      db.prepare("INSERT INTO reservations VALUES ('pk1','bad',500,NULL,'held','h',0,0,NULL)"),
    ]);
    await expect(settle(db, { pk: 'pk1', id: 'bad', final: 'settled', a: 5, now: NOW, day: DAY })).rejects.toThrow();
    expect((await getReservation(db, 'pk1', 'bad') as any).state).toBe('held');
    expect(await period(db)).toMatchObject({ spent_u: 0, reserved_u: 100, inflight: 1 });
  });
  it('inflight < 0 fails the batch too', async () => {
    await seed(db);
    await db.batch([db.prepare("INSERT INTO reservations VALUES ('pk1','bad',0,NULL,'held','h',0,0,NULL)")]);
    await expect(settle(db, { pk: 'pk1', id: 'bad', final: 'settled', a: 5, now: NOW, day: DAY })).rejects.toThrow();
    expect((await period(db)).spent_u).toBe(0);
  });
  it('financial CHECK on periods rejects an over-large cap and rolls back', async () => {
    await seed(db);
    await expect(db.batch([
      db.prepare("UPDATE periods SET spent_u = 5 WHERE payment_key='pk1'"),
      db.prepare("UPDATE periods SET cap_u = cap_u * 2 WHERE payment_key='pk1'"),
    ])).rejects.toThrow();
    expect((await period(db)).spent_u).toBe(0);
  });
});

describe('8. cost measurement (D1 result meta from Miniflare)', () => {
  it('measures rows written/read per operation', async () => {
    const out: Record<string, any> = {};
    // period creation (+ device)
    const pc = await db.batch([
      db.prepare("INSERT INTO devices VALUES ('rc1', x'00', 'lin', 'active', 0, 0)"),
      db.prepare(`INSERT INTO periods (payment_key, lineage_key, store, period_start, period_end, proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u, created_at)
        VALUES ('pk1','lin','play_store',0,${NOW * 2},4060000,1920000,480000,0,768000,0)`),
    ]);
    out.deviceInsert = ms([pc[0].meta]); out.periodInsert = ms([pc[1].meta]);
    // reserve (happy path) incl. the read-back
    const i = rin();
    const r = await reserve(db, i);
    const rb: any = await db.prepare('SELECT * FROM reservations WHERE payment_key = ?1 AND req_id = ?2').bind(i.pk, i.id).run();
    out.reserveBatch = ms(r.metas); out.reserveBatchPerStmt = r.metas.map((m) => ({ w: m.rows_written, r: m.rows_read }));
    out.readback = ms([rb.meta]);
    const s = await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 50, now: NOW, day: DAY });
    out.settle = ms(s.map((x) => x.meta)); out.settlePerStmt = s.map((x) => ({ w: x.meta.rows_written, r: x.meta.rows_read }));
    // rejected reserve (budget exhausted): batch + readback + diagnose
    await db.prepare('UPDATE periods SET cap_u = 1, early_cap_u = 1').run();
    const rej = await reserve(db, rin());
    out.rejectedReserve = ms(rej.metas);
    // bulk: 5000 reservations for bytes/row + prune/sweep scan costs
    await db.prepare('UPDATE periods SET cap_u = 1920000, early_cap_u = 480000').run();
    const size0 = (await db.prepare('SELECT 1').run()).meta.size_after;
    const rows = Array.from({ length: 2000 }, (_v, k) => db.prepare(
      "INSERT INTO reservations VALUES ('pk1', ?1, 120000, 50000, 'settled', ?2, ?3, ?4, ?5)").bind('11111111-2222-4333-8444-' + String(k).padStart(12, '0'), 'hold-' + k.toString(16).padStart(32, '0'), NOW - 9 * 86_400_000, NOW - 9 * 86_400_000 + 120000, NOW - 9 * 86_400_000 + 900));
    for (let k = 0; k < rows.length; k += 500) await db.batch(rows.slice(k, k + 500));
    // a second table state: 5000 fresh rows that must NOT be pruned
    const fresh = Array.from({ length: 2000 }, (_v, k) => db.prepare(
      "INSERT INTO reservations VALUES ('pk1', ?1, 120000, 50000, 'settled', ?2, ?3, ?4, ?5)").bind('fresh-' + k, 'hold-' + k.toString(16).padStart(32, '0'), NOW, NOW + 120000, NOW + 900));
    for (let k = 0; k < fresh.length; k += 500) await db.batch(fresh.slice(k, k + 500));
    const size1 = (await db.prepare('SELECT 1').run()).meta.size_after;
    out.bytesPerReservationRow = (size1 - size0) / 4000;
    const pr = await prune(db, NOW);
    out.pruneReservations2000of4000 = { w: pr.reservations.meta.rows_written, r: pr.reservations.meta.rows_read, changes: pr.reservations.meta.changes };
    // cron cost vs table size. Periods are 'live' (period_end in the future) or 'old' (ended 10 days ago: kept 60 days).
    const periodInsert = (k: number, end: number) => db.prepare(`INSERT INTO periods (payment_key, lineage_key, store, period_start, period_end, proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u, created_at)
      VALUES (?1, ?2,'play_store',0,?3,4060000,1920000,480000,0,768000,0)`).bind('bulk' + k + 'x'.repeat(40), 'lin-bulk' + k + 'y'.repeat(30), end);
    const fill = async (from: number, to: number, end: number) => {
      const st = Array.from({ length: to - from }, (_v, k) => periodInsert(from + k, end));
      for (let k = 0; k < st.length; k += 500) await db.batch(st.slice(k, k + 500));
    };
    const cron = async (label: string) => {
      const sw = await sweep(db, NOW, DAY);
      const gl = await updateDailyFull(db, NOW, DAY, 1e9);
      out['cron_' + label] = { periodRowsInTable: ((await db.prepare('SELECT COUNT(*) c FROM periods').first()) as any).c, sweepReads: ms(sw.metas).r, globalFlagReads: gl.meta.rows_read, globalFlagWrites: gl.meta.rows_written };
    };
    await db.prepare('DELETE FROM periods').run();
    await db.prepare('DELETE FROM reservations').run();
    const s0 = (await db.prepare('SELECT 1').run()).meta.size_after;
    await fill(0, 1500, NOW * 2);
    const s1 = (await db.prepare('SELECT 1').run()).meta.size_after;
    out.bytesPerPeriodRow = (s1 - s0) / 1500;
    await cron('1500_live');
    await fill(1500, 3000, NOW - 10 * 86_400_000); // history that is still kept
    await cron('1500_live_plus_1500_history');
    await db.prepare('DELETE FROM periods WHERE payment_key LIKE ?1').bind('bulk1%').run();
    await db.prepare('DELETE FROM periods').run();
    await fill(0, 3000, NOW * 2);
    await cron('3000_live');
    // period prune: 1500 periods ended 70 days ago among 3000
    await db.prepare('DELETE FROM periods').run();
    await fill(0, 1500, NOW * 2);
    await fill(1500, 3000, NOW - 70 * 86_400_000);
    const pp = await prune(db, NOW);
    out.prunePeriods1500of3000 = { w: pp.periods.meta.rows_written, r: pp.periods.meta.rows_read, changes: pp.periods.meta.changes };
    out.pruneReservationsOnEmptyTable = { w: pp.reservations.meta.rows_written, r: pp.reservations.meta.rows_read };
    console.log(JSON.stringify(out, null, 2));
    writeFileSync(new URL('./cost.json', import.meta.url), JSON.stringify(out, null, 2));
    expect(out.settle.w).toBeGreaterThan(0);
  });
});
