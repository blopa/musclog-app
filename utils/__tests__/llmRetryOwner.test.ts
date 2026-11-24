import fs from 'fs';
import path from 'path';

import { type CoachAIConfig, getNutritionInsights } from '../coachAI';
import { buildClaudeClient } from '../claude';

/**
 * `withLlmRetry` is the one retry loop. The provider SDKs retry by default (two retries each), which
 * multiplied every failure: a persistent 500 became 4 attempts x 3 requests. These tests run a
 * request through the real OpenAI client and assert the SDK adds none of its own.
 */

jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => 'off'),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));
jest.mock('@/utils/prompts', () => {
  const actual = jest.requireActual('@/utils/prompts');
  return {
    ...actual,
    getActiveCustomPrompts: jest.fn(async () => []),
    getNutritionInsightsPrompt: jest.fn(async () => 'SYSTEM'),
  };
});

const OPENAI: CoachAIConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'user-key',
  baseUrl: 'https://api.example/v1',
};

const okBody = {
  id: 'cmpl',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-test',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'analysis text' },
      finish_reason: 'stop',
      logprobs: null,
    },
  ],
};

type Reply = { status: number; headers?: Record<string, string> } | 'ok' | 'drop';

function installFetch(replies: Reply[]) {
  const fetchMock = jest.fn(async () => {
    const reply: Reply = replies.shift() ?? 'ok';
    if (reply === 'drop') {
      throw new TypeError('fetch failed');
    }

    if (reply === 'ok') {
      return new Response(JSON.stringify(okBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: { message: 'boom', type: 'server_error' } }), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
    });
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  return fetchMock;
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  const tracked = promise.finally(() => {
    done = true;
  });
  while (!done) {
    await jest.advanceTimersByTimeAsync(1000);
  }

  return tracked;
}

describe('one retry owner', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('makes exactly four HTTP requests for a persistent 500, not twelve', async () => {
    const fetchMock = installFetch([
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ]);

    const result = await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'));

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries a dropped connection once per attempt, and recovers', async () => {
    const fetchMock = installFetch(['drop', 'ok']);

    const result = await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'));

    expect(result).toBe('analysis text');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400', async () => {
    const fetchMock = installFetch([{ status: 400 }]);

    const result = await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'));

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honours Retry-After from the real SDK error and gives up on a longer one', async () => {
    const waited = installFetch([{ status: 429, headers: { 'retry-after': '2' } }, 'ok']);
    expect(await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'))).toBe(
      'analysis text'
    );
    expect(waited).toHaveBeenCalledTimes(2);

    const gaveUp = installFetch([{ status: 429, headers: { 'retry-after': '60' } }, 'ok']);
    expect(await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'))).toBeNull();
    expect(gaveUp).toHaveBeenCalledTimes(1);
  });

  it('builds the OpenAI-compatible client with the SDK retries off (source guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'coachAI.ts'), 'utf8');
    const start = source.indexOf('function buildOpenAIClient');
    const body = source.slice(start, source.indexOf('\n}\n', start));

    expect(body).toMatch(/maxRetries: 0/);
  });

  it('builds the Claude client with the retries it is given', () => {
    expect(buildClaudeClient('k', 0).maxRetries).toBe(0);
  });

  it('asks for no SDK retries at the one Claude call site (source guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'coachAI.ts'), 'utf8');

    const calls = source.match(/buildClaudeClient\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/, 0\)$/);
    }
  });
});
