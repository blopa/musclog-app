import { describe, expect, it } from 'vitest';

import { createOtariClient } from '../src/upstream/otari';

interface Seen {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
  signal: AbortSignal | null | undefined;
}

function client(respond: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const c = createOtariClient({
    baseUrl: 'https://otari.test/api/v1/',
    apiKey: 'otari-SECRET',
    fetch: async (input, init) => {
      const s: Seen = {
        url: String(input),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: (init?.body as string) ?? null,
        signal: init?.signal,
      };
      seen.push(s);
      return respond(s);
    },
  });
  return { c, seen };
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

describe('chatCompletions', () => {
  it('POSTs the body with the bearer key and the signal, returning the raw response', async () => {
    const { c, seen } = client(() => json({ ok: 1 }, 500));
    const ac = new AbortController();
    const res = await c.chatCompletions('{"a":1}', { signal: ac.signal });
    expect(res.status).toBe(500);
    expect(seen[0]).toMatchObject({
      url: 'https://otari.test/api/v1/chat/completions',
      method: 'POST',
      body: '{"a":1}',
    });
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer otari-SECRET');
    expect(seen[0]!.headers.get('content-type')).toBe('application/json');
    expect(seen[0]!.signal).toBe(ac.signal);
  });
});

describe('usageSummary', () => {
  it('asks for the window in epoch seconds with no dimensions and maps the totals', async () => {
    const { c, seen } = client(() =>
      json({
        totals: { cost: 1.234567, request_count: 7, error_count: 1, unpriced_requests: 2 },
        groups: [],
      })
    );
    expect(await c.usageSummary(1_800_000_000_500, 1_800_000_100_001)).toEqual({
      costUsd: 1.234567,
      requests: 7,
      errors: 1,
      unpriced: 2,
    });
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe(
      'https://otari.test/api/v1/key/usage/summary?start_date=1800000000&end_date=1800000101&dimensions=none'
    );
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer otari-SECRET');
    expect(seen[0]!.signal).toBeTruthy();
  });

  it('defaults missing counters to 0 and refuses a missing or negative cost', async () => {
    expect(await client(() => json({ totals: { cost: 0 } })).c.usageSummary(0, 1000)).toEqual({
      costUsd: 0,
      requests: 0,
      errors: 0,
      unpriced: 0,
    });
    for (const body of [
      {},
      { totals: {} },
      { totals: { cost: '1' } },
      { totals: { cost: -1 } },
      [],
    ]) {
      await expect(client(() => json(body)).c.usageSummary(0, 1000)).rejects.toThrow(
        'otari_bad_usage_response'
      );
    }
  });

  it('throws otari_http_<status> on a non-OK answer, never echoing the key', async () => {
    const e = await client(() => json({ detail: 'nope' }, 401))
      .c.usageSummary(0, 1000)
      .catch((x) => x);
    expect((e as Error).message).toBe('otari_http_401');
    expect(String(e)).not.toContain('otari-SECRET');
  });
});

describe('budget', () => {
  it('maps enforcement and the remaining budget', async () => {
    const { c, seen } = client(() =>
      json({ budgets_enforced: true, remaining_usd: 12.5, limits: [] })
    );
    expect(await c.budget()).toEqual({ enforced: true, remainingUsd: 12.5 });
    expect(seen[0]!.url).toBe('https://otari.test/api/v1/key/budget');
  });

  it('a null remaining budget stays null', async () => {
    expect(
      await client(() => json({ budgets_enforced: false, remaining_usd: null })).c.budget()
    ).toEqual({ enforced: false, remainingUsd: null });
  });

  it('refuses an odd body and throws on errors', async () => {
    await expect(client(() => json({ remaining_usd: 1 })).c.budget()).rejects.toThrow(
      'otari_bad_budget_response'
    );
    await expect(client(() => json({}, 503)).c.budget()).rejects.toThrow('otari_http_503');
  });
});
