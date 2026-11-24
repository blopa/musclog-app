// Plan 13 row 5 (user acceptance): rows written per request stay <= 6.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { countingDb } from './fakes/countingDb';
import { fakeOpenRouter, jsonCompletion, sseCompletion } from './fakes/openrouter';
import { fakeOtari, otariJsonCompletion, otariSseCompletion } from './fakes/otari';
import { seed, wipe } from './fakes/seed';
import { call, chatBody, useOtari } from './chatHarness';

beforeEach(async () => {
  await wipe(env.DB);
  await seed(env.DB);
});

describe('rows written per request', () => {
  it('a full non-stream request writes <= 6 rows', async () => {
    const counting = countingDb(env.DB);
    const or = fakeOpenRouter(jsonCompletion(0.0005));
    const { res, done } = await call({ or, env: { DB: counting.db } });
    await res.text();
    await done();
    console.info(`non-stream: written=${counting.rowsWritten()} read=${counting.rowsRead()}`);
    expect(counting.rowsWritten()).toBeLessThanOrEqual(6);
    expect(counting.rowsWritten()).toBe(5); // reserve 3 + settle 2
  });

  it('a full streaming request writes <= 6 rows', async () => {
    const counting = countingDb(env.DB);
    const or = fakeOpenRouter(sseCompletion(0.0005));
    const { res, done } = await call({
      or,
      body: chatBody({ stream: true }),
      env: { DB: counting.db },
    });
    await res.text();
    await done();
    console.info(`stream: written=${counting.rowsWritten()} read=${counting.rowsRead()}`);
    expect(counting.rowsWritten()).toBeLessThanOrEqual(6);
  });

  it('refused requests (budget, daily_full) write nothing', async () => {
    const or = fakeOpenRouter(jsonCompletion(0.0005));
    await wipe(env.DB);
    await seed(env.DB, { cap: 100 });
    const a = countingDb(env.DB);
    expect((await call({ or, env: { DB: a.db } })).res.status).toBe(402);
    expect(a.rowsWritten()).toBe(0);
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('daily_full', '1')").run();
    const b = countingDb(env.DB);
    expect((await call({ or, env: { DB: b.db } })).res.status).toBe(503);
    expect(b.rowsWritten()).toBe(0);
    expect(or.calls).toHaveLength(0);
  });
});

describe('rows written per request on Otari', () => {
  it('a full non-stream request writes the same 5 rows (the toggle is only read)', async () => {
    await useOtari();
    const counting = countingDb(env.DB);
    const otari = fakeOtari(otariJsonCompletion('0.000500'));
    const { res, done } = await call({ otari, env: { DB: counting.db } });
    await res.text();
    await done();
    expect(counting.rowsWritten()).toBe(5);
  });

  it('a full streaming request writes <= 6 rows', async () => {
    await useOtari();
    const counting = countingDb(env.DB);
    const otari = fakeOtari(otariSseCompletion('0.000500'));
    const { res, done } = await call({
      otari,
      body: chatBody({ stream: true }),
      env: { DB: counting.db },
    });
    await res.text();
    await done();
    expect(counting.rowsWritten()).toBeLessThanOrEqual(6);
  });
});
