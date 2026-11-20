import type { Ctx } from '../context';
import { countActiveDevices, getDevice, isExhausted, logged, usedPct } from '../identity/devices';
import { bearerToken, verifySessionToken } from '../identity/token';
import { ApiError, isoTime, jsonResponse } from '../http';
import { findLivePeriod, type PeriodRow } from '../ledger';

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

    const live = await findLivePeriod(ctx.env.DB, claims.rc, now);
    if (live) {
      return jsonResponse({
        used_pct: usedPct(live, now),
        resets_at: isoTime(live.period_end),
        status: isExhausted(live, now) ? 'exhausted' : 'active',
        devices,
      });
    }
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
    throw new ApiError(403, 'subscription_required');
  });
}
