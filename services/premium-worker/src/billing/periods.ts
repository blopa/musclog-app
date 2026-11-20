// Period creation from the transaction covering now (plan 6.2, 8.1). One payment = one budget.
import type { Store } from '../config';
import type { Ctx } from '../context';
import { stmt } from '../db';
import { computePeriodCaps } from '../finance';
import { ApiError } from '../http';
import { lineagePrefix } from '../log';
import type { RcSubscription, RcTransaction } from '../upstream/types';
import {
  coveringTransaction,
  isFirstTransaction,
  lineageKey as makeLineageKey,
  paymentKey as makePaymentKey,
  qualifies,
} from './subscription';

export interface PreparedPeriod {
  paymentKey: string;
  lineageKey: string;
  row: {
    payment_key: string;
    lineage_key: string;
    rc_subscription_id: string;
    store: Store;
    period_start: number;
    period_end: number;
    proceeds_u: number;
    net_proceeds_u: number;
    cap_u: number;
    early_cap_u: number;
    early_until: number;
    daily_cap_u: number;
    created_at: number;
  };
  statement: D1PreparedStatement;
}

const INSERT_SQL = `INSERT INTO periods (payment_key, lineage_key, rc_subscription_id, store, period_start, period_end, proceeds_u, net_proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u, created_at)
SELECT :pk, :lk, :sub, :store, :start, :end, :proceeds, :net, :cap, :early, :early_until, :daily, :now
WHERE NOT EXISTS (SELECT 1 FROM periods WHERE lineage_key = :lk AND payment_key != :pk AND status = 'active' AND MIN(period_end, :end) - MAX(period_start, :start) > 3600000)
ON CONFLICT(payment_key) DO NOTHING`;

export async function preparePeriod(
  ctx: Ctx,
  sub: RcSubscription,
  txs: RcTransaction[],
  now: number
): Promise<PreparedPeriod> {
  const store = sub.store as Store;
  const grace = ctx.config.revenuecat.grace_ms[store] ?? 0;
  const tx = coveringTransaction(txs, now, grace);
  if (!tx || tx.expiration_date === null) throw new ApiError(403, 'revenue_unverified');
  const res = computePeriodCaps(
    { proceedsUsd: tx.revenue_in_usd?.proceeds, grossUsd: tx.revenue_in_usd?.gross },
    ctx.config.finance,
    { purchasedAt: tx.purchased_at, isFirstPeriodOfLineage: isFirstTransaction(txs, tx) }
  );
  if (!res.ok) throw new ApiError(403, 'revenue_unverified');
  const { caps } = res;
  const [pk, lk] = await Promise.all([makePaymentKey(store, tx.id), makeLineageKey(store, sub.id)]);
  const row = {
    payment_key: pk,
    lineage_key: lk,
    rc_subscription_id: sub.id,
    store,
    period_start: tx.purchased_at,
    period_end: tx.expiration_date + grace,
    proceeds_u: caps.proceeds_u,
    net_proceeds_u: caps.net_proceeds_u,
    cap_u: caps.cap_u,
    early_cap_u: caps.early_cap_u,
    early_until: caps.early_until,
    daily_cap_u: caps.daily_cap_u,
    created_at: now,
  };
  const statement = stmt(ctx.env.DB, INSERT_SQL, {
    pk,
    lk,
    sub: sub.id,
    store,
    start: row.period_start,
    end: row.period_end,
    proceeds: row.proceeds_u,
    net: row.net_proceeds_u,
    cap: row.cap_u,
    early: row.early_cap_u,
    early_until: row.early_until,
    daily: row.daily_cap_u,
    now,
  });
  return { paymentKey: pk, lineageKey: lk, row, statement };
}

/** After the insert ran: the row must exist, else the duplicate guard refused it (503). */
export async function assertPeriodExists(
  ctx: Ctx,
  paymentKey: string,
  lineageKey: string
): Promise<void> {
  const r = await ctx.env.DB.prepare('SELECT 1 AS x FROM periods WHERE payment_key = ?')
    .bind(paymentKey)
    .first();
  if (r) return;
  ctx.deps.log.log({
    route: 'billing',
    status: 503,
    code: 'identity_conflict',
    severity: 'high',
    lineage_prefix: lineagePrefix(lineageKey),
  });
  throw new ApiError(503, 'identity_conflict');
}

export async function ensurePeriod(
  ctx: Ctx,
  sub: RcSubscription,
  txs: RcTransaction[],
  now: number
): Promise<{ paymentKey: string; lineageKey: string }> {
  const p = await preparePeriod(ctx, sub, txs, now);
  await p.statement.run();
  await assertPeriodExists(ctx, p.paymentKey, p.lineageKey);
  return { paymentKey: p.paymentKey, lineageKey: p.lineageKey };
}

export type ReverifyResult =
  | { status: 'lapsed' }
  | { status: 'active'; paymentKey: string; lineageKey: string; sub: RcSubscription };

/** Re-checks a subscription with RevenueCat; RevenueCatUnavailableError propagates. */
export async function reverifySubscription(
  ctx: Ctx,
  rcSubscriptionId: string,
  now: number
): Promise<ReverifyResult> {
  const sub = await ctx.deps.revenuecat.getSubscription(rcSubscriptionId);
  if (!sub || !qualifies(sub, { config: ctx.config, checkCustomer: false })) {
    if (!sub || sub.gives_access === false) {
      // The lineage is store:subscription id, so its periods are exactly those of this subscription.
      await ctx.env.DB.prepare(
        `UPDATE periods SET status = 'revoked' WHERE rc_subscription_id = ? AND status = 'active' AND ? < period_end`
      )
        .bind(rcSubscriptionId, now)
        .run();
    }
    return { status: 'lapsed' };
  }
  const txs = await ctx.deps.revenuecat.listTransactions(sub.id);
  const { paymentKey, lineageKey } = await ensurePeriod(ctx, sub, txs, now);
  return { status: 'active', paymentKey, lineageKey, sub };
}
