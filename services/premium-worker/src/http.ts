// Error envelope and response helpers (plan section 10). Upstream bodies are never echoed.
// 402, 403 and 409 carry `x-should-retry: false` so the OpenAI SDK does not retry them.

export type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'id_key_mismatch'
  | 'bad_signature'
  | 'stale_nonce'
  | 'unknown_device'
  | 'budget_exhausted'
  | 'daily_limit'
  | 'subscription_required'
  | 'revenue_unverified'
  | 'in_progress'
  | 'already_processed'
  | 'body_too_large'
  | 'idempotency_mismatch'
  | 'busy'
  | 'upstream_error'
  | 'hosted_disabled'
  | 'daily_full'
  | 'entitlement_unavailable'
  | 'identity_conflict'
  | 'upstream_timeout'
  | 'consent_required'
  | 'not_found'
  | 'method_not_allowed';

const MESSAGES: Record<ErrorCode, string> = {
  invalid_request: 'The request is not valid.',
  unauthorized: 'Missing or invalid session token.',
  id_key_mismatch: 'The id does not match the public key.',
  bad_signature: 'The signature is not valid.',
  stale_nonce: 'The nonce is expired or already used.',
  unknown_device: 'This device is not enrolled in the subscription.',
  budget_exhausted: "This period's allowance is used up.",
  daily_limit: "Today's limit is reached.",
  subscription_required: 'No qualifying subscription.',
  revenue_unverified: 'The payment is not verified yet.',
  in_progress: 'This request is already in progress.',
  already_processed: 'This request was already processed.',
  body_too_large: 'The request body is too large.',
  idempotency_mismatch: 'The Idempotency-Key was used with another body.',
  busy: 'Too many requests in flight.',
  upstream_error: 'The AI provider failed.',
  hosted_disabled: 'Hosted AI is temporarily unavailable.',
  daily_full: 'Hosted AI is at capacity until tomorrow (UTC).',
  entitlement_unavailable: 'The subscription could not be checked.',
  identity_conflict: 'The subscription could not be matched safely.',
  upstream_timeout: 'The AI provider timed out.',
  consent_required: 'Review the updated Musclog Iron consent to continue.',
  not_found: 'Not found.',
  method_not_allowed: 'Method not allowed.',
};

/** Every code the Worker can answer, for tests that check the contract with the app. */
export const ERROR_CODES = Object.keys(MESSAGES) as ErrorCode[];

export interface ErrorExtra {
  /** Seconds; also sent as the Retry-After header. */
  retry_after?: number;
  /** ISO 8601. */
  resets_at?: string;
  /** Field path for 400s (never the field's content). */
  path?: string;
  used_pct?: number;
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  extra: ErrorExtra = {},
  headers: Record<string, string> = {}
): Response {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  if (status === 402 || status === 403 || status === 409) h.set('x-should-retry', 'false');
  if (extra.retry_after !== undefined) h.set('retry-after', String(extra.retry_after));
  return new Response(JSON.stringify({ error: { code, message: MESSAGES[code], ...extra } }), {
    status,
    headers: h,
  });
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

/** Thrown inside handlers; the router turns it into errorResponse. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly extra: ErrorExtra = {}
  ) {
    super(code);
  }
}

/**
 * Reads a body with a hard byte cap, before any D1 work (plan section 4). Rejects on
 * Content-Length first, then counts streamed bytes so a lying header cannot get past it.
 */
export async function readBodyCapped(
  request: Request,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get('content-length') ?? 'NaN');
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, 'body_too_large');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, 'body_too_large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

export const isoTime = (ms: number) => new Date(ms).toISOString();
