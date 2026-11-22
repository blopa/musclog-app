import { readFileSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const g2 = require('../premium-record-g2.js');

const SCRIPT = join(__dirname, '..', 'premium-record-g2.js');
const fx = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'premium-g2', `${name}.json`), 'utf8'));

const SECRET = 'sk_SENTINEL_SECRET_VALUE';
const RC_ID = `mlg1_${'a'.repeat(64)}`;
const ENV = { REVENUECAT_V2_SECRET_KEY: SECRET, REVENUECAT_PROJECT_ID: 'proj1' };

type Call = { url: string; init: { method?: string; headers?: Record<string, string> } };

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  };
}

function setup(routes: (url: string) => ReturnType<typeof res>) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    return routes(url);
  });
  let out = '';
  let err = '';
  const run = async (argv: string[], env: Record<string, string | undefined> = ENV) => {
    const code = await g2.main(
      argv,
      env,
      fetchImpl,
      { write: (s: string) => (out += s) },
      { write: (s: string) => (err += s) }
    );
    return { code, out, err };
  };
  return { calls, fetchImpl, run };
}

const happy = (url: string) => {
  if (url.endsWith(`/customers/${RC_ID}`)) return res(200, fx('customer'));
  if (url.endsWith('/subscriptions') && url.includes('/customers/'))
    return res(200, fx('subscriptions'));
  if (url.endsWith('/transactions')) return res(200, fx('transactions'));
  if (url.includes('store_subscription_identifier=')) return res(200, fx('search'));
  return res(500, {});
};

describe('premium-record-g2', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    expect(global.fetch).not.toHaveBeenCalled();
    global.fetch = realFetch;
  });

  it('records customer, subscription and transactions (G9 line)', async () => {
    const { run, calls } = setup(happy);
    const r = await run([RC_ID]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('customer_id: mlg1_a');
    expect(r.out).toContain('entl_fake');
    expect(r.out).toContain('store_subscription_identifier: 2000000000001');
    expect(r.out).toContain('current_period_ends_at: 2026-');
    expect(r.out).toContain('G9 proceeds present: yes');
    expect(r.out).toContain('G9 proceeds present: no');
    expect(r.out).toContain('effective_expiration_date: null');
    expect(r.out).not.toContain('undefined');
    expect(calls).toHaveLength(3);
    expect(calls[0].url).toBe(`https://api.revenuecat.com/v2/projects/proj1/customers/${RC_ID}`);
  });

  it('--json emits one document with the same data', async () => {
    const { run } = setup(happy);
    const r = await run([RC_ID, '--json']);
    const doc = JSON.parse(r.out);
    expect(doc.customer_id).toBe('mlg1_a');
    expect(doc.subscriptions[0].transactions).toHaveLength(2);
    expect(doc.subscriptions[0].transactions[1].proceeds_present).toBe(false);
    expect(doc.subscriptions[0].transactions[0].proceeds_present).toBe(true);
    expect(doc.search).toBeNull();
    expect(typeof doc.captured_at).toBe('string');
  });

  it('buildRecord is pure and tolerates empty input', () => {
    const rec = g2.buildRecord({}, 1790000000000);
    expect(rec.customer_found).toBe(false);
    expect(rec.subscriptions).toEqual([]);
    const rec2 = g2.buildRecord(
      { customer: {}, subscriptions: [{ id: 's' }], transactions: { s: [{ id: 't' }] } },
      1790000000000
    );
    expect(rec2.subscriptions[0].transactions[0].age_seconds).toBeNull();
    expect(rec2.subscriptions[0].gives_access).toBeNull();
  });

  it('follows next_page across two pages', async () => {
    const { run, calls } = setup((url) => {
      if (url.endsWith(`/customers/${RC_ID}`)) return res(200, fx('customer'));
      if (url.endsWith('/customers/' + RC_ID + '/subscriptions')) {
        return res(200, {
          items: [{ id: 'sub_a' }],
          next_page: '/v2/projects/proj1/customers/x/subscriptions?page=2',
        });
      }
      if (url.includes('?page=2')) return res(200, { items: [{ id: 'sub_b' }], next_page: null });
      return res(200, { items: [] });
    });
    const r = await run([RC_ID]);
    expect(r.out).toContain('subscription sub_a');
    expect(r.out).toContain('subscription sub_b');
    expect(
      calls.some(
        (c) =>
          c.url === 'https://api.revenuecat.com/v2/projects/proj1/customers/x/subscriptions?page=2'
      )
    ).toBe(true);
  });

  it('refuses next_page on another origin', async () => {
    const { run, calls } = setup((url) => {
      if (url.endsWith(`/customers/${RC_ID}`)) return res(200, fx('customer'));
      return res(200, { items: [{ id: 's' }], next_page: 'https://evil.example/v2/x' });
    });
    const r = await run([RC_ID]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('another origin');
    expect(calls.some((c) => c.url.includes('evil.example'))).toBe(false);
  });

  it('reports a 404 customer without crashing', async () => {
    const { run } = setup(() => res(404, {}));
    const r = await run([RC_ID]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('customer not found');
  });

  it('403 names the status and permissions; 429 shows retry-after', async () => {
    let s = setup(() => res(403, {}));
    let r = await s.run([RC_ID]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('403');
    expect(r.err).toContain('customer_information:customers:read');
    s = setup(() => res(429, {}, { 'retry-after': '12' }));
    r = await s.run([RC_ID]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('429');
    expect(r.err).toContain('retry-after: 12');
  });

  it('missing key: names the variable only, makes no request', async () => {
    const { run, fetchImpl } = setup(happy);
    const r = await run([RC_ID], { REVENUECAT_PROJECT_ID: 'proj1' });
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('REVENUECAT_V2_SECRET_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never prints the key, even on failures', async () => {
    for (const status of [200, 401, 404, 500]) {
      const { run, calls } = setup(() => res(status, { echo: SECRET }));
      const r = await run([RC_ID, '--json']);
      expect(r.out + r.err).not.toContain(SECRET);
      expect(calls.every((c) => c.init.headers?.authorization === `Bearer ${SECRET}`)).toBe(true);
    }
    const { run } = setup(() => {
      throw new Error(`boom ${SECRET}`);
    });
    const r = await run([RC_ID]);
    expect(r.code).toBe(1);
    expect(r.out + r.err).not.toContain(SECRET);
  });

  it('needs a project id', async () => {
    const { run } = setup(happy);
    const r = await run([RC_ID], { REVENUECAT_V2_SECRET_KEY: SECRET });
    expect(r.err).toContain('REVENUECAT_PROJECT_ID');
    const ok = await setup(happy).run([RC_ID, '--project', 'other'], {
      REVENUECAT_V2_SECRET_KEY: SECRET,
    });
    expect(ok.code).toBe(0);
  });

  it('rejects a bad rc_id unless --any-id', async () => {
    const { run, fetchImpl } = setup(() => res(404, {}));
    const bad = await run(['not-an-id']);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('mlg1_');
    expect(fetchImpl).not.toHaveBeenCalled();
    const any = await run(['not-an-id', '--any-id']);
    expect(any.code).toBe(0);
  });

  it('--search lists matching subscriptions with their current owner', async () => {
    const { run, calls } = setup(happy);
    const r = await run([RC_ID, '--search', 'order/1 2']);
    expect(r.out).toContain('2 match(es)');
    expect(r.out).toContain(
      'sub_old: customer_id mlg1_b (current owner), original_customer_id mlg1_a, gives_access true'
    );
    expect(r.out).toContain('sub_older: customer_id mlg1_a');
    expect(
      calls.some((c) =>
        c.url.endsWith('/subscriptions?store_subscription_identifier=order%2F1%202')
      )
    ).toBe(true);
  });

  it('encodes path segments', async () => {
    const { run, calls } = setup(() => res(404, {}));
    await run(['a/b c?d', '--any-id', '--project', 'p/1']);
    expect(calls[0].url).toBe(
      'https://api.revenuecat.com/v2/projects/p%2F1/customers/a%2Fb%20c%3Fd'
    );
  });

  it('only uses GET', async () => {
    const { run, calls } = setup(happy);
    await run([RC_ID, '--search', 'x']);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.init.method === 'GET')).toBe(true);
    const src = readFileSync(SCRIPT, 'utf8');
    expect(src).not.toMatch(/['"`](POST|PUT|DELETE|PATCH)['"`]/);
  });

  it('parseArgs handles flags and refuses unknown ones', () => {
    expect(g2.parseArgs([RC_ID, '--json', '--search', 'x', '--project', 'p'])).toMatchObject({
      rcId: RC_ID,
      json: true,
      search: 'x',
      project: 'p',
    });
    expect(() => g2.parseArgs([])).toThrow();
    expect(() => g2.parseArgs([RC_ID, '--nope'])).toThrow();
  });
});
