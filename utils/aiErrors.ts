/**
 * The errors a user can act on, and the one place that decides which raw SDK failure is which.
 *
 * Gemini answers a wrong key with HTTP **400** (`INVALID_ARGUMENT`, reason `API_KEY_INVALID`), not
 * 401, so a status-only check misses it — and a rule of "every 400 is a key problem" would blame the
 * user for a malformed request. Hence the key signal is read from the message and error details,
 * and a bare 400 stays an ordinary error.
 */
import type { CoachAIProvider } from './coachAI';

export class AiInvalidKeyError extends Error {
  readonly provider: CoachAIProvider;

  constructor(provider: CoachAIProvider, message = 'The API key was rejected') {
    super(message);
    this.name = 'AiInvalidKeyError';
    this.provider = provider;
  }
}

/** The request did not finish in time. Retried once; a stalled request usually stays stalled. */
export class AiTimeoutError extends Error {
  constructor(message = 'The AI request timed out') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

/** The caller aborted the request (a Cancel button). Never an error worth reporting or retrying. */
export class AiCancelledError extends Error {
  constructor(message = 'The AI request was cancelled') {
    super(message);
    this.name = 'AiCancelledError';
  }
}

/** Providers where the user supplies the key. Gateway and on-device never become a key error. */
const USER_KEY_PROVIDERS: ReadonlySet<CoachAIProvider> = new Set(['gemini', 'openai']);

function statusOf(error: any): number | undefined {
  return error?.status ?? error?.response?.status ?? error?.error?.code ?? undefined;
}

function textOf(error: any): string {
  const parts: unknown[] = [error?.message, error?.error?.message, error?.error?.status];
  const details = error?.details ?? error?.error?.details;
  if (details) {
    try {
      parts.push(JSON.stringify(details));
    } catch {
      // A circular detail is not worth failing a classification over.
    }
  }

  return parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
}

const KEY_SIGNALS = ['api_key_invalid', 'api key not valid', 'api key expired', 'invalid api key'];
const PERMISSION_SIGNALS = ['api key', 'api_key', 'permission', 'unauthor', 'forbidden', 'denied'];

/** True when the provider rejected the credential itself. Deliberately narrow. */
export function isInvalidApiKeyError(error: unknown): boolean {
  if (error instanceof AiInvalidKeyError) {
    return true;
  }

  const e = error as any;
  const status = Number(statusOf(e));
  const code = String(e?.error?.code ?? e?.code ?? '').toLowerCase();
  const text = textOf(e);

  if (code === 'invalid_api_key') {
    return true;
  }

  if (status === 401) {
    return true;
  }

  if (status === 403) {
    return PERMISSION_SIGNALS.some((signal) => text.includes(signal));
  }

  if (status === 400) {
    return KEY_SIGNALS.some((signal) => text.includes(signal));
  }

  return false;
}

/** True for our own timeout and for what the SDKs throw when a request stalls. */
export function isAiTimeoutError(error: unknown): boolean {
  if (error instanceof AiTimeoutError) {
    return true;
  }

  const e = error as any;
  const name = String(e?.name ?? '');
  if (name === 'APIConnectionTimeoutError' || name === 'TimeoutError') {
    return true;
  }

  const message = String(e?.message ?? '').toLowerCase();
  return message.includes('request timed out') || message.includes('timed out');
}

/**
 * The single classification point for "the user can fix this": maps a raw failure to a typed error,
 * or `null` when it is something else (a bug, a rate limit, a dropped connection). Credit and rate
 * limit errors keep their own classes in `coachAI.ts`.
 */
export function toUserFacingAiError(
  error: unknown,
  provider: CoachAIProvider
): AiInvalidKeyError | AiTimeoutError | null {
  if (error instanceof AiInvalidKeyError || error instanceof AiTimeoutError) {
    return error;
  }

  if (USER_KEY_PROVIDERS.has(provider) && isInvalidApiKeyError(error)) {
    return new AiInvalidKeyError(provider);
  }

  if (isAiTimeoutError(error)) {
    return new AiTimeoutError();
  }

  return null;
}

/** Rethrows a typed, user-actionable error; returns for everything else so the caller carries on. */
export function rethrowUserFacingAiError(error: unknown): void {
  if (
    error instanceof AiInvalidKeyError ||
    error instanceof AiTimeoutError ||
    error instanceof AiCancelledError
  ) {
    throw error;
  }
}

const PROVIDER_LABELS: Record<CoachAIProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  local: 'Local',
  gateway: 'Musclog',
  'on-device': 'On-device',
};

/**
 * The sentence for a typed error, or `null` for anything else. Takes the translator so it stays
 * pure; the keys are literal so `npm run check-translations` sees them.
 */
export function describeAiError(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
): string | null {
  if (error instanceof AiInvalidKeyError) {
    return t('errors.aiInvalidApiKey', { provider: PROVIDER_LABELS[error.provider] });
  }

  if (error instanceof AiTimeoutError) {
    return t('errors.aiTimeout');
  }

  return null;
}

/** Providers for which the Cancel/timeout machinery and a key test make sense. */
export function providerUsesUserKey(provider: CoachAIProvider): boolean {
  return USER_KEY_PROVIDERS.has(provider);
}
