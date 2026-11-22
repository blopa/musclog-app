// POST /v1/session (plan 6.1): a signed nonce for a minted token. One D1 write per mint.
import { reverifySubscription } from '../billing/periods';
import type { Ctx } from '../context';
import { importPublicKey, verifyDeviceSignature } from '../identity/crypto';
import {
  countActiveDevices,
  deviceKeyBytes,
  ENTITLEMENT_CACHE_MS,
  ENTITLEMENT_STALE_DENY_MS,
  getDevice,
  latestPeriod,
  logged,
  readFields,
  tokenResponse,
} from '../identity/devices';
import { verifyNonce } from '../identity/nonce';
import { fromB64url } from '../identity/token';
import { ApiError } from '../http';
import { enforceRateLimit, limiterAddress } from '../limiter';
import { findLivePeriod } from '../ledger';
import { RevenueCatUnavailableError } from '../upstream/types';

export async function handleSession(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/session', async (setLineage) => {
    await enforceRateLimit(ctx, 'session:' + limiterAddress(request, ctx), 10);
    const body = await readFields(request, ['rc_id', 'nonce', 'signature']);
    await enforceRateLimit(ctx, 'session-id:' + body.rc_id, 10);
    const db = ctx.env.DB;

    const device = await getDevice(db, body.rc_id);
    if (!device || device.status !== 'active') throw new ApiError(401, 'unknown_device');
    setLineage(device.lineage_key);

    const ts = await verifyNonce(ctx, body.nonce);
    if (ts === null || ts <= device.last_nonce_ts) throw new ApiError(401, 'stale_nonce');

    const key = await importPublicKey(deviceKeyBytes(device));
    const signed =
      key !== null &&
      (await verifyDeviceSignature({
        key,
        purpose: 'session',
        rcId: body.rc_id,
        nonce: body.nonce,
        signature: fromB64url(body.signature),
      }));
    if (!signed) throw new ApiError(401, 'bad_signature');

    // Entitlement cache: re-verify when older than 6 h; deny on an unreachable RevenueCat only
    // once the cache is older than 24 h. Ownership of the subscription is not checked here.
    const now = ctx.deps.now();
    let verifiedAt = device.verified_at;
    let reverified = false;
    const reverify = async (): Promise<'active' | 'lapsed' | 'unavailable'> => {
      const latest = await latestPeriod(db, device.lineage_key);
      if (!latest) return 'lapsed';
      try {
        const r = await reverifySubscription(ctx, latest.rc_subscription_id, now);
        reverified = true;
        return r.status;
      } catch (e) {
        if (e instanceof RevenueCatUnavailableError) return 'unavailable';
        throw e;
      }
    };
    if (now - device.verified_at > ENTITLEMENT_CACHE_MS) {
      const r = await reverify();
      if (r === 'lapsed') throw new ApiError(403, 'subscription_required');
      if (r === 'unavailable') {
        if (now - device.verified_at > ENTITLEMENT_STALE_DENY_MS) {
          throw new ApiError(503, 'entitlement_unavailable');
        }
      } else {
        verifiedAt = now;
      }
    }

    // Single use, also under concurrency: only a nonce newer than last_nonce_ts claims the row.
    const claimed = await db
      .prepare(
        `UPDATE devices SET last_nonce_ts = ?1, verified_at = ?2
         WHERE rc_id = ?3 AND status = 'active' AND last_nonce_ts < ?1`
      )
      .bind(ts, verifiedAt, body.rc_id)
      .run();
    if (claimed.meta.changes === 0) throw new ApiError(401, 'stale_nonce');

    let period = await findLivePeriod(db, body.rc_id, now);
    if (!period && !reverified) {
      // A renewal: the next period does not exist until RevenueCat is asked.
      const r = await reverify();
      if (r === 'unavailable') throw new ApiError(503, 'entitlement_unavailable');
      if (r === 'active') period = await findLivePeriod(db, body.rc_id, now);
    }
    if (!period) throw new ApiError(403, 'subscription_required');
    return tokenResponse(
      ctx,
      body.rc_id,
      period,
      await countActiveDevices(db, device.lineage_key),
      now
    );
  });
}
