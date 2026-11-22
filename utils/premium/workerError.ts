// What the app knows about the Premium Worker's error envelope, in one place: the codes it reacts
// to and the one reader of the body. Relative imports only (the Worker's tests load this file too);
// `services/premium-worker/test/errorContract.test.ts` fails when a code here is not a Worker code.
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths -- the Worker's Vitest run cannot resolve the `@/` alias, so this file must stay relative.
import { isRecord } from '../isRecord';

/** Codes of the identity routes (`/v1/enroll`, `/v1/session`, `/v1/usage`) the app tells apart. */
export const IDENTITY_ERROR_CODES = [
  'subscription_required',
  'revenue_unverified',
  'id_key_mismatch',
  'bad_signature',
  'stale_nonce',
  'unknown_device',
  'identity_conflict',
  'entitlement_unavailable',
  'unauthorized',
  'invalid_request',
] as const;

/** Codes of `/v1/chat/completions` the app tells apart (read by `hostedAiError.ts`). */
export const CHAT_ERROR_CODES = [
  'budget_exhausted',
  'daily_limit',
  'daily_full',
  'in_progress',
  'already_processed',
  'hosted_disabled',
] as const;

/** Every Worker error code the app reacts to. */
export const WORKER_ERROR_CODES = [...IDENTITY_ERROR_CODES, ...CHAT_ERROR_CODES] as const;

export type WorkerErrorCode = (typeof WORKER_ERROR_CODES)[number];

/** The fields of a Worker error body the app reads: `{ error: { code, retry_after?, resets_at? } }`. */
export type WorkerError = {
  /** The Worker's code, or `''` when the body carries none. */
  code: string;
  resetsAt?: string;
  retryAfterSeconds?: number;
};

/** A non-negative number of seconds from a number or numeric string, else `undefined`. */
export function numericSeconds(value: unknown): number | undefined {
  const seconds = typeof value === 'number' ? value : Number(value);

  return value !== undefined && value !== null && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : undefined;
}

/**
 * Reads a Worker error body. Takes the whole envelope (`{ error: {...} }`) or the inner object (the
 * OpenAI SDK keeps the parsed body on its failure's `error`, which may be either); anything else
 * yields an empty code. Never reads the Worker's message text.
 */
export function parseWorkerError(value: unknown): WorkerError {
  const outer = isRecord(value) ? value : {};
  const inner = isRecord(outer.error) ? outer.error : outer;

  return {
    code: typeof inner.code === 'string' ? inner.code : '',
    resetsAt: typeof inner.resets_at === 'string' ? inner.resets_at : undefined,
    retryAfterSeconds: numericSeconds(inner.retry_after),
  };
}
