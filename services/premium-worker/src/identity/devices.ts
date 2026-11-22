// Shared by the identity routes: body parsing, device and period reads, the response shape and
// the one-line request log.
import type { Ctx } from '../context';
import { effectiveCap, usedPct } from '../finance';
import { ApiError, isoTime, jsonResponse, readBodyCapped } from '../http';
import type { PeriodRow } from '../ledger';
import { lineagePrefix } from '../log';
import { bearerToken, mintSessionToken, verifySessionToken, type SessionClaims } from './token';

export const IDENTITY_BODY_MAX = 4096;
export const ENTITLEMENT_CACHE_MS = 6 * 3_600_000;
export const ENTITLEMENT_STALE_DENY_MS = 24 * 3_600_000;

export interface DeviceRow {
  rc_id: string;
  public_key: ArrayBuffer | number[];
  lineage_key: string;
  status: 'active' | 'revoked';
  last_nonce_ts: number;
  verified_at: number;
  created_at: number;
}

/** A JSON object with exactly the listed string fields (each 1..2048 chars), else 400. */
export async function readFields<K extends string>(
  request: Request,
  fields: readonly K[]
): Promise<Record<K, string>> {
  const bytes = await readBodyCapped(request, IDENTITY_BODY_MAX);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, 'invalid_request', { path: '' });
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new ApiError(400, 'invalid_request', { path: '' });
  }
  const obj = json as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!(fields as readonly string[]).includes(k)) {
      throw new ApiError(400, 'invalid_request', { path: k.slice(0, 64) });
    }
  }
  for (const f of fields) {
    const v = obj[f];
    if (typeof v !== 'string' || v.length === 0 || v.length > 2048) {
      throw new ApiError(400, 'invalid_request', { path: f });
    }
  }
  return obj as Record<K, string>;
}

export function getDevice(db: D1Database, rcId: string): Promise<DeviceRow | null> {
  return db.prepare('SELECT * FROM devices WHERE rc_id = ?1').bind(rcId).first<DeviceRow>();
}

/** The bearer session token's claims, or 401 unauthorized. */
export async function requireSession(
  request: Request,
  ctx: Ctx,
  now: number
): Promise<SessionClaims> {
  const token = bearerToken(request);
  const claims = token
    ? await verifySessionToken(
        [ctx.env.SESSION_HMAC_KEY, ctx.env.SESSION_HMAC_KEY_PREVIOUS],
        token,
        now
      )
    : null;
  if (!claims) throw new ApiError(401, 'unauthorized');
  return claims;
}

/** The device when it is enrolled and active, else 401 unknown_device. */
export async function requireActiveDevice(db: D1Database, rcId: string): Promise<DeviceRow> {
  const device = await getDevice(db, rcId);
  if (!device || device.status !== 'active') throw new ApiError(401, 'unknown_device');
  return device;
}

export const deviceKeyBytes = (d: DeviceRow): Uint8Array<ArrayBuffer> =>
  new Uint8Array(d.public_key as ArrayBuffer | number[]);

export async function countActiveDevices(db: D1Database, lineageKey: string): Promise<number> {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM devices WHERE lineage_key = ?1 AND status = 'active'`)
    .bind(lineageKey)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** The lineage's most recent period (any status): its rc_subscription_id feeds re-verification. */
export function latestPeriod(db: D1Database, lineageKey: string): Promise<PeriodRow | null> {
  return db
    .prepare('SELECT * FROM periods WHERE lineage_key = ?1 ORDER BY period_start DESC LIMIT 1')
    .bind(lineageKey)
    .first<PeriodRow>();
}

export const isExhausted = (p: PeriodRow, now: number): boolean =>
  p.spent_u + p.reserved_u >= effectiveCap(p, now);

/** The enroll / session response. One token mint, no D1 write. */
export async function tokenResponse(
  ctx: Ctx,
  rcId: string,
  period: PeriodRow,
  deviceCount: number,
  now: number
): Promise<Response> {
  const { token, expiresAt } = await mintSessionToken(ctx.env.SESSION_HMAC_KEY, rcId, now);
  return jsonResponse({
    session_token: token,
    expires_at: isoTime(expiresAt),
    period: { used_pct: usedPct(period, now), resets_at: isoTime(period.period_end) },
    devices: { count: deviceCount, max: ctx.config.limits.max_devices },
  });
}

/** Runs a handler and writes one content-free log line (route, status, code, latency, lineage). */
export async function logged(
  ctx: Ctx,
  route: string,
  run: (setLineage: (lineageKey: string) => void) => Promise<Response>
): Promise<Response> {
  const start = ctx.deps.now();
  let lineage: string | undefined;
  const setLineage = (k: string) => {
    lineage = lineagePrefix(k);
  };
  try {
    const res = await run(setLineage);
    ctx.deps.log.log({
      route,
      status: res.status,
      latency_ms: ctx.deps.now() - start,
      lineage_prefix: lineage,
    });
    return res;
  } catch (e) {
    if (e instanceof ApiError) {
      ctx.deps.log.log({
        route,
        status: e.status,
        code: e.code,
        latency_ms: ctx.deps.now() - start,
        lineage_prefix: lineage,
      });
    }
    throw e;
  }
}
