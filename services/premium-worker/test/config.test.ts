import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import {
  OFFICIAL_OPENROUTER_BASE_URL,
  OFFICIAL_REVENUECAT_BASE_URL,
  type AiConfig,
} from '../src/config';
import { parseConfig } from '../src/configSchema';
import { testConfig, testDeps } from './fakes/ctx';

type Env = Parameters<typeof parseConfig>[0];

const baseEnv = (config: unknown, over: Partial<Env> = {}): Env => ({
  AI_CONFIG_JSON: typeof config === 'string' ? config : JSON.stringify(config),
  WORKER_ENV: 'test',
  OPENROUTER_BASE_URL: 'https://openrouter.invalid/api/v1',
  REVENUECAT_BASE_URL: 'https://revenuecat.invalid/v2',
  ...over,
});

const prodEnv = (over: Partial<Env> = {}, cfg?: unknown): Env =>
  baseEnv(
    cfg ??
      testConfig({
        revenuecat: { environments: ['production'], product_ids: ['prod_x'] },
      }),
    {
      WORKER_ENV: 'production',
      OPENROUTER_BASE_URL: OFFICIAL_OPENROUTER_BASE_URL,
      REVENUECAT_BASE_URL: OFFICIAL_REVENUECAT_BASE_URL,
      ...over,
    }
  );

function mutate(fn: (c: Record<string, any>) => void): Record<string, any> {
  const c = JSON.parse(JSON.stringify(testConfig()));
  fn(c);
  return c;
}

const rejected = (e: Env) => {
  const r = parseConfig(e);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.errors;
};

describe('parseConfig accepts', () => {
  it('the [env.test] config', () => {
    const r = parseConfig({ ...baseEnv(env.AI_CONFIG_JSON) });
    expect(r.ok).toBe(true);
  });

  it('a production fixture', () => {
    expect(parseConfig(prodEnv()).ok).toBe(true);
  });

  it('allows provider.only', () => {
    const c = mutate((c) => (c.provider.only = ['deepinfra']));
    expect(parseConfig(baseEnv(c)).ok).toBe(true);
  });
});

describe('parseConfig rejects', () => {
  it('the committed production config (product_ids empty) until RevenueCat exists', () => {
    // The wrangler.toml [env.production] config is the test config with product_ids [] and
    // environments ['production']; reproduce that shape.
    const cfg = testConfig({ revenuecat: { environments: ['production'], product_ids: [] } });
    const errors = rejected(prodEnv({}, cfg));
    expect(errors.join('\n')).toContain('revenuecat.product_ids');
  });

  it('invalid JSON', () => {
    rejected(baseEnv('{not json'));
  });

  it('an unknown top-level key', () => {
    rejected(baseEnv(mutate((c) => (c.extra = 1))));
  });

  it('an unknown nested key', () => {
    rejected(baseEnv(mutate((c) => (c.provider.order = ['x']))));
  });

  it('zdr false', () => {
    expect(rejected(baseEnv(mutate((c) => (c.provider.zdr = false)))).join()).toContain(
      'provider.zdr'
    );
  });

  it('zdr missing', () => {
    expect(rejected(baseEnv(mutate((c) => delete c.provider.zdr))).join()).toContain(
      'provider.zdr'
    );
  });

  it("data_collection 'allow'", () => {
    expect(
      rejected(baseEnv(mutate((c) => (c.provider.data_collection = 'allow')))).join()
    ).toContain('provider.data_collection');
  });

  it('data_collection missing', () => {
    expect(rejected(baseEnv(mutate((c) => delete c.provider.data_collection))).join()).toContain(
      'provider.data_collection'
    );
  });

  it('require_parameters false', () => {
    rejected(baseEnv(mutate((c) => (c.provider.require_parameters = false))));
  });

  it('allow_fallbacks true', () => {
    rejected(baseEnv(mutate((c) => (c.provider.allow_fallbacks = true))));
  });

  it('spend_share 0.6', () => {
    rejected(baseEnv(mutate((c) => (c.finance.spend_share = 0.6))));
  });

  it('openrouter_fee 1.0', () => {
    rejected(baseEnv(mutate((c) => (c.finance.openrouter_fee = 1.0))));
  });

  it('global_share below spend_share', () => {
    rejected(
      baseEnv(
        mutate((c) => {
          c.finance.spend_share = 0.5;
          c.finance.global_share = 0.4;
        })
      )
    );
  });

  it('a google/ model', () => {
    rejected(baseEnv(mutate((c) => (c.model = 'google/gemini-3-flash'))));
  });

  it('vision_enabled with tokens_max 0', () => {
    rejected(
      baseEnv(
        mutate((c) => {
          c.vision_enabled = true;
          c.image.tokens_max = 0;
        })
      )
    );
  });

  it("production with environments ['sandbox']", () => {
    rejected(
      prodEnv({}, testConfig({ revenuecat: { environments: ['sandbox'], product_ids: ['p'] } }))
    );
  });

  it("production with environments ['production','sandbox']", () => {
    rejected(
      prodEnv(
        {},
        testConfig({ revenuecat: { environments: ['production', 'sandbox'], product_ids: ['p'] } })
      )
    );
  });

  it('production with a mock base URL', () => {
    rejected(prodEnv({ OPENROUTER_BASE_URL: 'https://mock.example/api/v1' }));
    rejected(prodEnv({ REVENUECAT_BASE_URL: 'https://mock.example/v2' }));
  });

  it('staging with a mock base URL', () => {
    const staging = (over: Partial<Env>) =>
      baseEnv(testConfig(), {
        WORKER_ENV: 'staging',
        OPENROUTER_BASE_URL: OFFICIAL_OPENROUTER_BASE_URL,
        REVENUECAT_BASE_URL: OFFICIAL_REVENUECAT_BASE_URL,
        ...over,
      });
    expect(parseConfig(staging({})).ok).toBe(true);
    rejected(staging({ OPENROUTER_BASE_URL: 'https://mock.example/api/v1' }));
    rejected(staging({ REVENUECAT_BASE_URL: 'https://mock.example/v2' }));
  });

  it('an unknown WORKER_ENV', () => {
    rejected(baseEnv(testConfig(), { WORKER_ENV: 'prod' as Env['WORKER_ENV'] }));
  });

  it('does not echo config values in errors', () => {
    const errors = rejected(baseEnv(mutate((c) => (c.model = 'google/secret-model-name'))));
    expect(errors.join()).not.toContain('secret-model-name');
  });
});

describe('the Worker refuses to serve on an invalid config (plan 13 row 6)', () => {
  const bad: AiConfig = testConfig();
  const badEnv = {
    ...env,
    AI_CONFIG_JSON: JSON.stringify({ ...bad, provider: { ...bad.provider, zdr: false } }),
  };
  const app = createApp(() => testDeps());

  it('GET /v1/usage -> 503 hosted_disabled', async () => {
    const res = await app.fetch!(
      new Request('https://w.test/v1/usage') as never,
      badEnv,
      createExecutionContext()
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('hosted_disabled');
  });

  it('POST /v1/chat/completions -> 503 hosted_disabled', async () => {
    const res = await app.fetch!(
      new Request('https://w.test/v1/chat/completions', { method: 'POST', body: '{}' }) as never,
      badEnv,
      createExecutionContext()
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('hosted_disabled');
  });
});
