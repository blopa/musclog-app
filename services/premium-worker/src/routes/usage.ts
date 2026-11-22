import { renewedLivePeriod } from '../billing/periods';
import type { Ctx } from '../context';
import { usedPct } from '../finance';
import {
  countActiveDevices,
  isExhausted,
  logged,
  requireActiveDevice,
  requireSession,
} from '../identity/devices';
import { ApiError, isoTime, jsonResponse } from '../http';
import { findLivePeriod, type PeriodRow } from '../ledger';

/** GET /v1/usage: a percentage and a status, never money. */
export async function handleUsage(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/usage', async (setLineage) => {
    const now = ctx.deps.now();
    const claims = await requireSession(request, ctx, now);

    const device = await requireActiveDevice(ctx.env.DB, claims.rc);
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
    const renewed = await renewedLivePeriod(ctx, claims.rc, device.lineage_key, now);
    if (renewed) return respondLive(renewed);
    throw new ApiError(403, 'subscription_required');
  });
}
