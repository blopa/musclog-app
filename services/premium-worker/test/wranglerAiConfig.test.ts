import { describe, expect, it } from 'vitest';
import wranglerToml from '../wrangler.toml?raw';

import { parseConfig } from '../src/configSchema';
import { testConfig } from './fakes/ctx';

/** The single-quoted AI_CONFIG_JSON value of each [env.*] block, in file order. */
function aiConfigValues(toml: string): { env: string; json: unknown }[] {
  const out: { env: string; json: unknown }[] = [];
  let current = 'top';
  for (const line of toml.split('\n')) {
    const header = /^\[(env\.[^\]]+)\]/.exec(line);
    if (header) current = header[1]!;
    const match = /^AI_CONFIG_JSON = '(.*)'$/.exec(line);
    if (match) out.push({ env: current, json: JSON.parse(match[1]!) });
  }
  return out;
}

describe('wrangler.toml AI_CONFIG_JSON', () => {
  const values = aiConfigValues(wranglerToml);

  it('has one value per environment block that sets it', () => {
    expect(values.length).toBeGreaterThanOrEqual(4);
  });

  it('every value parses as JSON and has the same features block', () => {
    const features = values.map((v) => JSON.stringify((v.json as { features: unknown }).features));
    expect(new Set(features).size).toBe(1);
  });

  it('every feature keeps max_tokens_by_effort >= max_tokens and reasoning_max high', () => {
    for (const { json } of values) {
      const features = (json as { features: Record<string, any> }).features;
      for (const feature of Object.values(features)) {
        expect(feature.reasoning_max).toBe('high');
        for (const limit of Object.values(feature.max_tokens_by_effort ?? {}) as number[]) {
          expect(limit).toBeGreaterThanOrEqual(feature.max_tokens);
        }
      }
    }
  });

  it('the test config validator accepts each value with the same schema as the other tests', () => {
    // The production values carry real product ids, so they validate under the test env.
    for (const { env, json } of values) {
      const r = parseConfig({
        AI_CONFIG_JSON: JSON.stringify(json),
        WORKER_ENV: 'test',
        OPENROUTER_BASE_URL: 'https://openrouter.invalid/api/v1',
        REVENUECAT_BASE_URL: 'https://revenuecat.invalid/v2',
      });
      expect(r.ok, `${env}: ${r.ok ? '' : r.errors.join(', ')}`).toBe(true);
    }
  });

  it('the test fixture still uses the same feature shape as the wrangler values', () => {
    expect(testConfig().features.chat).toHaveProperty('max_tokens_by_effort');
  });
});
