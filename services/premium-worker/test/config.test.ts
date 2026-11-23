import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import {
  OFFICIAL_OPENROUTER_BASE_URL,
  OFFICIAL_OTARI_BASE_URL,
  OFFICIAL_REVENUECAT_BASE_URL,
  type AiConfig,
} from '../src/config';
import { parseConfig } from '../src/configSchema';
import { testConfig, testDeps } from './fakes/ctx';
import { OTARI_CONFIG } from './fakes/otari';

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
      prodEnv(
        {},
        testConfig({ revenuecat: { environments: ['sandbox'], product_ids: ['prod_x'] } })
      )
    );
  });

  // RevenueCat v2 reports `product_id` as its own `prod…` id; a store identifier never matches.
  it.each([['production'], ['staging']])(
    '%s with store identifiers instead of RevenueCat product ids',
    (workerEnv) => {
      const cfg = testConfig({
        revenuecat: {
          environments: ['production'],
          product_ids: ['musclog_premium_monthly', 'musclog_premium_monthly:monthly'],
        },
      });
      const errors = rejected(
        baseEnv(cfg, {
          WORKER_ENV: workerEnv,
          OPENROUTER_BASE_URL: OFFICIAL_OPENROUTER_BASE_URL,
          REVENUECAT_BASE_URL: OFFICIAL_REVENUECAT_BASE_URL,
        })
      );
      expect(errors.join('\n')).toContain(
        'must be RevenueCat product ids (prod…), not store identifiers: musclog_premium_monthly, musclog_premium_monthly:monthly'
      );
    }
  );

  it("production with environments ['production','sandbox']", () => {
    rejected(
      prodEnv(
        {},
        testConfig({
          revenuecat: { environments: ['production', 'sandbox'], product_ids: ['prod_x'] },
        })
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

describe('limits.max_devices', () => {
  const withDevices = (n: number) => baseEnv(mutate((c) => (c.limits.max_devices = n)));

  it('rejects 51 (above the safety ceiling) and 0', () => {
    expect(rejected(withDevices(51)).join()).toContain('max_devices');
    expect(rejected(withDevices(0)).join()).toContain('max_devices');
  });

  it('accepts 25 and 50', () => {
    expect(parseConfig(withDevices(25)).ok).toBe(true);
    expect(parseConfig(withDevices(50)).ok).toBe(true);
  });
});

describe('feature reasoning_max', () => {
  const withChatMax = (value: unknown) =>
    mutate((c) => {
      if (value === 'absent') delete c.features.chat.reasoning_max;
      else c.features.chat.reasoning_max = value;
    });

  it.each(['low', 'medium', 'high', null, 'absent'])('accepts reasoning_max %s', (value) => {
    expect(parseConfig(baseEnv(withChatMax(value))).ok).toBe(true);
  });

  it("rejects reasoning_max 'max'", () => {
    expect(rejected(baseEnv(withChatMax('max'))).join()).toContain('reasoning_max');
  });
});

describe('feature max_tokens_by_effort', () => {
  const withChatEffort = (value: unknown) =>
    mutate((c) => {
      if (value === 'absent') delete c.features.chat.max_tokens_by_effort;
      else c.features.chat.max_tokens_by_effort = value;
    });

  it.each([
    {},
    { low: 1000 },
    { medium: 3000 },
    { high: 4500 },
    { low: 1, medium: 2, high: 32000 },
  ])('accepts %j', (value) => {
    expect(parseConfig(baseEnv(withChatEffort(value))).ok).toBe(true);
  });

  it('accepts an absent key', () => {
    expect(parseConfig(baseEnv(withChatEffort('absent'))).ok).toBe(true);
  });

  it.each([{ max: 1 }, { high: 0 }, { high: 1.5 }, { high: 32001 }, { low: -1 }])(
    'rejects %j',
    (value) => {
      expect(rejected(baseEnv(withChatEffort(value))).join()).toContain('max_tokens_by_effort');
    }
  );
});

describe('the otari block', () => {
  const withOtari = (fn: (o: Record<string, any>) => void = () => {}) =>
    mutate((c) => {
      c.otari = JSON.parse(JSON.stringify(OTARI_CONFIG));
      fn(c.otari);
    });
  const errorsOf = (cfg: unknown, over: Partial<Env> = {}) =>
    rejected(baseEnv(cfg, over)).join('\n');

  it('is optional and a valid block is accepted', () => {
    expect(parseConfig(baseEnv(testConfig())).ok).toBe(true);
    expect(parseConfig(baseEnv(withOtari())).ok).toBe(true);
  });

  it('a valid block passes in production with the official URL', () => {
    const cfg = {
      ...testConfig({ revenuecat: { environments: ['production'], product_ids: ['prod_x'] } }),
      otari: OTARI_CONFIG,
    };
    const env = prodEnv({ OTARI_BASE_URL: OFFICIAL_OTARI_BASE_URL }, cfg);
    expect(parseConfig(env).ok).toBe(true);
  });

  it.each(['production', 'staging'])(
    '%s requires the official Otari URL once the block exists',
    (workerEnv) => {
      const cfg =
        workerEnv === 'production'
          ? testConfig({ revenuecat: { environments: ['production'], product_ids: ['prod_x'] } })
          : testConfig();
      const e = (over: Partial<Env>) =>
        baseEnv(
          { ...cfg, otari: OTARI_CONFIG },
          {
            WORKER_ENV: workerEnv,
            OPENROUTER_BASE_URL: OFFICIAL_OPENROUTER_BASE_URL,
            REVENUECAT_BASE_URL: OFFICIAL_REVENUECAT_BASE_URL,
            ...over,
          }
        );
      expect(parseConfig(e({ OTARI_BASE_URL: OFFICIAL_OTARI_BASE_URL })).ok).toBe(true);
      expect(rejected(e({ OTARI_BASE_URL: 'https://mock.example/api/v1' })).join()).toContain(
        'OTARI_BASE_URL'
      );
      expect(rejected(e({})).join()).toContain('OTARI_BASE_URL'); // unset
      // without the block the Otari URL is not checked
      const noBlock = baseEnv(cfg, {
        WORKER_ENV: workerEnv,
        OPENROUTER_BASE_URL: OFFICIAL_OPENROUTER_BASE_URL,
        REVENUECAT_BASE_URL: OFFICIAL_REVENUECAT_BASE_URL,
      });
      expect(parseConfig(noBlock).ok).toBe(true);
    }
  );

  it('local and test accept any valid URL and refuse a malformed one', () => {
    expect(
      parseConfig(baseEnv(testConfig(), { OTARI_BASE_URL: 'http://127.0.0.1:8790/api/v1' })).ok
    ).toBe(true);
    expect(errorsOf(testConfig(), { OTARI_BASE_URL: 'not a url' })).toContain('OTARI_BASE_URL');
  });

  it('a model that is not pinned', () => {
    expect(errorsOf(withOtari((o) => (o.models.chat.model = 'z-ai/glm-5.3-flash')))).toContain(
      'otari.models.chat.model'
    );
  });

  it('a model whose provider is not in providers', () => {
    expect(
      errorsOf(withOtari((o) => (o.models.vision.model = 'together:z-ai/glm-vision')))
    ).toContain('otari.models.vision.model: provider is not in otari.providers');
  });

  it('an uppercase provider prefix', () => {
    expect(errorsOf(withOtari((o) => (o.models.chat.model = 'DeepInfra:z-ai/glm')))).toContain(
      'provider is not in'
    );
  });

  it('allows a google/ catalogue id (the refusal is OpenRouter-only)', () => {
    expect(
      parseConfig(baseEnv(withOtari((o) => (o.models.chat.model = 'deepinfra:google/gemma-4')))).ok
    ).toBe(true);
  });

  it('empty or duplicate or malformed providers', () => {
    rejected(baseEnv(withOtari((o) => (o.providers = []))));
    rejected(baseEnv(withOtari((o) => (o.providers = ['deepinfra', 'deepinfra']))));
    rejected(baseEnv(withOtari((o) => (o.providers = ['Deep_Infra']))));
  });

  it('missing models, negative prices and unknown keys', () => {
    rejected(baseEnv(withOtari((o) => delete o.models.vision)));
    rejected(baseEnv(withOtari((o) => (o.models.chat.prices.prompt_per_mtok = -1))));
    rejected(baseEnv(withOtari((o) => (o.models.chat.extra = 1))));
    rejected(baseEnv(withOtari((o) => (o.extra = 1))));
    rejected(baseEnv(withOtari((o) => delete o.models.chat.prices.image_per_image)));
  });
});
