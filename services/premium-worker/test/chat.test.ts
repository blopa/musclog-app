import { env } from 'cloudflare:test';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TIMEOUTS } from '../src/proxy/chat';
import { getPeriod, seed, wipe } from './fakes/seed';
import {
  allRecorded,
  fakeOpenRouter,
  jsonCompletion,
  sseChunks,
  sseCompletion,
} from './fakes/openrouter';
import { testConfig } from './fakes/ctx';
import {
  call,
  chatBody,
  IDEM,
  meta,
  onlyReservation,
  reservations,
  tokenFor,
  until,
  watch,
  NOW,
} from './chatHarness';
import { mintSessionToken } from '../src/identity/token';

const spies = ['log', 'info', 'warn', 'error'].map((m) =>
  vi.spyOn(console, m as 'log').mockImplementation(() => {})
);
let allowOverrun = false;
const patched = { ...TIMEOUTS };

beforeAll(() => {
  watch.secrets.add(env.OPENROUTER_API_KEY);
});
beforeEach(async () => {
  await wipe(env.DB);
  await seed(env.DB);
  allowOverrun = false;
});
afterEach(async () => {
  Object.assign(TIMEOUTS, patched);
  // Privacy invariant (plan 13 row 6): every upstream body in the suite.
  const model = testConfig().model;
  for (const rec of allRecorded) {
    expect(rec.body.provider.zdr).toBe(true);
    expect(rec.body.provider.data_collection).toBe('deny');
    expect(rec.body.model).toBe(model);
  }
  allRecorded.length = 0;
  // Ledger invariants: nothing left in flight, every reservation in one final state.
  const rows = await reservations();
  for (const r of rows) expect(['settled', 'refunded']).toContain(r.state);
  const p = await getPeriod(env.DB);
  expect(p.reserved_u).toBe(0);
  expect(p.inflight).toBe(0);
  if (!allowOverrun) expect(p.spent_u + p.reserved_u).toBeLessThanOrEqual(p.cap_u);
});
afterAll(() => {
  const text = JSON.stringify(watch.logs) + JSON.stringify(spies.flatMap((s) => s.mock.calls));
  expect(watch.logs.length).toBeGreaterThan(0);
  for (const s of watch.secrets) expect(text).not.toContain(s);
});

const errBody = async (res: Response) =>
  ((await res.json()) as { error: Record<string, unknown> }).error;

describe('accounting', () => {
  it('non-stream success charges usage.cost and forwards the body', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.00123));
    const { res, done } = await call({ or });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-musclog-budget-remaining-pct')).toMatch(/^\d+$/);
    expect(((await res.json()) as { id: string }).id).toBe('gen-json-1');
    await done();
    const r = await onlyReservation();
    expect(r).toMatchObject({ state: 'settled', settled_u: 1230 });
    expect((await getPeriod(env.DB)).spent_u).toBe(1230);
    // upstream body: allowlisted, forced, user = lineage prefix, client junk gone
    const sent = or.calls[0]!.body;
    expect(sent.user).toBe('lin-pk1');
    expect(sent.model).toBe(testConfig().model);
    expect(sent.stream).toBe(false);
  });

  it('streaming success relays every byte unchanged and charges the tail usage', async () => {
    const chunks = sseChunks({ cost: 0.00456, pieces: ['a', 'b', 'c'] });
    const or = fakeOpenRouter({ kind: 'sse', chunks });
    const { res, done } = await call({ or, body: chatBody({ stream: true }) });
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(await res.text()).toBe(chunks.join(''));
    await done();
    expect(await onlyReservation()).toMatchObject({ state: 'settled', settled_u: 4560 });
    expect(or.generationCalls).toEqual([]);
  });

  it('a stream ending in an error chunk with usage is charged that usage', async () => {
    const or = fakeOpenRouter({
      kind: 'sse',
      chunks: sseChunks({ errorChunk: true, cost: 0.002 }),
    });
    const { res, done } = await call({ or, body: chatBody({ stream: true }) });
    await res.text();
    await done();
    expect((await onlyReservation()).settled_u).toBe(2000);
  });

  it('a stream error chunk without usage uses the generation lookup', async () => {
    const or = fakeOpenRouter({ kind: 'sse', chunks: sseChunks({ errorChunk: true }) });
    or.generations.push({ total_cost: 0.003 });
    const { res, done } = await call({ or, body: chatBody({ stream: true }) });
    await res.text();
    await done();
    expect((await onlyReservation()).settled_u).toBe(3000);
    expect(or.generationCalls).toEqual(['gen-sse-1']);
  });

  it('a cut stream (upstream read error) is charged the generation lookup cost', async () => {
    const or = fakeOpenRouter({
      kind: 'sse',
      chunks: sseChunks({ done: false }).slice(0, 3),
      then: 'error',
    });
    or.generations.push(null, { total_cost: 0.0021 });
    const { res, deps, done } = await call({ or, body: chatBody({ stream: true }) });
    await res.text().catch(() => {});
    await done();
    expect((await onlyReservation()).settled_u).toBe(2100);
    expect(or.generationCalls).toHaveLength(2);
    expect(deps.sleeps).toEqual([1000]);
  });

  it('a lookup failing three times charges the reservation', async () => {
    const or = fakeOpenRouter({
      kind: 'sse',
      chunks: sseChunks({ done: false }).slice(0, 3),
      then: 'error',
    });
    or.generations.push(null, new Error('boom'), null);
    const { res, deps, done } = await call({ or, body: chatBody({ stream: true }) });
    await res.text().catch(() => {});
    await done();
    const r = await onlyReservation();
    expect(r.settled_u).toBe(r.reserved_u);
    expect(or.generationCalls).toHaveLength(3);
    expect(deps.sleeps).toEqual([1000, 2000]);
  });

  it('a non-stream 2xx without usage looks the generation up from x-generation-id', async () => {
    const or = fakeOpenRouter(jsonCompletion(null, 'x', 'gen-abc'));
    or.generations.push({ total_cost: 0.0007 });
    const { res, done } = await call({ or });
    expect(res.status).toBe(200);
    await res.text();
    await done();
    expect((await onlyReservation()).settled_u).toBe(700);
    expect(or.generationCalls).toEqual(['gen-abc']);
  });

  it('an overrun is charged in full and recorded', async () => {
    allowOverrun = true;
    const or = fakeOpenRouter(jsonCompletion(0.05));
    const { res, deps, done } = await call({ or });
    await res.text();
    await done();
    const r = await onlyReservation();
    expect(r.settled_u).toBe(50_000);
    expect(r.settled_u!).toBeGreaterThan(r.reserved_u);
    expect((await getPeriod(env.DB)).spent_u).toBe(50_000);
    expect(JSON.parse((await meta('overruns'))!)).toEqual([NOW]);
    expect(deps.logs.at(-1)).toMatchObject({ status: 200, cost_u: 50_000, overrun: true });
  });

  it('upstream 500 is refunded: nothing spent, 502', async () => {
    const or = fakeOpenRouter({ kind: 'http', status: 500 });
    const { res, done } = await call({ or });
    expect(res.status).toBe(502);
    expect((await errBody(res)).code).toBe('upstream_error');
    await done();
    expect(await onlyReservation()).toMatchObject({ state: 'refunded', settled_u: 0 });
    expect((await getPeriod(env.DB)).spent_u).toBe(0);
  });

  it.each([
    [402, 'upstream_402'],
    [403, 'upstream_403'],
  ])('upstream %i opens the breaker and answers 503', async (status, reason) => {
    const or = fakeOpenRouter({ kind: 'http', status });
    const { res, deps, done } = await call({ or });
    expect(res.status).toBe(503);
    const text = JSON.stringify(await errBody(res));
    expect(text).toContain('hosted_disabled');
    expect(text).not.toContain('SECRET_UPSTREAM_BODY');
    await done();
    expect(await meta('breaker')).toBe('open');
    expect(await meta('breaker_reason')).toBe(reason);
    expect((await onlyReservation()).state).toBe('refunded');
    expect(deps.logs.at(-1)).toMatchObject({ status: 503, severity: 'high' });
  });

  it('upstream 404 (no ZDR endpoint) answers 503 without opening the breaker', async () => {
    const or = fakeOpenRouter({ kind: 'http', status: 404 });
    const { res, deps, done } = await call({ or });
    expect(res.status).toBe(503);
    await done();
    expect(await meta('breaker')).toBeNull();
    expect((await onlyReservation()).state).toBe('refunded');
    expect(deps.logs.at(-1)).toMatchObject({ status: 503, severity: 'high' });
  });

  it('a timeout before the response is 504 and charged the reservation', async () => {
    TIMEOUTS.overallMs = 30;
    const or = fakeOpenRouter({ kind: 'hang' });
    const { res, done } = await call({ or });
    expect(res.status).toBe(504);
    expect((await errBody(res)).code).toBe('upstream_timeout');
    await done();
    const r = await onlyReservation();
    expect(r).toMatchObject({ state: 'settled' });
    expect(r.settled_u).toBe(r.reserved_u);
  });

  it('a network error is 502 and charged the reservation', async () => {
    const or = fakeOpenRouter({ kind: 'throw' });
    const { res, done } = await call({ or });
    expect(res.status).toBe(502);
    await done();
    const r = await onlyReservation();
    expect(r.state).toBe('settled');
    expect(r.settled_u).toBe(r.reserved_u);
  });

  it('a stream that stalls hits the idle timeout and settles via lookup', async () => {
    TIMEOUTS.streamIdleMs = 40;
    const or = fakeOpenRouter({
      kind: 'sse',
      chunks: sseChunks({ done: false }).slice(0, 2),
      then: 'stall',
    });
    or.generations.push({ total_cost: 0.0015 });
    const { res, done } = await call({ or, body: chatBody({ stream: true }) });
    await res.text().catch(() => {});
    await done();
    expect((await onlyReservation()).settled_u).toBe(1500);
    expect(or.calls[0]!.signal.aborted).toBe(true);
  });

  it('a client disconnect mid-stream aborts upstream and still settles', async () => {
    const or = fakeOpenRouter({
      kind: 'sse',
      chunks: sseChunks({ done: false }).slice(0, 2),
      then: 'stall',
    });
    const { res, done } = await call({ or, body: chatBody({ stream: true }) });
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await done();
    expect(or.calls[0]!.signal.aborted).toBe(true);
    const r = await onlyReservation();
    expect(r.state).toBe('settled');
    expect(r.settled_u).toBe(r.reserved_u); // no usage and no lookup result: charged r
  });
});

describe('idempotency', () => {
  it('the same key twice: second is 409 already_processed, one upstream call, one charge', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const first = await call({ or });
    await first.res.text();
    await first.done();
    const second = await call({ or });
    expect(second.res.status).toBe(409);
    expect(second.res.headers.get('x-should-retry')).toBe('false');
    expect((await errBody(second.res)).code).toBe('already_processed');
    await second.done();
    expect(or.calls).toHaveLength(1);
    expect((await getPeriod(env.DB)).spent_u).toBe(1000);
  });

  it('two concurrent same-key requests: one upstream call, the other 409 in_progress', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const or = fakeOpenRouter(async () => {
      await gate;
      return jsonCompletion(0.001);
    });
    const p1 = call({ or });
    await until(() => or.calls.length === 1);
    const second = await call({ or });
    expect(second.res.status).toBe(409);
    expect(second.res.headers.get('retry-after')).toBe('2');
    expect((await errBody(second.res)).code).toBe('in_progress');
    release();
    const first = await p1;
    expect(first.res.status).toBe(200);
    await first.res.text();
    await first.done();
    await second.done();
    expect(or.calls).toHaveLength(1);
  });

  it('the same key with another body is 422 idempotency_mismatch', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const a = await call({ or });
    await a.res.text();
    await a.done();
    const b = await call({
      or,
      body: chatBody({ messages: [{ role: 'user', content: 'a different prompt' }] }),
    });
    expect(b.res.status).toBe(422);
    expect((await errBody(b.res)).code).toBe('idempotency_mismatch');
    await b.done();
    expect(or.calls).toHaveLength(1);
  });

  it('a refunded request can be retried with the same key and body', async () => {
    let n = 0;
    const or = fakeOpenRouter(() =>
      n++ === 0 ? { kind: 'http', status: 500 } : jsonCompletion(0.001)
    );
    const a = await call({ or });
    expect(a.res.status).toBe(502);
    await a.done();
    const b = await call({ or });
    expect(b.res.status).toBe(200);
    await b.res.text();
    await b.done();
    expect(await onlyReservation()).toMatchObject({ state: 'settled', settled_u: 1000 });
  });

  it('missing or invalid Idempotency-Key is 400', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    for (const key of [null, 'short', 'bad key with spaces!', 'x'.repeat(129)]) {
      const { res } = await call({ or, key });
      expect(res.status).toBe(400);
      expect(((await errBody(res)) as { path: string }).path).toBe('header.Idempotency-Key');
    }
    expect(or.calls).toHaveLength(0);
  });
});

describe('gates', () => {
  it('missing, bad and expired tokens are 401 with no upstream call', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    expect((await call({ or, token: null })).res.status).toBe(401);
    expect((await call({ or, token: 'v1.abc.def' })).res.status).toBe(401);
    const old = (await mintSessionToken(env.SESSION_HMAC_KEY, 'rc1', NOW - 2 * 3_600_000)).token;
    expect((await call({ or, token: old })).res.status).toBe(401);
    expect(or.calls).toHaveLength(0);
  });

  it('a revoked device is 401 unknown_device with no upstream call', async () => {
    await wipe(env.DB);
    await seed(env.DB, { deviceStatus: 'revoked' });
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or });
    expect(res.status).toBe(401);
    expect((await errBody(res)).code).toBe('unknown_device');
    expect(or.calls).toHaveLength(0);
  });

  it('an unknown caller is 401 unknown_device', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or, token: await tokenFor('rc-nobody') });
    expect(res.status).toBe(401);
  });

  it('a breaker that is open answers 503 with no upstream call', async () => {
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('breaker', 'open')").run();
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or });
    expect(res.status).toBe(503);
    expect((await errBody(res)).code).toBe('hosted_disabled');
    expect(or.calls).toHaveLength(0);
  });

  it('daily_full answers 503 daily_full', async () => {
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('daily_full', '1')").run();
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or });
    expect(res.status).toBe(503);
    expect((await errBody(res)).code).toBe('daily_full');
    expect(or.calls).toHaveLength(0);
  });

  it('a D1 failure on reserve is 503 with zero upstream calls', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const broken = {
      prepare: (s: string) => env.DB.prepare(s),
      batch: () => {
        throw new Error('d1 down');
      },
    };
    const { res, deps } = await call({ or, env: { DB: broken } });
    expect(res.status).toBe(503);
    expect((await errBody(res)).code).toBe('hosted_disabled');
    expect(or.calls).toHaveLength(0);
    expect(deps.logs.at(-1)).toMatchObject({ status: 503, severity: 'error' });
  });

  it('budget exhausted is 402 with used_pct and resets_at, not retried', async () => {
    await wipe(env.DB);
    await seed(env.DB, { cap: 100 });
    await env.DB.prepare('UPDATE periods SET spent_u = 90').run();
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or });
    expect(res.status).toBe(402);
    expect(res.headers.get('x-should-retry')).toBe('false');
    const e = await errBody(res);
    expect(e).toMatchObject({ code: 'budget_exhausted', used_pct: 90 });
    expect(e.resets_at).toBe(new Date(NOW + 30 * 86_400_000).toISOString());
    expect(or.calls).toHaveLength(0);
    expect(await reservations()).toHaveLength(0);
  });

  it('the daily limit is 402 daily_limit resetting at the next UTC midnight', async () => {
    await wipe(env.DB);
    await seed(env.DB, { cap: 1_000_000, daily: 100 });
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or });
    expect(res.status).toBe(402);
    const e = await errBody(res);
    expect(e).toMatchObject({ code: 'daily_limit', resets_at: '2027-01-16T00:00:00.000Z' });
    expect(or.calls).toHaveLength(0);
  });

  it('a rate limiter that refuses is 429 busy before any D1 work', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const keys: string[] = [];
    const { res } = await call({
      or,
      env: {
        RATE_LIMITER: {
          limit: async (o: { key: string }) => (keys.push(o.key), { success: false }),
        },
      },
    });
    expect(res.status).toBe(429);
    expect(keys).toEqual(['chat:rc1']);
    expect(or.calls).toHaveLength(0);
  });
});

describe('request validation through the endpoint', () => {
  it.each(['plugins', 'provider', 'user', 'web_search_options'])(
    'a %s field is 400 and never reaches upstream',
    async (key) => {
      const or = fakeOpenRouter(jsonCompletion(0.001));
      const { res } = await call({ or, body: chatBody({ [key]: { x: 1 } }) });
      expect(res.status).toBe(400);
      expect(((await errBody(res)) as { path: string }).path).toBe(key);
      expect(or.calls).toHaveLength(0);
      expect(await reservations()).toHaveLength(0);
    }
  );

  it('invalid JSON is 400', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or, rawBody: '{nope' });
    expect(res.status).toBe(400);
  });

  it('forces the upstream body: model, provider, reasoning, clamped max_tokens', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res, done } = await call({
      or,
      body: chatBody({
        max_tokens: 10 ** 7,
        temperature: 99,
        stream_options: { include_usage: true },
      }),
    });
    await res.text();
    await done();
    const sent = or.calls[0]!.body;
    expect(sent.max_tokens).toBe(testConfig().features.chat.max_tokens);
    expect(sent.temperature).toBe(testConfig().features.chat.temperature_max);
    expect(sent.reasoning).toEqual({ effort: 'low' });
    expect(sent.provider.allow_fallbacks).toBe(false);
    expect(sent).not.toHaveProperty('stream_options');
  });

  it('a client reasoning_effort is clamped to the ceiling and never forwarded', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const cfg = testConfig();
    cfg.features.chat.reasoning = 'low';
    cfg.features.chat.reasoning_max = 'medium';
    const { res, done } = await call({
      or,
      config: cfg,
      body: chatBody({ reasoning_effort: 'high' }),
    });
    expect(res.status).toBe(200);
    await res.text();
    await done();
    const sent = or.calls[0]!.body;
    expect(sent.reasoning).toEqual({ effort: 'medium' });
    expect(sent).not.toHaveProperty('reasoning_effort');
  });

  it('a structured request is derived as structured', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res, done } = await call({
      or,
      body: chatBody({
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'x', strict: true, schema: { type: 'object' } },
        },
      }),
    });
    await res.text();
    await done();
    expect(or.calls[0]!.body.max_tokens).toBe(testConfig().features.structured.max_tokens);
  });
});

describe('body cap', () => {
  const cap = testConfig().limits.body_max_bytes;
  const big = JSON.stringify(chatBody({ messages: [{ role: 'user', content: 'x'.repeat(cap) }] }));

  it('body_max_bytes + 1 is 413 with no upstream call and no D1 reads', async () => {
    const { countingDb } = await import('./fakes/countingDb');
    const counting = countingDb(env.DB);
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const { res } = await call({ or, rawBody: big, env: { DB: counting.db } });
    expect(res.status).toBe(413);
    expect(or.calls).toHaveLength(0);
    expect(counting.rowsRead()).toBe(0);
    expect(counting.rowsWritten()).toBe(0);
  });

  it('a lying content-length and a streamed body are still capped', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const bytes = new TextEncoder().encode(big);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(bytes.slice(0, 1000));
        c.enqueue(bytes.slice(1000));
        c.close();
      },
    });
    const lying = await call({ or, rawBody: stream, headers: { 'content-length': '10' } });
    expect(lying.res.status).toBe(413);
    const chunked = await call({ or, rawBody: big, headers: { 'content-length': '10' } });
    expect(chunked.res.status).toBe(413);
    expect(or.calls).toHaveLength(0);
  });
});

describe('max_tokens_by_effort end to end', () => {
  it('a high client effort gets the high entry upstream and settles', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.001));
    const cfg = testConfig();
    cfg.features.chat.reasoning = 'low';
    cfg.features.chat.reasoning_max = 'high';
    cfg.features.chat.max_tokens_by_effort = { high: 4500 };
    const { res, done } = await call({
      or,
      config: cfg,
      body: chatBody({ reasoning_effort: 'high' }),
    });
    expect(res.status).toBe(200);
    await res.text();
    await done();
    const sent = or.calls[0]!.body;
    expect(sent.max_tokens).toBe(4500);
    expect(sent.reasoning).toEqual({ effort: 'high' });
    expect(sent).not.toHaveProperty('reasoning_effort');
  });
});
