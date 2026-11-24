import fs from 'fs';
import path from 'path';

import {
  type CoachAIConfig,
  estimateNutritionFromPhoto,
  getNutritionInsights,
  sendCoachMessage,
} from '../coachAI';
import { withLlmRetry } from '../llmRetry';

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
jest.mock('@/utils/hostedImage', () => ({
  prepareHostedImage: jest.fn(async () => ({ base64: 'small-image', mimeType: 'image/jpeg' })),
}));
jest.mock('@/utils/prompts', () => {
  const actual = jest.requireActual('@/utils/prompts');
  return {
    ...actual,
    getActiveCustomPrompts: jest.fn(async () => []),
    getChatMessagePromptContent: jest.fn(async () => 'SYSTEM'),
    getNutritionInsightsPrompt: jest.fn(async () => 'SYSTEM'),
    getMealAnalysisPrompt: jest.fn(async () => 'SYSTEM'),
    getTrackMealFunctions: jest.fn(() => [
      { name: 'track_meal', description: 'Track', parameters: { type: 'object', properties: {} } },
    ]),
    getEstimateMacrosFunctions: jest.fn(() => ({ type: 'object', properties: {} })),
  };
});

const HOSTED: CoachAIConfig = {
  provider: 'hosted',
  model: 'hosted-model',
  apiKey: 'session-token',
  baseUrl: 'https://worker.example/v1',
};
const OPENAI: CoachAIConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'user-key',
  baseUrl: 'https://api.example/v1',
};

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'hang' | 'ok';

const okBody = (content = 'analysis text') => ({
  id: 'cmpl',
  object: 'chat.completion',
  created: 0,
  model: 'hosted-model',
  choices: [
    { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop', logprobs: null },
  ],
});

function headersOf(init: unknown): Record<string, string> {
  const raw = (init as { headers?: unknown } | undefined)?.headers;
  const out: Record<string, string> = {};
  if (!raw) {
    return out;
  }
  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
  } else if (Array.isArray(raw)) {
    for (const [key, value] of raw) {
      out[String(key).toLowerCase()] = String(value);
    }
  } else {
    for (const [key, value] of Object.entries(raw as Record<string, string>)) {
      out[key.toLowerCase()] = String(value);
    }
  }
  return out;
}

/** Scripted HTTP: each request takes the next reply; `ok` once the script is used up. */
function installFetch(replies: Reply[]) {
  const seen: { headers: Record<string, string> }[] = [];
  const fetchMock = jest.fn(async (_input: unknown, init?: RequestInit) => {
    seen.push({ headers: headersOf(init) });
    const reply: Reply = replies.shift() ?? 'ok';
    if (reply === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      });
    }

    if (reply === 'ok') {
      return new Response(JSON.stringify(okBody()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body ?? {}),
      {
        status: reply.status,
        headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
      }
    );
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return { seen, fetchMock };
}

/** Runs a call while advancing fake time, so backoff delays and timeouts resolve. */
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

const error503 = { status: 503, body: { error: { code: 'upstream', message: 'busy' } } };
const inProgress409 = {
  status: 409,
  body: { error: { code: 'in_progress', message: 'still running' } },
  headers: { 'x-should-retry': 'false' },
};

describe('hosted idempotency', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('sends the same Idempotency-Key on every attempt of one logical request', async () => {
    const { seen } = installFetch([error503, error503, 'ok']);

    const result = await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));

    expect(result).toBe('analysis text');
    expect(seen).toHaveLength(3);
    const keys = seen.map((call) => call.headers['idempotency-key']);
    expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1);
  });

  it('keeps the key when a timed-out request is retried', async () => {
    const { seen } = installFetch(['hang', 'ok']);

    const result = await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));

    expect(result).toBe('analysis text');
    expect(seen).toHaveLength(2);
    expect(seen[0].headers['idempotency-key']).toBeTruthy();
    expect(seen[1].headers['idempotency-key']).toBe(seen[0].headers['idempotency-key']);
  });

  it('gives two sequential logical calls different keys', async () => {
    const { seen } = installFetch(['ok', 'ok']);

    await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));
    await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));

    expect(seen).toHaveLength(2);
    expect(seen[0].headers['idempotency-key']).not.toBe(seen[1].headers['idempotency-key']);
  });

  it('sends no Idempotency-Key to a non-hosted provider', async () => {
    const { seen } = installFetch(['ok']);

    await settle(getNutritionInsights(OPENAI, '2026-01-01', '2026-01-07'));

    expect(seen).toHaveLength(1);
    expect(seen[0].headers['idempotency-key']).toBeUndefined();
  });

  it('covers the plain-text path (generateText)', async () => {
    const { seen } = installFetch(['ok']);

    await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));

    expect(seen[0].headers['idempotency-key']).toBeTruthy();
  });

  it('covers the history path (generateTextWithHistory)', async () => {
    const { seen } = installFetch(['ok']);

    await settle(
      getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07', undefined, [
        { role: 'user', content: 'earlier question' },
        { role: 'coach', content: 'earlier answer' },
      ])
    );

    expect(seen[0].headers['idempotency-key']).toBeTruthy();
  });

  it('covers the chat JSON path (sendViaOpenAI)', async () => {
    const { seen } = installFetch(['ok']);

    await settle(sendCoachMessage(HOSTED, [], 'hello'));

    expect(seen[0].headers['idempotency-key']).toBeTruthy();
  });

  it('covers the streaming path (streamOpenAiText) with the same key on retries', async () => {
    const stream =
      'data: {"id":"c","object":"chat.completion.chunk","created":0,"model":"m","choices":[{"index":0,"delta":{"content":"{\\"msg4User\\":\\"hi\\"}"},"finish_reason":null}]}\n\ndata: [DONE]\n\n';
    const { seen } = installFetch([
      error503,
      { status: 200, body: stream, headers: { 'content-type': 'text/event-stream' } },
    ]);
    const sink = { onText: jest.fn() };

    await settle(sendCoachMessage(HOSTED, [], 'hello', undefined, sink));

    expect(seen).toHaveLength(2);
    expect(seen[0].headers['idempotency-key']).toBeTruthy();
    expect(seen[1].headers['idempotency-key']).toBe(seen[0].headers['idempotency-key']);
  });

  it('covers the image path (generateWithImageStructured) and sends the same key', async () => {
    const { seen } = installFetch([error503, 'ok']);

    await settle(estimateNutritionFromPhoto(HOSTED, 'AAAA'));

    expect(seen).toHaveLength(2);
    expect(seen[0].headers['idempotency-key']).toBeTruthy();
    expect(seen[1].headers['idempotency-key']).toBe(seen[0].headers['idempotency-key']);
  });

  it('retries a 409 in_progress with the same key even though the SDK does not', async () => {
    const { seen } = installFetch([inProgress409, 'ok']);

    const result = await settle(getNutritionInsights(HOSTED, '2026-01-01', '2026-01-07'));

    expect(result).toBe('analysis text');
    expect(seen).toHaveLength(2);
    expect(seen[1].headers['idempotency-key']).toBe(seen[0].headers['idempotency-key']);
  });

  it('hands the request its options with the key, and the same one on each attempt', async () => {
    const keys: (string | undefined)[] = [];
    const request = jest.fn(async (_signal: AbortSignal, _touch: () => void, options) => {
      keys.push(options.headers?.['Idempotency-Key']);
      if (keys.length < 3) {
        throw Object.assign(new Error('x'), { status: 503 });
      }
      return 'done';
    });

    const promise = withLlmRetry('t', HOSTED, request);
    const result = await settle(promise);

    expect(result).toBe('done');
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBeTruthy();
  });

  it('never puts the key in the static client default headers (source guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'coachAI.ts'), 'utf8');
    const start = source.indexOf('function buildOpenAIClient');
    const end = source.indexOf('\n}\n', start);
    const body = source.slice(start, end);
    // The client sets no default headers at all: the key travels per call, through the options
    // `withLlmRetry` hands the request.
    expect(body).not.toMatch(/defaultHeaders/);
    expect(body).not.toMatch(/Idempotency-Key/i);
    expect(body).not.toMatch(/idempotencyKey/);
  });
});
