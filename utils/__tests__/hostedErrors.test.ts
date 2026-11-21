import OpenAI from 'openai';

import { describeAiError, rethrowUserFacingAiError } from '@/utils/aiErrors';
import {
  HostedAiError,
  hostedErrorKindOf,
  hostedGrantError,
  isRetryableHostedError,
  toHostedAiError,
} from '@/utils/hostedAiError';
import { type CoachAIConfig, reportAiError, withLlmRetry } from '@/utils/coachAI';
import { getHostedSignal, setHostedSignal } from '@/utils/premium/hostedSignal';
import { handleError } from '@/utils/handleError';

jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));

const HOSTED: CoachAIConfig = {
  provider: 'hosted',
  model: 'm',
  apiKey: 'session-token',
  baseUrl: 'https://worker.example/v1',
};

type Reply = { status: number; body: unknown; headers?: Record<string, string> };

/**
 * Runs one logical request through the real OpenAI client against a scripted Worker that always
 * answers `reply`, and reports the thrown error and how many HTTP attempts it took.
 */
async function failWith(reply: Reply, config: CoachAIConfig = HOSTED) {
  const calls = { count: 0 };
  const fetchMock = jest.fn(async () => {
    calls.count += 1;
    return new Response(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body), {
      status: reply.status,
      headers: {
        'content-type': typeof reply.body === 'string' ? 'text/html' : 'application/json',
        ...(reply.headers ?? {}),
      },
    });
  });
  const client = new OpenAI({
    apiKey: 'session-token',
    baseURL: config.baseUrl,
    fetch: fetchMock as unknown as typeof fetch,
    maxRetries: 0,
  });

  const promise = withLlmRetry('test', config, (signal) =>
    client.chat.completions.create(
      { model: 'm', messages: [{ role: 'user', content: 'x' }] },
      { signal }
    )
  ).catch((error: unknown) => error);

  let done = false;
  promise.finally(() => {
    done = true;
  });
  while (!done) {
    await jest.advanceTimersByTimeAsync(1000);
  }

  return { error: await promise, attempts: calls.count };
}

describe('hosted errors', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setHostedSignal(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('status and code to class', () => {
    it('402 budget_exhausted is a budget error with the reset date, tried once', async () => {
      const { error, attempts } = await failWith({
        status: 402,
        body: {
          error: { code: 'budget_exhausted', message: 'x', resets_at: '2026-12-01T00:00:00Z' },
        },
      });

      expect(hostedErrorKindOf(error)).toBe('budget');
      expect((error as HostedAiError).resetsAt).toBe('2026-12-01T00:00:00Z');
      expect(attempts).toBe(1);
      expect(getHostedSignal()).toBe('exhausted');
    });

    it('402 daily_limit is the daily cap, not the used-up allowance, and leaves the usage signal alone', async () => {
      const { error, attempts } = await failWith({
        status: 402,
        body: {
          error: { code: 'daily_limit', message: 'x', resets_at: '2026-12-02T00:00:00Z' },
        },
      });

      expect(hostedErrorKindOf(error)).toBe('dailyLimit');
      expect((error as HostedAiError).resetsAt).toBe('2026-12-02T00:00:00Z');
      expect(attempts).toBe(1);
      expect(getHostedSignal()).toBeNull();
      expect(describeAiError(error, (key) => key)).toBe('errors.hostedDailyLimit');
    });

    it('403 is a subscription error, not a removal', async () => {
      const { error, attempts } = await failWith({
        status: 403,
        body: { error: { code: 'subscription_required', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('subscription');
      expect(hostedErrorKindOf(error)).not.toBe('removed');
      expect(attempts).toBe(1);
    });

    it('401 unknown_device is a removal', async () => {
      const { error, attempts } = await failWith({
        status: 401,
        body: { error: { code: 'unknown_device', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('removed');
      expect((error as HostedAiError).hostedKind).toBe('removed');
      expect(attempts).toBe(1);
      expect(getHostedSignal()).toBe('removed');
    });

    it('any other 401 is unavailable (an expired token) and is not retried', async () => {
      const { error, attempts } = await failWith({
        status: 401,
        body: { error: { code: 'token_expired', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(isRetryableHostedError(error)).toBe(false);
      expect(attempts).toBe(1);
    });

    it('409 in_progress is busy and is retried with backoff, four attempts in all', async () => {
      const { error, attempts } = await failWith({
        status: 409,
        body: { error: { code: 'in_progress', message: 'x' } },
        headers: { 'x-should-retry': 'false' },
      });

      expect(hostedErrorKindOf(error)).toBe('busy');
      expect(attempts).toBe(4);
    });

    it('409 already_processed is never retried', async () => {
      const { error, attempts } = await failWith({
        status: 409,
        body: { error: { code: 'already_processed', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('alreadyProcessed');
      expect(attempts).toBe(1);
    });

    it('429 is busy and carries the retry-after seconds from the body', async () => {
      const { error, attempts } = await failWith({
        status: 429,
        body: { error: { code: 'rate_limited', message: 'x', retry_after: 7 } },
      });

      expect(hostedErrorKindOf(error)).toBe('busy');
      expect((error as HostedAiError).retryAfterSeconds).toBe(7);
      expect(attempts).toBe(4);
    });

    it('500 is unavailable and not retried', async () => {
      const { error, attempts } = await failWith({
        status: 500,
        body: { error: { message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(isRetryableHostedError(error)).toBe(false);
      expect(attempts).toBe(1);
    });

    it('502 is unavailable and retried', async () => {
      const { error, attempts } = await failWith({
        status: 502,
        body: { error: { message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(attempts).toBe(4);
    });

    it('503 daily_full is the daily cap and is not retried', async () => {
      const { error, attempts } = await failWith({
        status: 503,
        body: { error: { code: 'daily_full', message: 'x' } },
      });

      expect((error as HostedAiError).hostedKind).toBe('dailyFull');
      expect(attempts).toBe(1);
      expect(getHostedSignal()).toBe('daily_full');
    });

    it('503 hosted_disabled is unavailable and not retried', async () => {
      const { error, attempts } = await failWith({
        status: 503,
        body: { error: { code: 'hosted_disabled', message: 'x' } },
      });

      expect((error as HostedAiError).hostedKind).toBe('unavailable');
      expect(attempts).toBe(1);
    });

    it('a generic 503 is unavailable and retried', async () => {
      const { error, attempts } = await failWith({
        status: 503,
        body: { error: { code: 'upstream', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(attempts).toBe(4);
    });

    it('504 is unavailable and retried', async () => {
      const { error, attempts } = await failWith({
        status: 504,
        body: { error: { message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(attempts).toBe(4);
    });

    it('Cloudflare 1027 is unavailable and not retried', async () => {
      const { error, attempts } = await failWith({ status: 503, body: 'error code: 1027' });

      expect(hostedErrorKindOf(error)).toBe('unavailable');
      expect(attempts).toBe(1);
    });

    it('a 400 is not a hosted error: it stays the SDK error', async () => {
      const { error, attempts } = await failWith({
        status: 400,
        body: { error: { code: 'bad_request', message: 'x' } },
      });

      expect(hostedErrorKindOf(error)).toBeNull();
      expect(error).toBeInstanceOf(OpenAI.APIError);
      expect(attempts).toBe(1);
    });
  });

  it('never copies the Worker message into the error', async () => {
    const { error } = await failWith({
      status: 503,
      body: { error: { code: 'upstream', message: 'SECRET-INTERNAL-DETAIL' } },
    });

    expect(String((error as Error).message)).not.toContain('SECRET');
  });

  it('maps an SDK error from the real client to the same class via toHostedAiError', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'daily_full', message: 'x' } }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
    );
    const client = new OpenAI({
      apiKey: 'k',
      baseURL: 'https://worker.example/v1',
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });
    const sdkError = await client.chat.completions
      .create({ model: 'm', messages: [] })
      .catch((e: unknown) => e);

    expect(toHostedAiError(sdkError).hostedKind).toBe('dailyFull');
    expect(toHostedAiError(new Error('plain'))).toBeNull();
  });

  describe('retry rules', () => {
    it('retries only busy and retryable unavailable errors', () => {
      expect(isRetryableHostedError(new HostedAiError('busy'))).toBe(true);
      expect(isRetryableHostedError(new HostedAiError('unavailable', { retryable: true }))).toBe(
        true
      );
      expect(isRetryableHostedError(new HostedAiError('unavailable'))).toBe(false);
      expect(isRetryableHostedError(new HostedAiError('dailyFull'))).toBe(false);
      expect(isRetryableHostedError(new HostedAiError('budget'))).toBe(false);
      expect(isRetryableHostedError(new HostedAiError('subscription'))).toBe(false);
      expect(isRetryableHostedError(new HostedAiError('removed'))).toBe(false);
      expect(isRetryableHostedError(new HostedAiError('alreadyProcessed'))).toBe(false);
    });
  });

  describe('session token grant failures', () => {
    it.each([
      ['unknown_device', 'removed'],
      ['not_enrolled', 'subscription'],
      ['subscription_required', 'subscription'],
      ['network', 'unavailable'],
      ['purchase_failed', 'unavailable'],
    ] as const)('%s maps to the typed error without sending a request', async (failure, kind) => {
      const request = jest.fn();
      const config: CoachAIConfig = { ...HOSTED, hostedGrantFailure: failure };

      const error = await withLlmRetry('test', config, request).catch((e: unknown) => e);

      expect(hostedErrorKindOf(error)).toBe(kind);
      expect(request).not.toHaveBeenCalled();
    });

    it('hostedGrantError maps the failures the same way', () => {
      expect(hostedGrantError('unknown_device').hostedKind).toBe('removed');
      expect(hostedGrantError('not_enrolled').hostedKind).toBe('subscription');
      expect(hostedGrantError('network').hostedKind).toBe('unavailable');
    });

    it('ignores a grant failure on a non-hosted provider', async () => {
      const request = jest.fn().mockResolvedValue('ok');
      const config: CoachAIConfig = {
        provider: 'openai',
        model: 'm',
        apiKey: 'k',
        hostedGrantFailure: 'unknown_device',
      };

      await expect(withLlmRetry('test', config, request)).resolves.toBe('ok');
    });

    it('marks the Premium signal when the device was removed', async () => {
      await withLlmRetry(
        'test',
        { ...HOSTED, hostedGrantFailure: 'unknown_device' },
        jest.fn()
      ).catch(() => undefined);

      expect(getHostedSignal()).toBe('removed');
    });
  });

  it('a successful hosted request marks the signal ok', async () => {
    setHostedSignal('unavailable');

    await withLlmRetry('test', HOSTED, async () => 'ok');

    expect(getHostedSignal()).toBe('ok');
  });

  describe('Sentry', () => {
    it('keeps every hosted error out of Sentry', () => {
      const handle = handleError as jest.Mock;
      handle.mockClear();

      for (const error of [
        new HostedAiError('budget'),
        new HostedAiError('subscription'),
        new HostedAiError('removed'),
        new HostedAiError('unavailable'),
        new HostedAiError('busy'),
        new HostedAiError('alreadyProcessed'),
      ]) {
        reportAiError(error, 'coachAI.test');
      }

      for (const call of handle.mock.calls) {
        expect(call[2]).toEqual({ sendToSentry: false });
      }
      expect(handle).toHaveBeenCalledTimes(6);
    });

    it('still reports an ordinary bug', () => {
      const handle = handleError as jest.Mock;
      handle.mockClear();

      reportAiError(new Error('boom'), 'coachAI.test');

      expect(handle.mock.calls[0][2]).toEqual({ sendToSentry: true });
    });
  });

  describe('aiErrors', () => {
    it('reads the hosted kind of a hosted error and nothing else', () => {
      expect(hostedErrorKindOf(new HostedAiError('budget'))).toBe('budget');
      expect(hostedErrorKindOf({ hostedKind: 'busy' })).toBeNull();
      expect(hostedErrorKindOf(new Error('x'))).toBeNull();
      expect(hostedErrorKindOf(null)).toBeNull();
    });

    it('rethrows every hosted error and nothing else', () => {
      expect(() => rethrowUserFacingAiError(new HostedAiError('budget'))).toThrow(HostedAiError);
      expect(() => rethrowUserFacingAiError(new Error('x'))).not.toThrow();
    });

    describe('describeAiError', () => {
      const t = (key: string, options?: Record<string, unknown>) =>
        options ? `${key}:${JSON.stringify(options)}` : key;

      it('formats the budget reset date for the locale', () => {
        const text = describeAiError(
          new HostedAiError('budget', { resetsAt: '2026-12-01T12:00:00Z' }),
          t,
          'en-US'
        );

        expect(text).toBe(`errors.hostedBudget:${JSON.stringify({ date: 'Dec 1, 2026' })}`);
      });

      it('falls back to the no-date budget text when there is no usable date', () => {
        expect(describeAiError(new HostedAiError('budget'), t)).toBe('errors.hostedBudgetNoDate');
        expect(describeAiError(new HostedAiError('budget', { resetsAt: 'not a date' }), t)).toBe(
          'errors.hostedBudgetNoDate'
        );
      });

      it.each([
        [new HostedAiError('subscription'), 'errors.hostedSubscription'],
        [new HostedAiError('removed'), 'errors.hostedRemoved'],
        [new HostedAiError('unavailable'), 'errors.hostedUnavailable'],
        [new HostedAiError('dailyFull'), 'errors.hostedDailyFull'],
        [new HostedAiError('busy'), 'errors.hostedBusy'],
        [new HostedAiError('alreadyProcessed'), 'errors.hostedAlreadyProcessed'],
      ])('uses the literal key for %s', (error, key) => {
        expect(describeAiError(error, t)).toBe(key);
      });

      it('keeps returning null for an ordinary error', () => {
        expect(describeAiError(new Error('x'), t)).toBeNull();
      });
    });
  });
});
