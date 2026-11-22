import type { Ctx } from '../context';
import { reverifySubscription } from '../billing/periods';
import {
  countActiveDevices,
  getDevice,
  isExhausted,
  latestPeriod,
  logged,
  usedPct,
} from '../identity/devices';
import { bearerToken, verifySessionToken } from '../identity/token';
import { ApiError, isoTime, jsonResponse } from '../http';
import { findLivePeriod, type PeriodRow } from '../ledger';
import { RevenueCatUnavailableError } from '../upstream/types';

/** GET /v1/usage: a percentage and a status, never money. */
export async function handleUsage(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/usage', async (setLineage) => {
    const now = ctx.deps.now();
    const token = bearerToken(request);
    const claims = token
      ? await verifySessionToken(
          [ctx.env.SESSION_HMAC_KEY, ctx.env.SESSION_HMAC_KEY_PREVIOUS],
          token,
          now
        )
      : null;
    if (!claims) throw new ApiError(401, 'unauthorized');

    const device = await getDevice(ctx.env.DB, claims.rc);
    if (!device || device.status !== 'active') throw new ApiError(401, 'unknown_device');
    setLineage(device.lineage_key);
    const devices = {
      count: await countActiveDevices(ctx.env.DB, device.lineage_key),
      max: ctx.config.limits.max_devices,
    };

    const respondLive = (live: PeriodRow) =>
      jsonResponse({
        used_pct: usedPct(live, now),
        resets_at: isoTime(live.period_end),
        status: isExhausted(live, now) ? 'exhausted' : 'active',
        devices,
      });

    const live = await findLivePeriod(ctx.env.DB, claims.rc, now);
    if (live) return respondLive(live);
    const covering = await ctx.env.DB.prepare(
      `SELECT * FROM periods WHERE lineage_key = ?1 AND period_start <= ?2 AND ?2 < period_end
       ORDER BY period_start DESC LIMIT 1`
    )
      .bind(device.lineage_key, now)
      .first<PeriodRow>();
    if (covering?.status === 'revoked') {
      return jsonResponse({
        status: 'revoked',
        used_pct: 100,
        resets_at: isoTime(covering.period_end),
        devices,
      });
    }
    // A renewal: the next period does not exist until RevenueCat is asked, which is what chat and
    // session do too. Without this the usage line stayed empty until the next message.
    const latest = await latestPeriod(ctx.env.DB, device.lineage_key);
    if (latest) {
      try {
        const verified = await reverifySubscription(ctx, latest.rc_subscription_id, now);
        if (verified.status === 'active') {
          const renewed = await findLivePeriod(ctx.env.DB, claims.rc, now);
          if (renewed) return respondLive(renewed);
        }
      } catch (e) {
        if (e instanceof RevenueCatUnavailableError) {
          throw new ApiError(503, 'entitlement_unavailable');
        }
        throw e;
      }
    }
    throw new ApiError(403, 'subscription_required');
  });
}
