// Pure model of what the Premium Worker says (plan sections 6.1, 10, 11). No React Native, no
// storage: relative imports only, because the Worker's own tests load this file too.

import { isRecord } from '@/utils/isRecord';

/** Refresh the session token this long before it expires (plan 11 item 3). */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/** Worker error codes the app tells apart. Anything else is `unknown`. */
const KNOWN_CODES = [
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

export type PremiumFailureKind =
  (typeof KNOWN_CODES)[number] | 'unavailable' | 'network' | 'invalid_response' | 'unknown';

export type PremiumDevices = { count: number; max: number };

export type SessionGrant = {
  sessionToken: string;
  expiresAtMs: number;
  usedPct: number;
  resetsAt: string;
  devices: PremiumDevices;
};

export type UsageSnapshot = {
  usedPct: number;
  resetsAt: string;
  status: 'active' | 'exhausted' | 'revoked';
  devices: PremiumDevices;
};

export type HostedConfig = {
  enabled: boolean;
  acceptingNew: boolean;
  visionEnabled: boolean;
  image: { maxPx: number; maxBytes: number; quality: number } | null;
  minAppVersion: string | null;
};

export type PremiumStatus =
  'no_key' | 'not_enrolled' | 'active' | 'exhausted' | 'revoked' | 'removed';

/** Maps a Worker answer to one failure kind. Never carries a message from the server. */
export function failureKindOf(result: {
  status: number;
  errorCode: string | null;
}): PremiumFailureKind {
  if (result.errorCode === 'network' || result.status === 0) {
    return 'network';
  }

  const code = result.errorCode;

  if (code !== null && (KNOWN_CODES as readonly string[]).includes(code)) {
    return code as PremiumFailureKind;
  }

  return result.status >= 500 ? 'unavailable' : 'unknown';
}

/**
 * Failures worth retrying right after a purchase or restore: RevenueCat's v2 API may not show the
 * new subscription yet. Every other failure is final for that attempt.
 */
export function isEntitlementLag(kind: PremiumFailureKind): boolean {
  return kind === 'subscription_required' || kind === 'entitlement_unavailable';
}

function parseDevices(value: unknown): PremiumDevices | null {
  if (!isRecord(value)) {
    return null;
  }

  const { count, max } = value;

  if (
    typeof count !== 'number' ||
    typeof max !== 'number' ||
    !Number.isInteger(count) ||
    !Number.isInteger(max) ||
    count < 0 ||
    max < 1 ||
    count > max
  ) {
    return null;
  }

  return { count, max };
}

function parsePct(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

/** `/v1/enroll` and `/v1/session` share one response shape. */
export function parseSessionGrant(body: unknown): SessionGrant | null {
  if (!isRecord(body) || !isRecord(body.period)) {
    return null;
  }

  const token = body.session_token;
  const expiresAtMs = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
  const usedPct = parsePct(body.period.used_pct);
  const resetsAt = body.period.resets_at;
  const devices = parseDevices(body.devices);

  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    !Number.isFinite(expiresAtMs) ||
    usedPct === null ||
    typeof resetsAt !== 'string' ||
    !Number.isFinite(Date.parse(resetsAt)) ||
    devices === null
  ) {
    return null;
  }

  return { sessionToken: token, expiresAtMs, usedPct, resetsAt, devices };
}

export function parseUsage(body: unknown): UsageSnapshot | null {
  if (!isRecord(body)) {
    return null;
  }

  const status = body.status;
  const usedPct = parsePct(body.used_pct);
  const devices = parseDevices(body.devices);

  if (
    (status !== 'active' && status !== 'exhausted' && status !== 'revoked') ||
    usedPct === null ||
    typeof body.resets_at !== 'string' ||
    !Number.isFinite(Date.parse(body.resets_at)) ||
    devices === null
  ) {
    return null;
  }

  return { usedPct, resetsAt: body.resets_at, status, devices };
}

export function parseHostedConfig(body: unknown): HostedConfig | null {
  if (!isRecord(body) || typeof body.enabled !== 'boolean') {
    return null;
  }

  const image = body.image;
  const parsedImage =
    isRecord(image) &&
    typeof image.maxPx === 'number' &&
    typeof image.maxBytes === 'number' &&
    typeof image.quality === 'number'
      ? { maxPx: image.maxPx, maxBytes: image.maxBytes, quality: image.quality }
      : null;

  return {
    enabled: body.enabled,
    acceptingNew: body.accepting_new === true,
    visionEnabled: body.vision_enabled === true,
    image: parsedImage,
    minAppVersion: typeof body.minAppVersion === 'string' ? body.minAppVersion : null,
  };
}

export function tokenNeedsRefresh(
  expiresAtMs: number,
  nowMs: number,
  marginMs: number = TOKEN_REFRESH_MARGIN_MS
): boolean {
  return nowMs >= expiresAtMs - marginMs;
}

/** What the app shows. Status comes from the Worker's answers, never from local CustomerInfo. */
export function derivePremiumStatus(input: {
  hasKey: boolean;
  enrolledRcId: string | null;
  removed: boolean;
  lastStatus: 'active' | 'exhausted' | 'revoked' | null;
}): PremiumStatus {
  if (!input.hasKey) {
    return 'no_key';
  }

  if (input.removed) {
    return 'removed';
  }

  if (input.enrolledRcId === null) {
    return 'not_enrolled';
  }

  return input.lastStatus ?? 'active';
}

/** Failures the app-facing service adds to the Worker's: nothing here came from a server body. */
export type PremiumActionFailure =
  | PremiumFailureKind
  | 'not_available'
  | 'not_enrolled'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore_failed';

export type PremiumResult<T> =
  { ok: true; value: T } | { ok: false; failure: PremiumActionFailure };
