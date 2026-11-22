// Plan 13 row 5: the Free-tier projection at MAX_SUBSCRIBERS with the mix profile, from rows
// MEASURED here (a full request and the prune) plus the session mint pinned in session.test.ts.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { prune, PRUNE_MS } from '../src/ledger';
import { call, chatBody } from './chatHarness';
import { countingDb } from './fakes/countingDb';
import { fakeOpenRouter, jsonCompletion } from './fakes/openrouter';
import { seed, wipe } from './fakes/seed';
import { NOW, testConfig } from './fakes/ctx';

const D1_FREE_ROWS_WRITTEN_PER_DAY = 100_000;
const SESSION_MINT_WRITES = 1; // asserted in test/session.test.ts
const SESSIONS_PER_SUBSCRIBER_PER_DAY = 3; // plan section 4: about 4.5k/day at 1,500
const PERIOD_WRITES_PER_SUBSCRIBER_PER_DAY = 0.2; // 3 to create + 3 to prune, per monthly payment

async function measuredRequestWrites(): Promise<number> {
  await wipe(env.DB);
  await seed(env.DB, { cap: 1_000_000 });
  const counting = countingDb(env.DB);
  const r = await call({
    or: fakeOpenRouter(jsonCompletion(0.0005)),
    env: { DB: counting.db },
    body: chatBody(),
  });
  expect(r.res.status).toBe(200);
  await r.done();
  return counting.rowsWritten();
}

async function measuredPruneWritesPerReservation(): Promise<number> {
  await wipe(env.DB);
  await seed(env.DB, { cap: 1_000_000 });
  const old = NOW - PRUNE_MS - 1;
  await env.DB.batch(
    Array.from({ length: 20 }, (_, i) =>
      env.DB.prepare(
        `INSERT INTO reservations (payment_key, req_id, body_hash, reserved_u, settled_u, state, hold_token, created_at, expires_at, settled_at)
         VALUES ('pk1', ?1, 'h', 1, 1, 'settled', 'x', ?2, ?2, ?2)`
      ).bind(`r${i}`, old)
    )
  );
  const counting = countingDb(env.DB);
  await prune(counting.db, NOW);
  return counting.rowsWritten() / 20;
}

describe('Free-tier projection (plan section 4)', () => {
  beforeEach(() => wipe(env.DB));

  it('the mix profile at MAX_SUBSCRIBERS stays at or below 60% of the D1 write limit', async () => {
    const c = testConfig();
    const perRequest =
      (await measuredRequestWrites()) + (await measuredPruneWritesPerReservation());
    expect(perRequest).toBeLessThanOrEqual(6);

    const subs = c.limits.max_subscribers;
    // 70% light at 2 requests/day, 25% average at 5, 5% heavy at 30.
    const requestsPerDay = subs * (0.7 * 2 + 0.25 * 5 + 0.05 * 30);
    const writes =
      requestsPerDay * perRequest +
      subs * SESSIONS_PER_SUBSCRIBER_PER_DAY * SESSION_MINT_WRITES +
      subs * PERIOD_WRITES_PER_SUBSCRIBER_PER_DAY;
    console.info(
      `mix at ${subs}: ${requestsPerDay} requests/day, ${writes} rows written/day ` +
        `(${((100 * writes) / D1_FREE_ROWS_WRITTEN_PER_DAY).toFixed(1)}% of Free)`
    );
    expect(requestsPerDay).toBeLessThanOrEqual(c.limits.global_max_requests_per_day);
    expect(writes).toBeLessThanOrEqual(0.6 * D1_FREE_ROWS_WRITTEN_PER_DAY);
  });

  it('even at GLOBAL_MAX_REQUESTS_PER_DAY the daily writes stay under the Free limit', async () => {
    const c = testConfig();
    const perRequest =
      (await measuredRequestWrites()) + (await measuredPruneWritesPerReservation());
    const subs = c.limits.max_subscribers;
    const writes =
      c.limits.global_max_requests_per_day * perRequest +
      subs * SESSIONS_PER_SUBSCRIBER_PER_DAY * SESSION_MINT_WRITES +
      subs * PERIOD_WRITES_PER_SUBSCRIBER_PER_DAY;
    console.info(
      `at the global max: ${writes} rows written/day ` +
        `(${((100 * writes) / D1_FREE_ROWS_WRITTEN_PER_DAY).toFixed(1)}% of Free)`
    );
    // The plan sized the global max for 60% before session writes were counted; with them it is
    // about 64% (reported to the maintainer). The hard requirement is staying under the limit.
    expect(writes).toBeLessThan(D1_FREE_ROWS_WRITTEN_PER_DAY);
  });
});
