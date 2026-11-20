import { describe, expect, it } from 'vitest';

import { createRevenueCatClient } from '../src/upstream/revenuecat';
import { RevenueCatUnavailableError } from '../src/upstream/types';

const BASE = 'https://rc.test/v2';

function setup(handler: (url: string) => Response | Promise<Response>) {
  const calls: { url: string; headers: Headers }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    return handler(url);
  }) as typeof fetch;
  const client = createRevenueCatClient({
    baseUrl: BASE,
    apiKey: 'sk_secret',
    projectId: 'proj 1',
    fetch: f,
  });
  return { client, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sub = (id: string) => ({
  id,
  customer_id: 'c',
  product_id: 'p',
  gives_access: true,
  store: 'play_store',
  environment: 'production',
  ownership: 'purchased',
});
const tx = (id: string) => ({
  id,
  purchased_at: 1,
  expiration_date: 2,
  revenue_in_usd: { gross: 1, proceeds: 0.8 },
});

describe('revenuecat client', () => {
  it('sends auth and encodes ids', async () => {
    const { client, calls } = setup(() => json({ object: 'list', items: [], next_page: null }));
    await client.listCustomerSubscriptions('a/b c');
    expect(calls[0]!.url).toBe(`${BASE}/projects/proj%201/customers/a%2Fb%20c/subscriptions`);
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer sk_secret');
  });

  it('follows relative and absolute next_page', async () => {
    const { client, calls } = setup((url) => {
      if (url.endsWith('/transactions'))
        return json({ items: [tx('1')], next_page: '/v2/projects/proj%201/p2' });
      if (url.endsWith('/p2')) return json({ items: [tx('2')], next_page: `${BASE}/p3` });
      return json({ items: [tx('3')], next_page: null });
    });
    const r = await client.listTransactions('s1');
    expect(r.map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(calls[1]!.url).toBe('https://rc.test/v2/projects/proj%201/p2');
    expect(calls[2]!.url).toBe(`${BASE}/p3`);
  });

  it('fails closed past 10 pages', async () => {
    const { client } = setup(() => json({ items: [tx('x')], next_page: '/v2/more' }));
    await expect(client.listTransactions('s')).rejects.toBeInstanceOf(RevenueCatUnavailableError);
  });

  it('fails closed when a later page returns 404 (never decides on a partial list)', async () => {
    const { client } = setup((url) =>
      url.endsWith('/p2')
        ? new Response('{}', { status: 404 })
        : json({ items: [tx('1')], next_page: '/v2/projects/proj%201/p2' })
    );
    await expect(client.listCustomerSubscriptions('c')).rejects.toBeInstanceOf(
      RevenueCatUnavailableError
    );
  });

  it('maps 404 to empty / null', async () => {
    const { client } = setup(() => new Response('{}', { status: 404 }));
    expect(await client.listCustomerSubscriptions('c')).toEqual([]);
    expect(await client.getSubscription('s')).toBeNull();
    expect(await client.listTransactions('s')).toEqual([]);
  });

  it.each([429, 500, 401, 403])('status %i fails closed', async (status) => {
    const { client } = setup(() => new Response('x', { status }));
    await expect(client.getSubscription('s')).rejects.toMatchObject({ status });
  });

  it('network error fails closed', async () => {
    const { client } = setup(() => {
      throw new TypeError('network');
    });
    await expect(client.listTransactions('s')).rejects.toMatchObject({ status: null });
  });

  it('parses malformed fields defensively', async () => {
    const { client } = setup((url) =>
      url.includes('/transactions')
        ? json({
            items: [
              {
                id: 't',
                purchased_at: 5,
                expiration_date: 'soon',
                revenue_in_usd: { gross: 'x', proceeds: 1.5, commission: null },
              },
              { id: 'bad', purchased_at: 'no' },
              'junk',
            ],
          })
        : json({ id: 's', gives_access: 'yes', current_period_ends_at: Infinity })
    );
    const t = await client.listTransactions('s');
    expect(t).toEqual([
      {
        id: 't',
        purchased_at: 5,
        expiration_date: null,
        revenue_in_usd: { gross: null, commission: null, tax: null, proceeds: 1.5 },
      },
    ]);
    const s = await client.getSubscription('s');
    expect(s).toMatchObject({
      id: 's',
      gives_access: false,
      product_id: null,
      current_period_ends_at: null,
    });
    expect(sub('x').id).toBe('x');
  });
});
