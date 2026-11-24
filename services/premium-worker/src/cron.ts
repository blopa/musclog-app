// Scheduled jobs (plan 8.3, 7, 4). Every step is isolated: a failure is logged and never skips
// the others. Logs carry LogEvent fields only (no content, keys or rc_ids).
import { openBreaker, type BreakerReason } from './breaker';
import type { Ctx } from './context';
import { dayKey } from './db';
import { DAY_MS } from './finance';
import { prune, sweep, updateDailyFull } from './ledger';
import { selectGateway } from './upstream/select';
import type { UpstreamName, ZdrEndpoint } from './upstream/types';

const ZDR_ATTEMPTS = 3;
/**
 * Maximum age to hold an incomplete baseline for unpriced Otari requests before advancing:
 * gives a delayed pricing pass one full daily cycle to settle without wedging reconciliation forever.
 */
const MAX_UNPRICED_HOLD_MS = 2 * DAY_MS;

async function step(ctx: Ctx, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    ctx.deps.log.log({ route: 'cron', status: 500, code: `${name}_failed`, severity: 'error' });
  }
}

async function open(
  ctx: Ctx,
  reason: BreakerReason,
  code: string,
  upstream?: UpstreamName
): Promise<void> {
  await openBreaker(ctx.env.DB, reason);
  ctx.deps.log.log({ route: 'cron', status: 503, code, severity: 'high', upstream });
}

/** Below this many USD left on the Otari key's budget, the daily cron warns. */
const OTARI_BUDGET_LOW_USD = 2;

const permille = (x: number) => Math.round(x * 1000);

export async function runQuarterHourly(ctx: Ctx): Promise<void> {
  const db = ctx.env.DB;
  const now = ctx.deps.now();
  const day = dayKey(now);

  await step(ctx, 'sweep', async () => {
    await sweep(db, now, day);
  });
  await Promise.all([
    step(ctx, 'daily_full', async () => {
      await updateDailyFull(db, now, day, ctx.config.limits.global_max_requests_per_day);
    }),
    step(ctx, 'global_spend', async () => {
      const t = await db
        .prepare(
          `SELECT COALESCE(SUM(spent_u + reserved_u), 0) AS used,
                  COALESCE(SUM(CASE WHEN status = 'active' THEN net_proceeds_u ELSE 0 END), 0) AS net
           FROM periods WHERE period_end > ?1`
        )
        .bind(now - DAY_MS)
        .first<{ used: number; net: number }>();
      const f = ctx.config.finance;
      if (t && t.used * permille(f.openrouter_fee) > permille(f.global_share) * t.net) {
        await open(ctx, 'global_spend', 'global_spend_exceeded');
      }
    }),
  ]);
  ctx.deps.log.log({ route: 'cron', status: 200, code: 'quarter_hourly' });
}

const priceUsdPerToken = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function isEligible(e: ZdrEndpoint, config: Ctx['config']): boolean {
  if (e.model_id !== config.model) return false;
  if (e.safety_retention !== false || e.status !== 0) return false;
  if (!e.supported_parameters?.includes('structured_outputs')) return false;
  const prompt = priceUsdPerToken(e.pricing?.prompt);
  const completion = priceUsdPerToken(e.pricing?.completion);
  if (prompt === null || completion === null) return false;
  if (prompt * 1e6 > config.prices.prompt_per_mtok + 1e-9) return false;
  if (completion * 1e6 > config.prices.completion_per_mtok + 1e-9) return false;
  const only = config.provider.only;
  if (only && only.length > 0 && !only.includes(e.tag) && !only.includes(e.provider_name)) {
    return false;
  }
  return true;
}

async function zdrRecheck(ctx: Ctx): Promise<void> {
  let endpoints: ZdrEndpoint[] | null = null;
  for (let attempt = 1; attempt <= ZDR_ATTEMPTS; attempt++) {
    try {
      endpoints = await ctx.deps.openrouter.listZdrEndpoints();
      break;
    } catch {
      if (attempt < ZDR_ATTEMPTS) await ctx.deps.sleep(2000 * attempt);
    }
  }
  if (endpoints === null) {
    await open(ctx, 'zdr_check_failed', 'zdr_check_failed', 'openrouter');
    return;
  }
  if (!endpoints.some((e) => isEligible(e, ctx.config))) {
    await open(ctx, 'zdr_unavailable', 'zdr_unavailable', 'openrouter');
  }
}

async function reconcile(ctx: Ctx, now: number): Promise<void> {
  const db = ctx.env.DB;
  const store = (at: number) =>
    db
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('recon', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .bind(JSON.stringify({ usage_u, at }))
      .run();

  // a getKey failure propagates: baseline untouched
  const [key, stored] = await Promise.all([
    ctx.deps.openrouter.getKey(),
    db.prepare("SELECT value FROM meta WHERE key = 'recon'").first<{ value: string }>(),
  ]);
  const usage_u = Math.round(key.usage * 1e6);

  let prev: { usage_u: number; at: number } | null = null;
  if (stored) {
    try {
      const j = JSON.parse(stored.value) as { usage_u?: unknown; at?: unknown };
      if (typeof j.usage_u === 'number' && typeof j.at === 'number') {
        prev = { usage_u: j.usage_u, at: j.at };
      }
    } catch {
      prev = null;
    }
  }
  if (!prev) {
    await store(now);
    return;
  }

  const rawOrDelta = usage_u - prev.usage_u;
  const keyReset = rawOrDelta < 0;
  if (keyReset) {
    ctx.deps.log.log({
      route: 'cron',
      status: 500,
      code: 'reconciliation_key_reset',
      severity: 'high',
    });
  }
  const orDelta = keyReset ? 0 : rawOrDelta;

  // Spend through Otari and ledger since the baseline in parallel. Hold the baseline for one
  // extra day on unpriced requests so delayed pricing can settle, then advance to avoid wedging.
  let otari_u = 0;
  let otariAvailable = true;
  let unpriced = false;
  const fetchOtari = async () => {
    if (!ctx.deps.otari) return;
    try {
      const summary = await ctx.deps.otari.usageSummary(prev.at, now);
      otari_u = Math.round(summary.costUsd * 1e6);
      if (summary.unpriced > 0) {
        unpriced = true;
        ctx.deps.log.log({
          route: 'cron',
          status: 500,
          code: 'otari_unpriced_requests',
          severity: 'high',
          upstream: 'otari',
        });
      }
    } catch {
      otariAvailable = false;
      ctx.deps.log.log({
        route: 'cron',
        status: 500,
        code: 'reconciliation_otari_unavailable',
        severity: 'high',
        upstream: 'otari',
      });
    }
  };
  const [, ledger] = await Promise.all([
    fetchOtari(),
    db
      .prepare(
        `SELECT COALESCE(SUM(settled_u), 0) AS u FROM reservations
         WHERE state IN ('settled','expired') AND settled_at > ?1 AND settled_at <= ?2`
      )
      .bind(prev.at, now)
      .first<{ u: number }>(),
  ]);

  const delta = orDelta + otari_u;
  const ledger_u = ledger?.u ?? 0;
  const tol = ctx.config.reconciliation;
  if (delta - ledger_u > tol.tolerance_share * ledger_u + tol.tolerance_u) {
    await open(ctx, 'reconciliation', 'reconciliation_gap');
  }

  const advanceAt = otariAvailable && (!unpriced || now - prev.at >= MAX_UNPRICED_HOLD_MS);
  if (advanceAt) {
    await store(now);
  } else if (keyReset) {
    // Record the new OpenRouter key usage immediately while preserving prev.at for Otari retry.
    await store(prev.at);
  }
}

export async function runDaily(ctx: Ctx): Promise<void> {
  const db = ctx.env.DB;
  const now = ctx.deps.now();

  await Promise.all([
    step(ctx, 'accepting_new', async () => {
      await db
        .prepare(
          `INSERT INTO meta (key, value)
           SELECT 'accepting_new', CASE WHEN COUNT(DISTINCT lineage_key) >= ?1 THEN '0' ELSE '1' END
           FROM periods WHERE status = 'active' AND period_start <= ?2 AND ?2 < period_end
           ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`
        )
        .bind(ctx.config.limits.max_subscribers, now)
        .run();
    }),
    // The ZDR list is OpenRouter's: it says nothing about an Otari-served request, whose data
    // recipient is pinned by the selector instead (assertOtariPinned, the Otari-Provider check).
    step(ctx, 'zdr_recheck', async () => {
      if ((await selectGateway(ctx)).shouldRecheckZdr) await zdrRecheck(ctx);
    }),
    step(ctx, 'reconciliation', () => reconcile(ctx, now)),
    step(ctx, 'otari_budget', async () => {
      if (!ctx.deps.otari) return;
      const b = await ctx.deps.otari.budget();
      if (b.remainingUsd !== null && b.remainingUsd < OTARI_BUDGET_LOW_USD) {
        ctx.deps.log.log({
          route: 'cron',
          status: 500,
          code: 'otari_budget_low',
          severity: 'high',
          upstream: 'otari',
        });
      }
    }),
  ]);
  await step(ctx, 'prune', async () => {
    await prune(db, now);
  });
  ctx.deps.log.log({ route: 'cron', status: 200, code: 'daily' });
}
