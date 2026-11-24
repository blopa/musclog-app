import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '../aiErrors';
import { type CoachAIConfig } from '../coachAI';
import { jitteredDelayMs, retryAfterMs, withLlmRetry } from '../llmRetry';

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

const gemini: CoachAIConfig = { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'k' };
const status = (code: number, message = 'x') => Object.assign(new Error(message), { status: code });
const withHeaders = (code: number, headers: Record<string, string>) =>
  Object.assign(status(code), { headers: new Headers(headers) });

describe('jitteredDelayMs', () => {
  it('spreads a backoff over half to one and a half times its base', () => {
    expect(jitteredDelayMs(1000, () => 0)).toBe(500);
    expect(jitteredDelayMs(1000, () => 0.5)).toBe(1000);
    expect(jitteredDelayMs(1000, () => 0.999999)).toBe(1500);
    expect(jitteredDelayMs(4000, () => 0.25)).toBe(3000);
  });

  it('defaults to Math.random', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(jitteredDelayMs(2000)).toBe(1000);
    jest.restoreAllMocks();
  });
});

describe('retryAfterMs', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');

  it('reads whole and fractional seconds from a Headers object', () => {
    expect(retryAfterMs(withHeaders(429, { 'Retry-After': '3' }), now)).toBe(3000);
    expect(retryAfterMs(withHeaders(429, { 'retry-after': '1.5' }), now)).toBe(1500);
  });

  it('reads a plain header record, whatever the case of the name', () => {
    expect(retryAfterMs({ headers: { 'Retry-After': '7' } }, now)).toBe(7000);
  });

  it('reads an HTTP date relative to now, never below zero', () => {
    expect(
      retryAfterMs(withHeaders(503, { 'retry-after': 'Tue, 24 Nov 2026 12:00:05 GMT' }), now)
    ).toBe(5000);
    expect(
      retryAfterMs(withHeaders(503, { 'retry-after': 'Tue, 24 Nov 2026 11:59:00 GMT' }), now)
    ).toBe(0);
  });

  it('is undefined when there is no usable header', () => {
    expect(retryAfterMs(status(503), now)).toBeUndefined();
    expect(retryAfterMs(null, now)).toBeUndefined();
    expect(retryAfterMs(withHeaders(503, { 'retry-after': 'soon' }), now)).toBeUndefined();
    expect(retryAfterMs(withHeaders(503, { 'retry-after': '' }), now)).toBeUndefined();
  });
});

describe('withLlmRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // A jitter factor of exactly 1, so every backoff below is its base delay.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('never retries a rejected key, and throws the typed error', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(
        Object.assign(
          new Error(
            '{"error":{"message":"API key not valid","details":[{"reason":"API_KEY_INVALID"}]}}'
          ),
          { status: 400 }
        )
      );

    await expect(withLlmRetry('t', gemini, request)).rejects.toBeInstanceOf(AiInvalidKeyError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('never retries auth statuses', async () => {
    for (const code of [400, 401, 403]) {
      const request = jest.fn().mockRejectedValue(status(code, 'nope'));
      await expect(withLlmRetry('t', gemini, request)).rejects.toBeDefined();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it('still retries a transient 503 with backoff', async () => {
    const request = jest.fn().mockRejectedValueOnce(status(503)).mockResolvedValue('ok');

    const promise = withLlmRetry('t', gemini, request);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout exactly ONCE, not three times', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' })
      );

    await expect(
      withLlmRetry('t', { ...gemini, provider: 'openai' }, request)
    ).rejects.toBeInstanceOf(AiTimeoutError);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('turns a stalled request into AiTimeoutError via the abort timer', async () => {
    const request = jest.fn(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const promise = withLlmRetry('t', { ...gemini, timeoutMs: 1000 }, request);
    const settled = promise.catch((error) => error);
    await jest.advanceTimersByTimeAsync(5000);

    expect(await settled).toBeInstanceOf(AiTimeoutError);
    expect(request).toHaveBeenCalledTimes(2); // the one allowed retry also stalled
  });

  it('turns a caller cancel into AiCancelledError and does not retry', async () => {
    const controller = new AbortController();
    const request = jest.fn(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const settled = withLlmRetry('t', { ...gemini, signal: controller.signal }, request).catch(
      (e) => e
    );
    controller.abort();
    await jest.advanceTimersByTimeAsync(10);

    expect(await settled).toBeInstanceOf(AiCancelledError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not map a key-looking error to AiInvalidKeyError for the gateway', async () => {
    const request = jest.fn().mockRejectedValue(status(401, 'Unauthorized'));

    const error = await withLlmRetry('t', { ...gemini, provider: 'gateway' }, request).catch(
      (e) => e
    );

    expect(error).not.toBeInstanceOf(AiInvalidKeyError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  describe('shared transient retries (the SDKs retry nothing themselves)', () => {
    it.each([408, 429, 500, 502, 503, 504, 529])('retries a %i', async (code) => {
      const request = jest.fn().mockRejectedValueOnce(status(code)).mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it.each([400, 401, 403, 404, 413, 422, 501])('does not retry a %i', async (code) => {
      const request = jest.fn().mockRejectedValue(status(code, 'nope'));

      await expect(
        withLlmRetry('t', { ...gemini, provider: 'openai' }, request)
      ).rejects.toBeDefined();
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry a quota-style 429', async () => {
      const request = jest.fn().mockRejectedValue(status(429, 'You exceeded your current quota'));

      await expect(withLlmRetry('t', gemini, request)).rejects.toBeDefined();
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('retries a dropped connection from the OpenAI SDK', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(new OpenAI.APIConnectionError({ message: 'Connection error.' }))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', { ...gemini, provider: 'openai' }, request);
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('retries a dropped connection from the Anthropic SDK', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(new Anthropic.APIConnectionError({ message: 'Connection error.' }))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', { ...gemini, provider: 'claude' }, request);
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it.each(['fetch failed: socket hang up', 'Network request failed'])(
      'retries the raw fetch failure %p that the Gemini SDK lets through',
      async (message) => {
        const request = jest.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValue('ok');

        const promise = withLlmRetry('t', gemini, request);
        await jest.advanceTimersByTimeAsync(1000);

        await expect(promise).resolves.toBe('ok');
        expect(request).toHaveBeenCalledTimes(2);
      }
    );

    it('gives a persistent connection failure the same four attempts as a 503, then throws it', async () => {
      const failure = new OpenAI.APIConnectionError({ message: 'Connection error.' });
      const request = jest.fn().mockRejectedValue(failure);

      const settled = withLlmRetry('t', { ...gemini, provider: 'openai' }, request).catch((e) => e);
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000);

      expect(await settled).toBe(failure);
      expect(request).toHaveBeenCalledTimes(4);
    });

    it('does not retry an error with no status that is not a connection failure', async () => {
      const request = jest.fn().mockRejectedValue(new Error('Cannot read properties of undefined'));

      await expect(withLlmRetry('t', gemini, request)).rejects.toThrow('Cannot read');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('keeps the timeout rule: a request timeout of the OpenAI SDK is retried once, not as a connection failure', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new OpenAI.APIConnectionTimeoutError({ message: 'Request timed out.' }));

      const settled = withLlmRetry('t', { ...gemini, provider: 'openai' }, request).catch((e) => e);
      await jest.advanceTimersByTimeAsync(10_000);

      expect(await settled).toBeInstanceOf(AiTimeoutError);
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not retry a connection failure once text has been shown', async () => {
      let shown = false;
      const failure = new OpenAI.APIConnectionError({ message: 'Connection error.' });
      const request = jest.fn(async () => {
        shown = true;
        throw failure;
      });

      const error = await withLlmRetry('t', { ...gemini, provider: 'openai' }, request, {
        hasStreamed: () => shown,
      }).catch((e) => e);

      expect(error).toBe(failure);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 500 once text has been shown', async () => {
      let shown = false;
      const request = jest.fn(async () => {
        shown = true;
        throw status(500, 'boom');
      });

      const error = await withLlmRetry('t', gemini, request, { hasStreamed: () => shown }).catch(
        (e) => e
      );

      expect(error.status).toBe(500);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('still never retries a rejected key on a provider whose SDK used to retry it', async () => {
      const request = jest.fn().mockRejectedValue(status(401, 'Incorrect API key provided'));

      const error = await withLlmRetry('t', { ...gemini, provider: 'claude' }, request).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(AiInvalidKeyError);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  describe('backoff jitter', () => {
    it('waits the jittered delay, not the bare base', async () => {
      (Math.random as jest.Mock).mockReturnValue(0); // 0.5 x base
      const request = jest.fn().mockRejectedValueOnce(status(503)).mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(499);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('can wait up to one and a half times the base', async () => {
      (Math.random as jest.Mock).mockReturnValue(0.999999);
      const request = jest.fn().mockRejectedValueOnce(status(503)).mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(1499);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
    });
  });

  describe('Retry-After', () => {
    it('waits what the provider asked for instead of the backoff', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(withHeaders(429, { 'retry-after': '3' }))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(2999);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('waits an HTTP date relative to now', async () => {
      jest.setSystemTime(new Date('2026-11-24T12:00:00Z'));
      const request = jest
        .fn()
        .mockRejectedValueOnce(withHeaders(503, { 'retry-after': 'Tue, 24 Nov 2026 12:00:05 GMT' }))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(4999);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
    });

    it('accepts the longest wait it allows, 10 seconds', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(withHeaders(429, { 'retry-after': '10' }))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request);
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(promise).resolves.toBe('ok');
    });

    it('does not retry when the provider asks for more than 10 seconds', async () => {
      const failure = withHeaders(429, { 'retry-after': '30' });
      const request = jest.fn().mockRejectedValue(failure);

      const error = await withLlmRetry('t', gemini, request).catch((e) => e);

      expect(error).toBe(failure);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('ignores Retry-After on a failure that is not retried anyway', async () => {
      const request = jest.fn().mockRejectedValue(withHeaders(400, { 'retry-after': '1' }));

      await expect(withLlmRetry('t', gemini, request)).rejects.toBeDefined();
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('reads the headers an SDK error carries', async () => {
      const failure = OpenAI.APIError.generate(
        429,
        { message: 'Slow down', type: 'rate_limit' },
        'Slow down',
        new Headers({ 'retry-after': '2' })
      );
      const request = jest.fn().mockRejectedValueOnce(failure).mockResolvedValue('ok');

      const promise = withLlmRetry('t', { ...gemini, provider: 'openai' }, request);
      await jest.advanceTimersByTimeAsync(1999);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
    });
  });

  describe('Musclog Iron keeps its own rules', () => {
    const hosted: CoachAIConfig = {
      ...gemini,
      provider: 'hosted',
      baseUrl: 'https://w.example/v1',
    };

    it('does not hand a dropped connection to the shared retries', async () => {
      const failure = new OpenAI.APIConnectionError({ message: 'Connection error.' });
      const request = jest.fn().mockRejectedValue(failure);

      const error = await withLlmRetry('t', hosted, request).catch((e) => e);

      expect(error).toBe(failure);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry a bare 408 the Worker did not classify', async () => {
      const request = jest.fn().mockRejectedValue(status(408));

      await expect(withLlmRetry('t', hosted, request)).rejects.toBeDefined();
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('backs off on the bare base delay, without jitter, like before', async () => {
      (Math.random as jest.Mock).mockReturnValue(0);
      const request = jest.fn().mockRejectedValueOnce(status(503)).mockResolvedValue('ok');

      const promise = withLlmRetry('t', hosted, request);
      await jest.advanceTimersByTimeAsync(999);
      expect(request).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
    });
  });

  describe('streaming requests', () => {
    it('retries a transient failure while nothing has been shown', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(status(503, 'overloaded'))
        .mockResolvedValue('ok');

      const promise = withLlmRetry('t', gemini, request, { hasStreamed: () => false });
      await jest.advanceTimersByTimeAsync(1500);

      expect(await promise).toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not retry once text has been shown', async () => {
      let shown = false;
      const request = jest.fn(async () => {
        shown = true;
        throw status(503, 'overloaded');
      });

      const error = await withLlmRetry('t', gemini, request, { hasStreamed: () => shown }).catch(
        (e) => e
      );

      expect(error.status).toBe(503);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry a timeout once text has been shown, and still reports it as one', async () => {
      let shown = false;
      const request = jest.fn(
        (signal: AbortSignal) =>
          new Promise((_resolve, reject) => {
            shown = true;
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );

      const settled = withLlmRetry('t', { ...gemini, timeoutMs: 1000 }, request, {
        hasStreamed: () => shown,
      }).catch((e) => e);
      await jest.advanceTimersByTimeAsync(5000);

      expect(await settled).toBeInstanceOf(AiTimeoutError);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('treats the timeout as an idle timeout: touch() keeps a flowing stream alive', async () => {
      const request = jest.fn(
        (_signal: AbortSignal, touch: () => void) =>
          new Promise<string>((resolve) => {
            // three chunks 800 ms apart: 2400 ms in total, over the 1000 ms timeout
            setTimeout(touch, 800);
            setTimeout(touch, 1600);
            setTimeout(() => resolve('done'), 2400);
          })
      );

      const promise = withLlmRetry('t', { ...gemini, timeoutMs: 1000 }, request);
      await jest.advanceTimersByTimeAsync(3000);

      expect(await promise).toBe('done');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('still times out a stream that goes quiet', async () => {
      const request = jest.fn(
        (signal: AbortSignal, touch: () => void) =>
          new Promise((_resolve, reject) => {
            setTimeout(touch, 800); // one chunk, then silence
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );

      const settled = withLlmRetry('t', { ...gemini, timeoutMs: 1000 }, request).catch((e) => e);
      await jest.advanceTimersByTimeAsync(6000); // the one allowed timeout retry stalls as well

      expect(await settled).toBeInstanceOf(AiTimeoutError);
      expect(request).toHaveBeenCalledTimes(2);
    });
  });
});
