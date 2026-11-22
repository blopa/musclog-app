/**
 * Types shared by the retry loop (`llmRetry.ts`) and the provider policies (`hostedProviderPolicy.ts`).
 * Type declarations only, so neither module needs the other at type level.
 */

/**
 * The per-call options of an OpenAI-compatible request: the abort signal and, for a provider with
 * request headers (hosted: the `Idempotency-Key`), those headers, the same on every attempt. The
 * request callback receives them ready to pass, so no call site can forget either.
 */
export type LlmRequestOptions = { signal: AbortSignal; headers?: Record<string, string> };

export type LlmRequest<T> = (
  signal: AbortSignal,
  touch: () => void,
  options: LlmRequestOptions
) => Promise<T>;

/** What the retry loop has already spent on one logical request. */
export type RetryState = { attempt: number; timeoutRetried: boolean };

/** Either the error to throw, or how long to wait and which budget the retry spends. */
export type RetryDecision =
  { error: unknown } | { delayMs: number; log: string; spends: 'attempt' | 'timeout' };
