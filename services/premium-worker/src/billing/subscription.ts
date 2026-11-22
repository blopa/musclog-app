// Pure subscription rules (plan 6.1 enroll filters, 6.2 covering transaction, 13 rows 1 and 3).
import type { AiConfig } from '../config';
import type { RcSubscription, RcTransaction } from '../upstream/types';
import { sha256HexOfText } from '../identity/crypto';

export function qualifies(
  sub: RcSubscription,
  o: { rcId?: string; config: AiConfig; checkCustomer: boolean }
): boolean {
  const rc = o.config.revenuecat;
  if (sub.store !== 'app_store' && sub.store !== 'play_store') return false;
  if (!(rc.environments as string[]).includes(sub.environment)) return false;
  if (sub.ownership !== 'purchased') return false;
  if (sub.gives_access !== true) return false;
  if (sub.product_id === null || !rc.product_ids.includes(sub.product_id)) return false;
  if (o.checkCustomer && sub.customer_id !== o.rcId) return false;
  return true;
}

export type EnrollSelection =
  | { ok: true; sub: RcSubscription }
  | { ok: false; status: 403; code: 'subscription_required' }
  | { ok: false; status: 503; code: 'entitlement_unavailable' };

export function selectEnrollSubscription(
  subs: RcSubscription[],
  rcId: string,
  config: AiConfig
): EnrollSelection {
  const ok = subs.filter((s) => qualifies(s, { rcId, config, checkCustomer: true }));
  if (ok.length === 0) return { ok: false, status: 403, code: 'subscription_required' };
  if (ok.length > 1) return { ok: false, status: 503, code: 'entitlement_unavailable' };
  return { ok: true, sub: ok[0]! };
}

/** The transaction covering `now` (purchased_at <= now < expiration + grace); latest purchase wins. */
export function coveringTransaction(
  txs: RcTransaction[],
  now: number,
  graceMs: number
): RcTransaction | null {
  let best: RcTransaction | null = null;
  for (const t of txs) {
    if (t.expiration_date === null) continue;
    if (!(t.purchased_at <= now && now < t.expiration_date + graceMs)) continue;
    if (!best || t.purchased_at > best.purchased_at) best = t;
  }
  return best;
}

/** True when `tx` has the earliest purchased_at of the list (ties: lowest id). */
export function isFirstTransaction(txs: RcTransaction[], tx: RcTransaction): boolean {
  return txs.every(
    (o) => o.purchased_at > tx.purchased_at || (o.purchased_at === tx.purchased_at && o.id >= tx.id)
  );
}

export const paymentKey = (store: string, txId: string) => sha256HexOfText(`${store}:${txId}`);
export const lineageKey = (store: string, subId: string) => sha256HexOfText(`${store}:${subId}`);
