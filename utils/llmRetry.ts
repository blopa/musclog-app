import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  toUserFacingAiError,
} from './aiErrors';
import type { CoachAIConfig, CoachAIProvider } from './coachAI';
import type { LlmRequest, RetryDecision, RetryState } from './llmRetryTypes';
import { type ProviderPolicy, providerPolicyFor } from './providerPolicy';

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
  const headers = policy.requestHeaders?.();

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
