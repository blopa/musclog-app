import { describe, expect, it } from 'vitest';

import { allowlistRequest } from '../src/proxy/allowlist';
import { reservationBound } from '../src/proxy/bound';
import {
  assertOtariPinned,
  assertPremiumPrivacy,
  buildOpenRouterBody,
  buildOtariBody,
  selectorProvider,
} from '../src/proxy/upstreamBody';
import { BODY_CASES } from './fixtures/bodyCases';
import expected from './fixtures/openrouterBodies.json';
import { OTARI_CONFIG } from './fakes/otari';
import { testConfig } from './fakes/ctx';

describe('buildOpenRouterBody', () => {
  it.each(Object.keys(BODY_CASES))(
    'is byte-identical to what allowlistRequest returned before the split: %s',
    (name) => {
      const c = BODY_CASES[name]!;
      const cfg = c.config();
      const body = buildOpenRouterBody(allowlistRequest(c.input, cfg).neutral, cfg);
      expect(JSON.stringify(body)).toBe((expected as Record<string, string>)[name]);
    }
  );
});

describe('buildOtariBody', () => {
  const cfgWith = (over: Parameters<typeof testConfig>[0] = {}) =>
    testConfig({ otari: OTARI_CONFIG, ...over });
  const build = (input: unknown, over: Parameters<typeof testConfig>[0] = {}) => {
    const cfg = cfgWith(over);
    const r = allowlistRequest(input, cfg);
    return { r, body: buildOtariBody(r.neutral, cfg.otari!, r.feature, 'production') };
  };
  const user = { messages: [{ role: 'user', content: 'hi' }] };

  it('pins the feature selector and never carries OpenRouter fields', () => {
    const { body } = build(user);
    expect(body.model).toBe('deepinfra:z-ai/glm-5.3-flash');
    expect(body).not.toHaveProperty('provider');
    expect(body).not.toHaveProperty('reasoning');
    expect(body.reasoning_effort).toBe('low');
    expect(body.metadata).toEqual({ app: 'musclog-iron', env: 'production', feature: 'chat' });
    expect(body).not.toHaveProperty('stream_options');
    expect(body.stream).toBe(false);
  });

  it('asks for usage on streams', () => {
    expect(build({ ...user, stream: true }).body.stream_options).toEqual({ include_usage: true });
  });

  it('structured and vision requests use their own selector', () => {
    const schema = {
      type: 'json_schema',
      json_schema: { name: 'x', strict: true, schema: { type: 'object' } },
    };
    expect(build({ ...user, response_format: schema }).body.metadata).toMatchObject({
      feature: 'structured',
    });
    const v = build(
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }],
          },
        ],
      },
      { vision_enabled: true, image: { tokens_max: 1000 } }
    );
    expect(v.body.model).toBe('deepinfra:z-ai/glm-5.3-vision');
    expect(v.body.metadata).toMatchObject({ feature: 'vision' });
  });

  it('sends no reasoning_effort when the feature has none, and keeps every validated field', () => {
    const none = build(user, { features: { chat: { reasoning: null, reasoning_max: null } } });
    expect(none.body).not.toHaveProperty('reasoning_effort');
    const all = build({
      ...user,
      temperature: 0.5,
      stop: ['x'],
      tools: [{ type: 'function', function: { name: 'f' } }],
      tool_choice: 'auto',
      parallel_tool_calls: true,
    });
    expect(all.body).toMatchObject({
      temperature: 0.5,
      stop: ['x'],
      tool_choice: 'auto',
      parallel_tool_calls: true,
    });
    expect(all.body.tools).toHaveLength(1);
  });

  it('carries no user or device identifier in metadata', () => {
    expect(JSON.stringify(build(user).body.metadata)).not.toMatch(/lin|rc|user/i);
  });
});

describe('assertOtariPinned', () => {
  const ok = { model: 'deepinfra:z-ai/glm-5.3-flash' };
  it('accepts a pinned selector of an allowed provider', () => {
    expect(() => assertOtariPinned(ok, OTARI_CONFIG)).not.toThrow();
  });
  it.each([
    ['an unpinned model id', { model: 'z-ai/glm-5.3-flash' }],
    ['a missing model', {}],
    ['a provider outside the allowlist', { model: 'together:z-ai/glm-5.3-flash' }],
    ['an uppercase prefix', { model: 'DeepInfra:z-ai/glm' }],
    ['a provider object', { ...ok, provider: { only: ['deepinfra'] } }],
    ['whitespace', { model: 'deepinfra: x' }],
  ])('throws for %s', (_n, body) => {
    expect(() => assertOtariPinned(body, OTARI_CONFIG)).toThrow(
      'premium_privacy_invariant_violated'
    );
  });
  it('selectorProvider reads the prefix', () => {
    expect(selectorProvider('deepinfra:a/b')).toBe('deepinfra');
    expect(selectorProvider('a/b')).toBeNull();
    expect(selectorProvider(5)).toBeNull();
  });
});

describe('reservationBound per upstream', () => {
  it('OpenRouter keeps config.prices; Otari uses its feature prices; the flat fee is shared', () => {
    const cfg = testConfig({ otari: OTARI_CONFIG, prices: { request_fee_u: 7 } });
    const r = allowlistRequest({ messages: [{ role: 'user', content: 'hello world' }] }, cfg);
    const or = reservationBound(r, cfg, 'openrouter');
    expect(reservationBound(r, cfg)).toBe(or);
    const ot = reservationBound(r, cfg, 'otari');
    expect(ot).not.toBe(or);
    const inTokens = Math.ceil(r.textBytes / 2);
    const raw = inTokens * 0.2 + r.maxTokens * 0.8;
    expect(ot).toBe(Math.max(1, Math.ceil(raw * cfg.finance.price_slack) + 7));
  });
});

describe('assertPremiumPrivacy', () => {
  it('accepts valid OpenRouter privacy settings and rejects missing or weakened fields', () => {
    expect(() =>
      assertPremiumPrivacy({
        provider: { zdr: true, data_collection: 'deny', allow_fallbacks: false },
      })
    ).not.toThrow();
    expect(() =>
      assertPremiumPrivacy({
        provider: { zdr: false, data_collection: 'deny', allow_fallbacks: false },
      })
    ).toThrow('premium_privacy_invariant_violated');
  });
});
