import { describe, expect, it } from 'vitest';

import { createOpenRouterClient } from '../src/upstream/openrouter';

interface Seen {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
  signal: AbortSignal | null | undefined;
}

function client(respond: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const c = createOpenRouterClient({
    baseUrl: 'https://or.test/api/v1/',
    apiKey: 'sk-SECRET',
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
      url: 'https://or.test/api/v1/chat/completions',
      method: 'POST',
      body: '{"a":1}',
    });
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer sk-SECRET');
    expect(seen[0]!.headers.get('content-type')).toBe('application/json');
    expect(seen[0]!.signal).toBe(ac.signal);
  });
});

describe('getGeneration', () => {
  it('returns total_cost, null on 404 or when missing, throws on other errors', async () => {
    const ok = client(() => json({ data: { total_cost: 0.0042 } }));
    expect(await ok.c.getGeneration('gen 1')).toEqual({ total_cost: 0.0042 });
    expect(ok.seen[0]!.url).toBe('https://or.test/api/v1/generation?id=gen%201');
    expect(ok.seen[0]!.signal).toBeTruthy();
    expect(await client(() => json({}, 404)).c.getGeneration('g')).toBeNull();
    expect(await client(() => json({ data: {} })).c.getGeneration('g')).toBeNull();
    await expect(client(() => json({}, 500)).c.getGeneration('g')).rejects.toThrow();
  });
});

describe('getKey', () => {
  it('maps data fields', async () => {
    const { c, seen } = client(() =>
      json({ data: { usage: 12.5, usage_daily: 1, limit: 100, limit_remaining: 87.5 } })
    );
    expect(await c.getKey()).toEqual({
      usage: 12.5,
      usage_daily: 1,
      limit: 100,
      limit_remaining: 87.5,
    });
    expect(seen[0]!.url).toBe('https://or.test/api/v1/key');
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer sk-SECRET');
  });

  it('keeps null limits and rejects a response without usage', async () => {
    const { c } = client(() => json({ data: { usage: 0, limit: null, limit_remaining: null } }));
    expect((await c.getKey()).limit).toBeNull();
    await expect(client(() => json({ data: {} })).c.getKey()).rejects.toThrow();
  });
});

describe('listZdrEndpoints', () => {
  it('sends no Authorization header and returns data', async () => {
    const { c, seen } = client(() => json({ data: [{ model_id: 'm', provider_name: 'p' }] }));
    expect(await c.listZdrEndpoints()).toHaveLength(1);
    expect(seen[0]!.url).toBe('https://or.test/api/v1/endpoints/zdr');
    expect(seen[0]!.headers.get('authorization')).toBeNull();
  });
});
