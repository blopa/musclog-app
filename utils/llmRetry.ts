import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  isAiConnectionError,
  toUserFacingAiError,
} from './aiErrors';
import type { CoachAIConfig, CoachAIProvider } from './coachAI';
import type { LlmRequest, RetryDecision, RetryState } from './llmRetryTypes';
import { type ProviderPolicy, providerPolicyFor } from './providerPolicy';

/**
 * What is worth asking again: a request timeout, a rate limit, and the server-side failures that
 * pass (an overloaded or restarting server). The provider SDKs' own retries are off, so this list is
 * all there is; every other 4xx (a wrong key, a bad request) never gets better by repeating it.
 */
const RETRYABLE_LLM_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);
const LLM_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

/** A provider that asks to wait longer than this is not waited for: the failure is thrown instead. */
const MAX_RETRY_AFTER_MS = 10_000;

/** Backoff is spread over half to one and a half times its base so retries do not arrive together. */
const JITTER_MIN = 0.5;
const JITTER_SPAN = 1;

/** The backoff for one retry with jitter; `random` is injectable so a test can pin it. */
export function jitteredDelayMs(baseMs: number, random: () => number = Math.random): number {
  return Math.round(baseMs * (JITTER_MIN + random() * JITTER_SPAN));
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (typeof headers !== 'object' || headers === null) {
    return undefined;
  }

  const getter = (headers as { get?: unknown }).get;
  if (typeof getter === 'function') {
    const value = getter.call(headers, name);

    return typeof value === 'string' ? value : undefined;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name && typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

/**
 * How long the provider asked to wait (`Retry-After`: whole seconds or an HTTP date) when the failure
 * carries its response headers (the OpenAI and Anthropic `APIError`s do), or undefined when it did
 * not ask or the value cannot be read.
 */
export function retryAfterMs(error: unknown, now: number = Date.now()): number | undefined {
  const raw = readHeader((error as { headers?: unknown } | null)?.headers, 'retry-after')?.trim();
  if (!raw) {
    return undefined;
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.round(Number(raw) * 1000);
  }

  const date = Date.parse(raw);

  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function getErrorStatus(error: any): number | undefined {
  return error?.status ?? error?.response?.status;
}

function getErrorCode(error: any): string {
  return String(error?.error?.code ?? error?.code ?? '').toLowerCase();
}

function getErrorMessage(error: any): string {
  return String(error?.message ?? '').toLowerCase();
}

function isQuotaStyleError(error: any): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === 'insufficient_quota') {
    return true;
  }

  return (
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted') ||
    message.includes('billing') ||
    message.includes('daily limit')
  );
}

function shouldRetryLlmError(error: any): boolean {
  const status = getErrorStatus(error);
  if (status === undefined) {
    // No response at all: the connection dropped. The SDKs used to repeat these themselves.
    return isAiConnectionError(error);
  }

  if (!RETRYABLE_LLM_STATUSES.has(status)) {
    return false;
  }

  if (status === 429 && isQuotaStyleError(error)) {
    return false;
  }

  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Image analysis uploads a photo and structured plans can think for a while: 60 s is generous but finite. */
const LLM_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Runs one request with a timeout and an optional caller cancel, handing the request an abort
 * signal. A timeout becomes `AiTimeoutError` and a cancel `AiCancelledError`, whatever the SDK
 * threw when it was aborted (each throws a different thing).
 *
 * The request also gets `touch()`. A streaming request calls it per chunk, which turns the timeout
 * into an idle timeout: a long answer that keeps flowing is never cut, a stalled one still is.
 */
async function runWithAbort<T>(
  config: CoachAIConfig,
  request: LlmRequest<T>,
  headers: Record<string, string> | undefined
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS);
  };

  arm();
  const onExternalAbort = () => controller.abort();
  if (config.signal?.aborted) {
    controller.abort();
  } else {
    config.signal?.addEventListener('abort', onExternalAbort);
  }

  try {
    return await request(
      controller.signal,
      arm,
      headers ? { signal: controller.signal, headers } : { signal: controller.signal }
    );
  } catch (error) {
    if (timedOut) {
      throw new AiTimeoutError();
    }

    if (config.signal?.aborted) {
      throw new AiCancelledError();
    }

    throw error;
  } finally {
    clearTimeout(timer);
    config.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Decides what a failed attempt means: a provider with its own rules (hosted) answers first, every
 * other failure follows the shared rules.
 */
function classifyLlmFailure(
  operation: string,
  provider: CoachAIProvider,
  policy: ProviderPolicy,
  error: unknown,
  state: RetryState,
  options?: { hasStreamed?: () => boolean }
): RetryDecision {
  const hasStreamed = options?.hasStreamed?.() ?? false;
  const delayMs = LLM_RETRY_DELAYS_MS[state.attempt];
  const hasAttemptsLeft = state.attempt < LLM_RETRY_DELAYS_MS.length;

  const own = policy.classifyFailure?.(operation, error, state, {
    hasStreamed,
    delayMs,
  });
  if (own) {
    return own;
  }

  // A wrong key never gets better by asking again, and is not retried.
  const userFacing = toUserFacingAiError(error, provider);
  if (userFacing instanceof AiInvalidKeyError) {
    return { error: userFacing };
  }

  if (hasStreamed) {
    return { error: userFacing ?? error };
  }

  if (userFacing instanceof AiTimeoutError) {
    // A stalled request usually stays stalled: one more try, not three.
    return state.timeoutRetried
      ? { error: userFacing }
      : {
          delayMs: 0,
          spends: 'timeout',
          log: `[coachAI] ${operation} timed out on ${provider}; retrying once`,
        };
  }

  if (
    policy.retriesTransientFailures === false ||
    !hasAttemptsLeft ||
    !shouldRetryLlmError(error)
  ) {
    return { error };
  }

  // The provider said how long to wait: do that, or give up when it is longer than we will wait.
  const asked = retryAfterMs(error);
  if (asked !== undefined && asked > MAX_RETRY_AFTER_MS) {
    return { error };
  }

  const wait = asked ?? jitteredDelayMs(delayMs);
  const status = getErrorStatus(error);

  return {
    delayMs: wait,
    spends: 'attempt',
    log: `[coachAI] ${operation} transient ${status ?? 'connection failure'} from ${provider}; retrying in ${wait}ms${asked === undefined ? '' : ' (Retry-After)'} (attempt ${state.attempt + 2}/${LLM_RETRY_DELAYS_MS.length + 1})`,
  };
}

/** Runs one logical request with its timeout, cancel and retries; see the provider policies for the rest. */
export async function withLlmRetry<T>(
  operation: string,
  config: CoachAIConfig,
  request: LlmRequest<T>,
  options?: {
    /**
     * True once a streaming request has shown text. A retry would restart the reply under the
     * user's eyes, so from then on a failure is thrown, not retried.
     */
    hasStreamed?: () => boolean;
  }
): Promise<T> {
  const provider = config.provider;
  const state: RetryState = { attempt: 0, timeoutRetried: false };
  const policy = providerPolicyFor(config);
  const headers = policy.requestHeaders?.(config);

  policy.assertUsable?.(config);

  while (true) {
    try {
      const value = await runWithAbort(config, request, headers);
      policy.onSuccess?.();

      return value;
    } catch (rawError) {
      if (rawError instanceof AiCancelledError) {
        throw rawError;
      }

      const decision = classifyLlmFailure(operation, provider, policy, rawError, state, options);
      if ('error' in decision) {
        throw decision.error;
      }

      console.warn(decision.log);
      if (decision.spends === 'timeout') {
        state.timeoutRetried = true;
      } else {
        state.attempt += 1;
      }

      if (decision.delayMs > 0) {
        const delayMs = decision.delayMs;

        await (policy.backOff ?? ((wait) => wait()))(() => sleep(delayMs));
      }
    }
  }
}
