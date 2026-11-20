// The financial invariant (plan 8.1). Amounts are integer micro-USD.
//
//   net_proceeds_u = proceeds_u × (1 − estimate_haircut) × (1 − fx_haircut)
//                    − rc_fee_rate × gross_u × rc_fee_vat_factor − infra_per_period_u
//   spendable_u    = floor(net_proceeds_u × spend_share)          (OpenRouter cost, fee included)
//   cap_u          = min(floor(spendable_u / openrouter_fee), max_cap_u)   (model spend)
//   early_cap_u    = floor(cap_u × early_share)    for the first early_days of a lineage's first period
//   daily_cap_u    = floor(cap_u × daily_share)
//
// Shares and the fee are applied as integer permille, so `cap_u × 1055 ≤ net_proceeds_u × 500`
// (the schema CHECK) holds by construction for any spend_share ≤ 0.5 and fee ≥ 1.055: rounding
// can only lower the cap. early and daily caps are taken from the already-capped cap_u, so they
// never exceed it. Every deduction rounds against us (proceeds floored, fees ceiled).

import type { AiConfig } from './config';

export const DAY_MS = 86_400_000;
export const MICRO = 1_000_000;

export interface PeriodRevenue {
  /** RevenueCat SubscriptionTransaction.revenue_in_usd.proceeds (USD, after tax and commission). */
  proceedsUsd: number | null | undefined;
  /** RevenueCat SubscriptionTransaction.revenue_in_usd.gross (USD, excluding taxes). */
  grossUsd: number | null | undefined;
}

export interface PeriodCaps {
  proceeds_u: number;
  net_proceeds_u: number;
  cap_u: number;
  early_cap_u: number;
  daily_cap_u: number;
  early_until: number;
}

export type CapsResult = { ok: true; caps: PeriodCaps } | { ok: false; code: 'revenue_unverified' };

const validUsd = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

const permille = (share: number) => Math.round(share * 1000);

export function computePeriodCaps(
  revenue: PeriodRevenue,
  finance: AiConfig['finance'],
  opts: { purchasedAt: number; isFirstPeriodOfLineage: boolean }
): CapsResult {
  // Missing, null, zero or negative revenue: cap 0, which is refused (403 revenue_unverified).
  if (!validUsd(revenue.proceedsUsd) || !validUsd(revenue.grossUsd)) {
    return { ok: false, code: 'revenue_unverified' };
  }

  const proceeds_u = Math.floor(revenue.proceedsUsd * MICRO);
  const gross_u = Math.ceil(revenue.grossUsd * MICRO);
  const afterHaircuts = Math.floor(
    proceeds_u * (1 - finance.estimate_haircut) * (1 - finance.fx_haircut)
  );
  const rcFee = Math.ceil(finance.rc_fee_rate * gross_u * finance.rc_fee_vat_factor);
  const net_proceeds_u = afterHaircuts - rcFee - Math.ceil(finance.infra_per_period_u);
  if (proceeds_u <= 0 || net_proceeds_u <= 0) return { ok: false, code: 'revenue_unverified' };

  const spendable_u = Math.floor((net_proceeds_u * permille(finance.spend_share)) / 1000);
  const uncapped = Math.floor((spendable_u * 1000) / permille(finance.openrouter_fee));
  const cap_u = Math.min(uncapped, Math.floor(finance.max_cap_u));
  const early_cap_u = Math.floor((cap_u * permille(finance.early_share)) / 1000);
  const daily_cap_u = Math.floor((cap_u * permille(finance.daily_share)) / 1000);
  const early_until = opts.isFirstPeriodOfLineage
    ? opts.purchasedAt + finance.early_days * DAY_MS
    : 0;

  return {
    ok: true,
    caps: { proceeds_u, net_proceeds_u, cap_u, early_cap_u, daily_cap_u, early_until },
  };
}

/** The cap that applies at `now` (early window or full period). */
export function effectiveCap(
  p: { cap_u: number; early_cap_u: number; early_until: number },
  now: number
): number {
  return now < p.early_until ? p.early_cap_u : p.cap_u;
}
