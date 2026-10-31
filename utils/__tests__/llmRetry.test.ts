import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '../aiErrors';
import { type CoachAIConfig, withLlmRetry } from '../coachAI';

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

describe('withLlmRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
