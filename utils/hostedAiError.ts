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

type HostedSignal = Parameters<typeof setHostedSignal>[0];

interface HostedKindSpec {
  /** Fixed English message on the error; the Worker's own text never reaches the user. */
  message: string;
  /** What the Premium screens are told (`premium/hostedSignal.ts`), or `null` for none. */
  signal: HostedSignal | null;
  /** The translation key `describeAiError` shows. Literal, so `check-translations` sees it. */
  i18nKey: string;
  /** Whether `withLlmRetry` may repeat the request with the same idempotency key by default. */
  retryable: boolean;
}

/**
 * The one description of every hosted kind: its message, the signal it sends, its copy key and
 * whether it is retryable by default. `Record` makes a new kind fail the build until it is here.
 */
export const HOSTED_KINDS: Record<HostedErrorKind, HostedKindSpec> = {
  budget: {
    message: 'Musclog Premium: the monthly allowance is used up',
    signal: 'exhausted',
    i18nKey: 'errors.hostedBudget',
    retryable: false,
  },
  dailyLimit: {
    message: 'Musclog Premium: the daily limit is reached',
    signal: null,
    i18nKey: 'errors.hostedDailyLimit',
    retryable: false,
  },
  subscription: {
    message: 'Musclog Premium: no active subscription on this device',
    signal: null,
    i18nKey: 'errors.hostedSubscription',
    retryable: false,
  },
  removed: {
    message: 'Musclog Premium: this device was removed from the subscription',
    signal: 'removed',
    i18nKey: 'errors.hostedRemoved',
    retryable: false,
  },
  unavailable: {
    message: 'Musclog Premium is temporarily unavailable',
    signal: 'unavailable',
    i18nKey: 'errors.hostedUnavailable',
    retryable: false,
  },
  dailyFull: {
    message: 'Musclog Premium: at capacity today',
    signal: 'daily_full',
    i18nKey: 'errors.hostedDailyFull',
    retryable: false,
  },
  busy: {
    message: 'Musclog Premium is busy, try again shortly',
    signal: null,
    i18nKey: 'errors.hostedBusy',
    retryable: true,
  },
  alreadyProcessed: {
    message: 'Musclog Premium already answered this request; please send it again',
    signal: null,
    i18nKey: 'errors.hostedAlreadyProcessed',
    retryable: false,
  },
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
    super(HOSTED_KINDS[kind].message);
    this.name = 'HostedAiError';
    this.hostedKind = kind;
    this.retryable = options.retryable ?? HOSTED_KINDS[kind].retryable;
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

/** The fields of a Worker error body that decide the hosted kind. */
export interface WorkerBody {
  code: string;
  resetsAt?: string;
  retryAfterSeconds?: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/**
 * Reads the Worker's body from an SDK failure. The Worker sends `{ error: { code, message,
 * retry_after?, resets_at? } }`; the SDK keeps that body on `error.error`, so the fields come from
 * the inner object when there is one. `retry_after` falls back to the `retry-after` header.
 */
export function readWorkerBody(failure: SdkFailure): WorkerBody {
  const body = asRecord(failure.error);
  const inner = typeof body.error === 'object' && body.error !== null ? asRecord(body.error) : body;
  const headerValue =
    typeof failure.headers?.get === 'function' ? failure.headers.get('retry-after') : undefined;
  const resetsAt = typeof inner.resets_at === 'string' ? inner.resets_at : undefined;

  return {
    code: typeof inner.code === 'string' ? inner.code : '',
    resetsAt,
    retryAfterSeconds: numericSeconds(inner.retry_after) ?? numericSeconds(headerValue),
  };
}

/**
 * Maps an SDK failure from the Musclog Worker to a hosted error, or `null` when it is not one the
 * Worker produces.
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
  const { code, resetsAt, retryAfterSeconds } = readWorkerBody(failure);

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
  setHostedSignal(HOSTED_KINDS[error.hostedKind].signal);
}
