/**
 * Musclog Premium (hosted) failures: one error class, one kind per thing the person can act on, and
 * the one function that reads a Worker answer. Relative imports only, so `aiErrors.ts` can read the
 * kind without a cycle and the Worker's tests could load it.
 *
 * Messages are fixed: the Worker's own text never reaches the user.
 */
import { setHostedSignal } from './premium/hostedSignal';
import type { PremiumActionFailure } from './premium/premiumState';

export type HostedErrorKind =
  | 'budget' // the period's allowance is used up (402 budget_exhausted)
  | 'dailyLimit' // this subscription's own daily cap is reached (402 daily_limit)
  | 'subscription' // no active subscription behind this device (403)
  | 'removed' // 401 unknown_device: the app never re-enrolls on its own
  | 'unavailable' // 5xx, Cloudflare 1027, hosted_disabled, an expired session token
  | 'dailyFull' // 503 daily_full: Premium is at capacity today
  | 'busy' // 409 in_progress and 429
  | 'alreadyProcessed'; // 409 already_processed: the person must resend

const MESSAGES: Record<HostedErrorKind, string> = {
  budget: 'Musclog Premium: the monthly allowance is used up',
  dailyLimit: 'Musclog Premium: the daily limit is reached',
  subscription: 'Musclog Premium: no active subscription on this device',
  removed: 'Musclog Premium: this device was removed from the subscription',
  unavailable: 'Musclog Premium is temporarily unavailable',
  dailyFull: 'Musclog Premium: at capacity today',
  busy: 'Musclog Premium is busy, try again shortly',
  alreadyProcessed: 'Musclog Premium already answered this request; please send it again',
};

export class HostedAiError extends Error {
  readonly hostedKind: HostedErrorKind;
  /** Only the statuses `withLlmRetry` may repeat with the same idempotency key. */
  readonly retryable: boolean;
  readonly resetsAt?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: HostedErrorKind,
    options: { retryable?: boolean; resetsAt?: string; retryAfterSeconds?: number } = {}
  ) {
    super(MESSAGES[kind]);
    this.name = 'HostedAiError';
    this.hostedKind = kind;
    this.retryable = options.retryable ?? kind === 'busy';
    this.resetsAt = options.resetsAt;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** The hosted failure kind of a thrown error, or `null` for anything else. */
export function hostedErrorKindOf(error: unknown): HostedErrorKind | null {
  return error instanceof HostedAiError ? error.hostedKind : null;
}

/** A hosted failure `withLlmRetry` may repeat, with the same idempotency key. */
export function isRetryableHostedError(error: unknown): boolean {
  return error instanceof HostedAiError && error.retryable;
}

/** Maps a failed session-token grant (from `AiService`) to the hosted error, without any request. */
export function hostedGrantError(failure: PremiumActionFailure): HostedAiError {
  if (failure === 'unknown_device') {
    return new HostedAiError('removed');
  }

  return new HostedAiError(
    failure === 'not_enrolled' || failure === 'subscription_required'
      ? 'subscription'
      : 'unavailable'
  );
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const numericSeconds = (value: unknown): number | undefined => {
  const seconds = typeof value === 'number' ? value : Number(value);

  return value !== undefined && value !== null && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : undefined;
};

/** What an OpenAI SDK failure exposes: `status`, the parsed body on `error`, and `headers`. */
type SdkFailure = {
  status?: unknown;
  message?: unknown;
  error?: unknown;
  headers?: { get?: (name: string) => string | null | undefined };
};

/**
 * Maps an SDK failure from the Musclog Worker to a hosted error, or `null` when it is not one the
 * Worker produces. The Worker's body is `{ error: { code, message, retry_after?, resets_at? } }`;
 * the SDK keeps that body on `error.error`, so the code is read from the inner object.
 */
export function toHostedAiError(error: unknown): HostedAiError | null {
  if (error instanceof HostedAiError) {
    return error;
  }

  const failure = error as SdkFailure | null;
  if (typeof failure !== 'object' || failure === null || typeof failure.status !== 'number') {
    return null;
  }

  const { status } = failure;
  const body = (
    typeof failure.error === 'object' && failure.error !== null ? failure.error : {}
  ) as Record<string, unknown>;
  const inner = (
    typeof body.error === 'object' && body.error !== null ? body.error : body
  ) as Record<string, unknown>;
  const code = typeof inner.code === 'string' ? inner.code : '';
  const resetsAt = typeof inner.resets_at === 'string' ? inner.resets_at : undefined;
  const retryAfterSeconds =
    numericSeconds(inner.retry_after) ??
    numericSeconds(
      typeof failure.headers?.get === 'function' ? failure.headers.get('retry-after') : undefined
    );

  if (/error code: ?1027/i.test(String(failure.message ?? '')) || code === '1027') {
    return new HostedAiError('unavailable');
  }

  if (code === 'daily_full') {
    return new HostedAiError('dailyFull');
  }

  switch (status) {
    case 402:
      return new HostedAiError(code === 'daily_limit' ? 'dailyLimit' : 'budget', { resetsAt });
    case 403:
      return new HostedAiError('subscription');
    case 401:
      return new HostedAiError(code === 'unknown_device' ? 'removed' : 'unavailable');
    case 409:
      if (code === 'in_progress') {
        return new HostedAiError('busy', { retryAfterSeconds });
      }

      return code === 'already_processed' ? new HostedAiError('alreadyProcessed') : null;
    case 429:
      return new HostedAiError('busy', { retryAfterSeconds });
    default:
      return status >= 500
        ? new HostedAiError('unavailable', {
            retryable: code !== 'hosted_disabled' && RETRYABLE_STATUSES.has(status),
          })
        : null;
  }
}

/** Reports a hosted failure to the Premium screens (see `premium/hostedSignal.ts`). */
export function noteHostedError(error: HostedAiError): void {
  switch (error.hostedKind) {
    case 'budget':
      setHostedSignal('exhausted');
      return;
    case 'dailyFull':
      setHostedSignal('daily_full');
      return;
    case 'unavailable':
      setHostedSignal('unavailable');
      return;
    case 'removed':
      setHostedSignal('removed');
      return;
    default:
      setHostedSignal(null);
  }
}
