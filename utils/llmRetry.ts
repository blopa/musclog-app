import { randomUUID } from 'expo-crypto';

import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  toUserFacingAiError,
} from './aiErrors';
import type { CoachAIConfig, CoachAIProvider } from './coachAI';
import {
  hostedGrantError,
  isRetryableHostedError,
  noteHostedError,
  toHostedAiError,
} from './hostedAiError';
import { setHostedSignal } from './premium/hostedSignal';
import { whileHostedBackingOff } from './premium/hostedWait';

const RETRYABLE_LLM_STATUSES = new Set([429, 503, 529]);
const LLM_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

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
  if (status === undefined || !RETRYABLE_LLM_STATUSES.has(status)) {
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
  request: (signal: AbortSignal, touch: () => void, meta: HostedRequestMeta) => Promise<T>,
  meta: HostedRequestMeta
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
    return await request(controller.signal, arm, meta);
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
 * What one logical request carries to every HTTP attempt. The idempotency key is created once per
 * logical request (hosted only), so a retry is recognised by the Worker as the same request.
 */
export type HostedRequestMeta = { idempotencyKey?: string };

/**
 * The per-call request options of every OpenAI-compatible request: the abort signal and, for a hosted
 * request, the `Idempotency-Key` header, so no call site can forget either. Non-hosted requests
 * send no header.
 */
export function requestOptions(
  signal: AbortSignal,
  meta: HostedRequestMeta
): { signal: AbortSignal; headers?: Record<string, string> } {
  return meta.idempotencyKey
    ? { signal, headers: { 'Idempotency-Key': meta.idempotencyKey } }
    : { signal };
}

/** What the retry loop has already spent on one logical request. */
type RetryState = { attempt: number; timeoutRetried: boolean };

/** Either the error to throw, or how long to wait and which budget the retry spends. */
type RetryDecision =
  { error: unknown } | { delayMs: number; log: string; spends: 'attempt' | 'timeout' };

/**
 * One logical request's meta: a hosted request gets one idempotency key for every attempt, so the
 * Worker recognises a retry as the same request.
 */
function newRequestMeta(config: CoachAIConfig): HostedRequestMeta {
  return { idempotencyKey: config.provider === 'hosted' ? randomUUID() : undefined };
}

/** A hosted session token that could not be minted sends nothing: the typed error says why. */
function assertConfigUsable(config: CoachAIConfig): void {
  if (config.hostedGrantFailure) {
    const grantError = hostedGrantError(config.hostedGrantFailure);
    noteHostedError(grantError);
    throw grantError;
  }
}

function noteRequestSucceeded(provider: CoachAIProvider): void {
  if (provider === 'hosted') {
    setHostedSignal('ok');
  }
}

/**
 * Decides what a failed attempt means: a hosted failure follows the Worker's rules (retry only the
 * statuses it says are safe, same idempotency key); every other failure follows the shared rules.
 * Pure apart from noting a hosted failure for the Premium screens.
 */
function classifyLlmFailure(
  operation: string,
  provider: CoachAIProvider,
  error: unknown,
  state: RetryState,
  options?: { hasStreamed?: () => boolean }
): RetryDecision {
  const hasStreamed = options?.hasStreamed?.() ?? false;
  const delayMs = LLM_RETRY_DELAYS_MS[state.attempt];
  const hasAttemptsLeft = state.attempt < LLM_RETRY_DELAYS_MS.length;

  const hosted = provider === 'hosted' ? toHostedAiError(error) : null;
  if (hosted) {
    noteHostedError(hosted);
    if (!isRetryableHostedError(hosted) || hasStreamed || !hasAttemptsLeft) {
      return { error: hosted };
    }

    return {
      delayMs,
      spends: 'attempt',
      log: `[coachAI] ${operation} hosted ${hosted.hostedKind}; retrying in ${delayMs}ms with the same idempotency key`,
    };
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

  if (!hasAttemptsLeft || !shouldRetryLlmError(error)) {
    return { error };
  }

  const status = getErrorStatus(error);

  return {
    delayMs,
    spends: 'attempt',
    log: `[coachAI] ${operation} transient ${status ?? 'unknown'} from ${provider}; retrying in ${delayMs}ms (attempt ${state.attempt + 2}/${LLM_RETRY_DELAYS_MS.length + 1})`,
  };
}

/** Exported for tests; not part of the module's public surface. */
export async function withLlmRetry<T>(
  operation: string,
  config: CoachAIConfig,
  request: (signal: AbortSignal, touch: () => void, meta: HostedRequestMeta) => Promise<T>,
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
  const meta = newRequestMeta(config);

  assertConfigUsable(config);

  while (true) {
    try {
      const value = await runWithAbort(config, request, meta);
      noteRequestSucceeded(provider);

      return value;
    } catch (rawError) {
      if (rawError instanceof AiCancelledError) {
        throw rawError;
      }

      const decision = classifyLlmFailure(operation, provider, rawError, state, options);
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

        if (provider === 'hosted') {
          await whileHostedBackingOff(() => sleep(delayMs));
        } else {
          await sleep(delayMs);
        }
      }
    }
  }
}
