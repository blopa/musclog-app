import { describe, expect, it } from 'vitest';

import {
  allowlistRequest as allowlistNeutral,
  assertPremiumPrivacy,
  effectiveReasoning,
} from '../src/proxy/allowlist';
import { buildOpenRouterBody } from '../src/proxy/upstreamBody';
import type { AiConfig } from '../src/config';
import { reservationBound } from '../src/proxy/bound';
import { ApiError } from '../src/http';
import { testConfig } from './fakes/ctx';

/** The validated request plus the OpenRouter body built from it (what `.body` was before the split). */
function allowlistRequest(input: unknown, cfg: AiConfig) {
  const r = allowlistNeutral(input, cfg);
  return { ...r, body: buildOpenRouterBody(r.neutral, cfg) };
}

const config = testConfig();
const visionConfig = testConfig({ vision_enabled: true, image: { tokens_max: 1000 } });
const base = { messages: [{ role: 'user', content: 'hi' }] };
const img = (b64 = 'AAAA', mime = 'jpeg') => ({
  role: 'user',
  content: [
    { type: 'text', text: 'what is this' },
    { type: 'image_url', image_url: { url: `data:image/${mime};base64,${b64}` } },
  ],
});

function rejected(input: unknown, cfg = config): ApiError {
  try {
    allowlistRequest(input, cfg);
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

describe('top level keys', () => {
  it.each([
    'plugins',
    'web_search_options',
    'models',
    'route',
    'provider',
    'transforms',
    'reasoning',
    'user',
    'n',
    'top_p',
    'seed',
  ])('rejects %s with its path', (key) => {
    const e = rejected({ ...base, [key]: { x: 1 } });
    expect(e.status).toBe(400);
    expect(e.code).toBe('invalid_request');
    expect(e.extra.path).toBe(key);
  });

  it('accepts and drops model and stream_options', () => {
    const r = allowlistRequest(
      { ...base, model: 'attacker/model', stream_options: { include_usage: true } },
      config
    );
    expect(r.body.model).toBe(config.model);
    expect(r.body).not.toHaveProperty('stream_options');
  });

  it('rejects a non-object body and bad message lists', () => {
    expect(rejected([]).extra.path).toBe('body');
    expect(rejected({}).extra.path).toBe('messages');
    expect(rejected({ messages: [] }).extra.path).toBe('messages');
    const many = Array.from({ length: config.limits.max_messages + 1 }, () => base.messages[0]);
    expect(rejected({ messages: many }).extra.path).toBe('messages');
  });
});

describe('messages', () => {
  it('rejects unknown roles and unknown keys inside messages and parts', () => {
    expect(rejected({ messages: [{ role: 'developer', content: 'x' }] }).extra.path).toBe(
      'messages[0].role'
    );
    expect(rejected({ messages: [{ role: 'user', content: 'x', name: 'n' }] }).extra.path).toBe(
      'messages[0].name'
    );
    expect(
      rejected({ messages: [{ role: 'user', content: [{ type: 'text', text: 'x', extra: 1 }] }] })
        .extra.path
    ).toBe('messages[0].content[0].extra');
  });

  it('the error never contains the content', () => {
    const e = rejected({ messages: [{ role: 'user', content: 'SECRET', evil: 1 }] });
    expect(JSON.stringify(e.extra)).not.toContain('SECRET');
  });

  it('accepts assistant tool calls and tool results and counts their bytes', () => {
    const r = allowlistRequest(
      {
        messages: [
          { role: 'user', content: 'abc' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } },
            ],
          },
          { role: 'tool', tool_call_id: 'c1', content: 'result' },
        ],
      },
      config
    );
    expect(r.textBytes).toBe(3 + 7 + 6);
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(
      allowlistRequest({ messages: [{ role: 'user', content: 'é€' }] }, config).textBytes
    ).toBe(5);
  });

  it('rejects an assistant message with null content and no tool calls', () => {
    expect(rejected({ messages: [{ role: 'assistant', content: null }] }).extra.path).toBe(
      'messages[0].content'
    );
  });
});

describe('images', () => {
  it('rejects an image while vision is disabled', () => {
    const off = testConfig({ vision_enabled: false });

    expect(rejected({ messages: [img()] }, off).extra.path).toBe('messages[0].content[1]');
  });

  it('ships with vision on and a positive IMAGE_TOKENS_MAX (the committed config)', () => {
    expect(config.vision_enabled).toBe(true);
    expect(config.image.tokens_max).toBeGreaterThan(0);
    // Every size a quality tier can produce (up to 1568 px on a side) is under the bound: about
    // 1568 x 1568 / 750 tokens, so the reservation never undercounts a photo.
    expect(config.image.tokens_max).toBeGreaterThanOrEqual(Math.ceil((1568 * 1568) / 750));
    expect(config.image.max_px).toBeGreaterThanOrEqual(1568);
  });

  it('adds the image bound to the reservation of a photo request', () => {
    const photo = allowlistRequest({ messages: [img()] }, config);
    const textOnly = allowlistRequest(base, config);

    expect(reservationBound(photo, config)).toBeGreaterThan(reservationBound(textOnly, config));
  });

  it('accepts a data URL with vision on and derives the vision feature', () => {
    const r = allowlistRequest({ messages: [img()] }, visionConfig);
    expect(r.feature).toBe('vision');
    expect(r.images).toBe(1);
    expect(r.maxTokens).toBe(config.features.vision.max_tokens);
  });

  it('rejects http(s) URLs and unsupported mime types', () => {
    const http = {
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'https://example.com/a.jpg' } }],
    };
    expect(rejected({ messages: [http] }, visionConfig).extra.path).toBe(
      'messages[0].content[0].image_url.url'
    );
    expect(rejected({ messages: [img('AAAA', 'gif')] }, visionConfig).extra.path).toBe(
      'messages[0].content[1].image_url.url'
    );
  });

  it('rejects images outside user messages', () => {
    const m = { role: 'system', content: img().content };
    expect(rejected({ messages: [m] }, visionConfig).status).toBe(400);
  });

  it('rejects too many images', () => {
    const cfg = testConfig({ vision_enabled: true, image: { tokens_max: 1000, max_images: 1 } });
    const two = { role: 'user', content: [...img().content, ...img().content] };
    expect(rejected({ messages: [two] }, cfg).status).toBe(400);
  });

  it('accepts 5 images and rejects 6 with max_images 5', () => {
    const cfg = testConfig({ vision_enabled: true, image: { tokens_max: 1000, max_images: 5 } });
    const n = (k: number) => ({
      role: 'user',
      content: Array.from({ length: k }, () => img().content).flat(),
    });
    expect(allowlistRequest({ messages: [n(5)] }, cfg).images).toBe(5);
    expect(rejected({ messages: [n(6)] }, cfg).status).toBe(400);
  });

  it('rejects an image whose decoded size is over image.max_bytes', () => {
    const cfg = testConfig({ vision_enabled: true, image: { tokens_max: 10, max_bytes: 6 } });
    expect(allowlistRequest({ messages: [img('AAAAAAAA')] }, cfg).images).toBe(1); // 6 bytes
    expect(rejected({ messages: [img('AAAAAAAAAAAA')] }, cfg).status).toBe(400); // 9 bytes
  });
});

describe('response_format, tools, stop', () => {
  const schema = {
    type: 'json_schema',
    json_schema: { name: 'x', strict: true, schema: { type: 'object' } },
  };

  it('accepts json_schema and derives structured', () => {
    const r = allowlistRequest({ ...base, response_format: schema }, config);
    expect(r.feature).toBe('structured');
    expect(r.maxTokens).toBe(config.features.structured.max_tokens);
    expect(r.schemaToolsBytes).toBeGreaterThan(0);
  });

  it('rejects json_object and oversize response_format', () => {
    expect(rejected({ ...base, response_format: { type: 'json_object' } }).extra.path).toBe(
      'response_format.type'
    );
    const big = {
      type: 'json_schema',
      json_schema: {
        name: 'x',
        schema: { d: 'x'.repeat(config.limits.response_format_max_bytes) },
      },
    };
    expect(rejected({ ...base, response_format: big }).extra.path).toBe('response_format');
  });

  it('rejects more than max_tools tools and more than max_stop stops', () => {
    const tool = { type: 'function', function: { name: 'f' } };
    const tools = Array.from({ length: config.limits.max_tools + 1 }, () => tool);
    expect(rejected({ ...base, tools }).extra.path).toBe('tools');
    const stop = Array.from({ length: config.limits.max_stop + 1 }, () => 's');
    expect(rejected({ ...base, stop }).extra.path).toBe('stop');
  });

  it('accepts tools, tool_choice, parallel_tool_calls and stop', () => {
    const r = allowlistRequest(
      {
        ...base,
        tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: {} } }],
        tool_choice: { type: 'function', function: { name: 'f' } },
        parallel_tool_calls: false,
        stop: ['a', 'b'],
      },
      config
    );
    expect(r.body.tool_choice).toEqual({ type: 'function', function: { name: 'f' } });
    expect(r.body.stop).toEqual(['a', 'b']);
    expect(r.body.parallel_tool_calls).toBe(false);
  });
});

describe('clamping and forced fields', () => {
  it('defaults and clamps max_tokens and temperature per feature', () => {
    const f = config.features.chat;
    expect(allowlistRequest(base, config).maxTokens).toBe(f.max_tokens);
    expect(allowlistRequest({ ...base, max_tokens: 10 ** 9 }, config).maxTokens).toBe(f.max_tokens);
    expect(allowlistRequest({ ...base, max_tokens: -5 }, config).maxTokens).toBe(1);
    expect(allowlistRequest({ ...base, max_tokens: 20 }, config).body.max_tokens).toBe(20);
    expect(allowlistRequest({ ...base, temperature: 9 }, config).body.temperature).toBe(
      f.temperature_max
    );
    expect(allowlistRequest({ ...base, temperature: -1 }, config).body.temperature).toBe(0);
    expect(allowlistRequest(base, config).body).not.toHaveProperty('temperature');
    expect(rejected({ ...base, temperature: 'hot' }).extra.path).toBe('temperature');
  });

  it('forces model, provider and reasoning from config', () => {
    const r = allowlistRequest({ ...base, stream: true }, config);
    expect(r.stream).toBe(true);
    expect(r.body.model).toBe(config.model);
    expect(r.body.provider).toEqual({
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      max_price: {
        prompt: config.prices.prompt_per_mtok,
        completion: config.prices.completion_per_mtok,
        image: config.prices.image_per_image,
      },
    });
    expect(r.body.reasoning).toEqual({ effort: 'low' });
  });

  it('adds provider.only when configured and drops reasoning when null', () => {
    const cfg = testConfig({
      provider: { only: ['deepinfra'] },
      features: { chat: { reasoning: null } },
    } as never);
    const r = allowlistRequest(base, cfg);
    expect((r.body.provider as { only: string[] }).only).toEqual(['deepinfra']);
    expect(r.body).not.toHaveProperty('reasoning');
  });

  it('the upstream body holds only the known keys', () => {
    const r = allowlistRequest(
      { ...base, stream: false, max_tokens: 5, temperature: 0.5, stop: 'x', model: 'm' },
      config
    );
    expect(Object.keys(r.body).sort()).toEqual(
      [
        'max_tokens',
        'messages',
        'model',
        'provider',
        'reasoning',
        'stop',
        'stream',
        'temperature',
      ].sort()
    );
  });
});

describe('reservationBound', () => {
  it('follows the plan formula', () => {
    const r = allowlistRequest({ messages: [{ role: 'user', content: 'x'.repeat(1000) }] }, config);
    const inTok = 500;
    const expected = Math.ceil((inTok * 0.1 + r.maxTokens * 0.5) * 1.1);
    expect(reservationBound(r, config)).toBe(expected);
  });

  it('adds images, schema bytes and the request fee, and is at least 1', () => {
    const cfg = testConfig({
      vision_enabled: true,
      image: { tokens_max: 1000 },
      prices: { image_per_image: 0.001, request_fee_u: 7 },
    });
    const r = allowlistRequest({ messages: [img()] }, cfg);
    const raw = (Math.ceil(r.textBytes / 2) + 1000) * 0.1 + r.maxTokens * 0.5 + 0.001 * 1e6;
    expect(reservationBound(r, cfg)).toBe(Math.ceil(raw * 1.1) + 7);
    const tiny = { ...r, textBytes: 0, images: 0, maxTokens: 1 };
    expect(reservationBound(tiny, testConfig())).toBeGreaterThanOrEqual(1);
  });
});

describe('premium privacy invariant', () => {
  it('every upstream body carries zdr, data_collection deny and no fallbacks', () => {
    const { body } = allowlistRequest(base, config);
    expect(body.provider).toMatchObject({
      zdr: true,
      data_collection: 'deny',
      allow_fallbacks: false,
    });
  });

  it('pins only and order together when the config names providers', () => {
    const pinned = testConfig({ provider: { only: ['vetted'] } });
    expect(allowlistRequest(base, pinned).body.provider).toMatchObject({
      only: ['vetted'],
      order: ['vetted'],
    });
  });

  it.each([
    { zdr: true, allow_fallbacks: false },
    { data_collection: 'deny', allow_fallbacks: false },
    { zdr: true, data_collection: 'allow', allow_fallbacks: false },
    { zdr: true, data_collection: 'deny' },
    undefined,
  ])('assertPremiumPrivacy throws for %j', (provider) => {
    expect(() => assertPremiumPrivacy({ provider })).toThrow('premium_privacy_invariant_violated');
  });
});

describe('client reasoning_effort', () => {
  type Effort = 'low' | 'medium' | 'high';

  /** A chat-feature config with the given reasoning and ceiling (`undefined` = key absent). */
  function chatWith(reasoning: Effort | null, reasoningMax?: Effort | null): AiConfig {
    const c = structuredClone(config) as AiConfig & {
      features: { chat: { reasoning: unknown; reasoning_max?: unknown } };
    };
    c.features.chat.reasoning = reasoning;
    if (reasoningMax === undefined) delete c.features.chat.reasoning_max;
    else c.features.chat.reasoning_max = reasoningMax;
    return c;
  }

  const effortOf = (body: Record<string, unknown>) =>
    (body.reasoning as { effort: string } | undefined)?.effort;

  it.each(['low', 'medium', 'high'])('accepts %s', (level) => {
    const r = allowlistRequest({ ...base, reasoning_effort: level }, config);
    expect(r.body).not.toHaveProperty('reasoning_effort');
  });

  it.each(['max', 'HIGH', 5, null, ''])('rejects %j with path reasoning_effort', (value) => {
    const e = rejected({ ...base, reasoning_effort: value });
    expect(e.status).toBe(400);
    expect(e.code).toBe('invalid_request');
    expect(e.extra.path).toBe('reasoning_effort');
  });

  it('cannot raise effort above a config without reasoning_max', () => {
    const cfg = chatWith('low');
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg).body)).toBe('low');
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'low' }, cfg).body)).toBe('low');
    expect(effortOf(allowlistRequest(base, cfg).body)).toBe('low');
  });

  it('lets the client lower effort below reasoning_max and clamps above it', () => {
    const cfg = chatWith('low', 'medium');
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg).body)).toBe(
      'medium'
    );
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'medium' }, cfg).body)).toBe(
      'medium'
    );
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'low' }, cfg).body)).toBe('low');
    expect(effortOf(allowlistRequest(base, cfg).body)).toBe('low');
  });

  it('keeps the default above the ceiling (operator choice) and clamps requests to it', () => {
    const cfg = chatWith('medium', 'low');
    expect(effortOf(allowlistRequest(base, cfg).body)).toBe('medium');
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg).body)).toBe('low');
  });

  it('sends no reasoning when the feature has none and no ceiling is set', () => {
    const cfg = chatWith(null);
    for (const level of [undefined, 'low', 'high'] as const) {
      const input = level === undefined ? base : { ...base, reasoning_effort: level };
      expect(allowlistRequest(input, cfg).body).not.toHaveProperty('reasoning');
    }
  });

  it('sends no reasoning when reasoning_max is null, whatever the client asks', () => {
    const cfg = chatWith('low', null);
    for (const level of [undefined, 'low', 'high'] as const) {
      const input = level === undefined ? base : { ...base, reasoning_effort: level };
      expect(allowlistRequest(input, cfg).body).not.toHaveProperty('reasoning');
    }
  });

  it('a null default with a high ceiling sends nothing by default and caps the request', () => {
    const cfg = chatWith(null, 'high');
    expect(allowlistRequest(base, cfg).body).not.toHaveProperty('reasoning');
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'medium' }, cfg).body)).toBe(
      'medium'
    );
  });

  describe('effectiveReasoning', () => {
    it.each<[Effort | null, Effort | null | undefined, Effort | undefined, Effort | null]>([
      ['low', undefined, 'high', 'low'],
      ['low', undefined, 'low', 'low'],
      ['low', undefined, undefined, 'low'],
      ['low', 'medium', 'high', 'medium'],
      ['low', 'medium', 'medium', 'medium'],
      ['low', 'medium', 'low', 'low'],
      ['low', 'medium', undefined, 'low'],
      ['medium', 'low', undefined, 'medium'],
      ['medium', 'low', 'high', 'low'],
      [null, undefined, 'high', null],
      [null, undefined, undefined, null],
      ['low', null, 'high', null],
      ['low', null, undefined, null],
      [null, 'high', undefined, null],
      [null, 'high', 'medium', 'medium'],
    ])('reasoning %j, reasoning_max %j, requested %j => %j', (reasoning, max, requested, out) => {
      const limits = max === undefined ? { reasoning } : { reasoning, reasoning_max: max };
      expect(effectiveReasoning(limits, requested)).toBe(out);
    });
  });

  it('derives the feature from the body and uses that feature’s own ceiling', async () => {
    const cfg = structuredClone(config) as AiConfig;
    cfg.features.chat.reasoning = 'low';
    cfg.features.chat.reasoning_max = 'low';
    cfg.features.structured.reasoning = 'low';
    cfg.features.structured.reasoning_max = 'high';
    const schema = {
      type: 'json_schema',
      json_schema: { name: 'x', strict: true, schema: { type: 'object' } },
    };
    expect(effortOf(allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg).body)).toBe('low');
    expect(
      effortOf(
        allowlistRequest({ ...base, reasoning_effort: 'high', response_format: schema }, cfg).body
      )
    ).toBe('high');
  });
});

describe('max_tokens_by_effort', () => {
  type Effort = 'low' | 'medium' | 'high';
  type ChatLimits = {
    reasoning: Effort | null;
    reasoning_max?: Effort | null;
    max_tokens: number;
    max_tokens_by_effort?: Partial<Record<Effort, number>>;
  };

  /** A chat config whose limits are exactly `limits` (keys left out of the object stay absent). */
  function chatWithLimits(limits: ChatLimits): AiConfig {
    const c = structuredClone(config) as AiConfig;
    const chat = c.features.chat as unknown as Record<string, unknown>;
    for (const key of ['reasoning', 'reasoning_max', 'max_tokens', 'max_tokens_by_effort']) {
      delete chat[key];
    }
    Object.assign(chat, limits);
    return c;
  }

  const byEffort = { medium: 3000, high: 4500 };
  const withEffort: ChatLimits = {
    reasoning: 'low',
    reasoning_max: 'high',
    max_tokens: 1500,
    max_tokens_by_effort: byEffort,
  };
  const effortOf = (body: Record<string, unknown>) =>
    (body.reasoning as { effort: string } | undefined)?.effort;

  it('uses max_tokens when the client sends no effort (the default low has no entry)', () => {
    const r = allowlistRequest(base, chatWithLimits(withEffort));
    expect(effortOf(r.body)).toBe('low');
    expect(r.body.max_tokens).toBe(1500);
    expect(r.maxTokens).toBe(1500);
  });

  it('takes the entry of the effort sent upstream', () => {
    const cfg = chatWithLimits(withEffort);
    const medium = allowlistRequest({ ...base, reasoning_effort: 'medium' }, cfg);
    expect(effortOf(medium.body)).toBe('medium');
    expect(medium.body.max_tokens).toBe(3000);
    expect(medium.maxTokens).toBe(3000);

    const high = allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg);
    expect(effortOf(high.body)).toBe('high');
    expect(high.body.max_tokens).toBe(4500);
    expect(high.maxTokens).toBe(4500);
  });

  it('a client max_tokens still lowers the effort entry', () => {
    const r = allowlistRequest(
      { ...base, reasoning_effort: 'high', max_tokens: 800 },
      chatWithLimits(withEffort)
    );
    expect(r.body.max_tokens).toBe(800);
    expect(r.maxTokens).toBe(800);
  });

  it('uses the entry of the EFFECTIVE effort when the ceiling clamps the request', () => {
    const cfg = chatWithLimits({ ...withEffort, reasoning_max: 'medium' });
    const r = allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg);
    expect(effortOf(r.body)).toBe('medium');
    expect(r.body.max_tokens).toBe(3000);
    expect(r.maxTokens).toBe(3000);
  });

  it('sends max_tokens when no reasoning is sent, even with entries present', () => {
    const cfg = chatWithLimits({ ...withEffort, reasoning: null, reasoning_max: null });
    const r = allowlistRequest({ ...base, reasoning_effort: 'high' }, cfg);
    expect(r.body).not.toHaveProperty('reasoning');
    expect(r.body.max_tokens).toBe(1500);
    expect(r.maxTokens).toBe(1500);
  });

  it('without max_tokens_by_effort every effort uses max_tokens', () => {
    const cfg = chatWithLimits({ ...withEffort, max_tokens_by_effort: undefined });
    for (const level of [undefined, 'low', 'medium', 'high'] as const) {
      const input = level === undefined ? base : { ...base, reasoning_effort: level };
      expect(allowlistRequest(input, cfg).body.max_tokens).toBe(1500);
    }
  });

  it('honours an entry smaller than max_tokens literally (the default low is sent)', () => {
    const cfg = chatWithLimits({ ...withEffort, max_tokens_by_effort: { low: 1000 } });
    const r = allowlistRequest(base, cfg);
    expect(effortOf(r.body)).toBe('low');
    expect(r.body.max_tokens).toBe(1000);
    expect(r.maxTokens).toBe(1000);
  });
});

describe('reservationBound follows the effort-specific maxTokens', () => {
  it('a larger maxTokens from a higher effort raises the bound by the exact formula', () => {
    const cfg = testConfig();
    const low = allowlistRequest({ messages: [{ role: 'user', content: 'x'.repeat(1000) }] }, cfg);
    const a = { ...low, maxTokens: 1500 };
    const b = { ...low, maxTokens: 4500 };
    const { prices, finance } = cfg;
    const inTok = Math.ceil(low.textBytes / 2) + Math.ceil(low.schemaToolsBytes / 2);
    const raw = (completion: number) =>
      inTok * prices.prompt_per_mtok + completion * prices.completion_per_mtok;
    const expectedDiff =
      Math.ceil(raw(4500) * finance.price_slack) - Math.ceil(raw(1500) * finance.price_slack);
    expect(reservationBound(b, cfg) - reservationBound(a, cfg)).toBe(expectedDiff);
    expect(reservationBound(b, cfg)).toBeGreaterThan(reservationBound(a, cfg));
  });
});
