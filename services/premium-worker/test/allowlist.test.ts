import { describe, expect, it } from 'vitest';

import { allowlistRequest, assertPremiumPrivacy } from '../src/proxy/allowlist';
import { reservationBound } from '../src/proxy/bound';
import { ApiError } from '../src/http';
import { testConfig } from './fakes/ctx';

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
    expect(rejected({ messages: [img()] }).extra.path).toBe('messages[0].content[1]');
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
    const two = { role: 'user', content: [...img().content, ...img().content] };
    expect(rejected({ messages: [two] }, visionConfig).status).toBe(400);
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
