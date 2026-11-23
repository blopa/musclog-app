// Interfaces of the two upstreams. Production uses the HTTP clients in this folder; every test
// injects a fake (test/fakes/), so no test reaches the network.

// ---------- RevenueCat API v2 (fields per plan 3 / spikes/premium-p0/revenuecat; [A, G2]) ----------

export interface RcSubscription {
  id: string;
  customer_id: string;
  original_customer_id: string | null;
  /** RevenueCat product id; null for promotional grants. */
  product_id: string | null;
  gives_access: boolean;
  status: string;
  /** app_store | play_store | stripe | promotional | test_store | ... */
  store: string;
  /** production | sandbox */
  environment: string;
  /** purchased | family_shared */
  ownership: string;
  starts_at: number | null;
  current_period_starts_at: number | null;
  current_period_ends_at: number | null;
}

export interface RcRevenueUsd {
  gross: number | null;
  commission: number | null;
  tax: number | null;
  proceeds: number | null;
}

export interface RcTransaction {
  /** "The ID of the subscription transaction in the store": the payment_key source. */
  id: string;
  purchased_at: number;
  expiration_date: number | null;
  revenue_in_usd: RcRevenueUsd | null;
}

export interface RevenueCatClient {
  /** GET /projects/{p}/customers/{c}/subscriptions (all pages). [] when the customer is unknown. */
  listCustomerSubscriptions(customerId: string): Promise<RcSubscription[]>;
  /** GET /projects/{p}/subscriptions/{id}. null on 404. */
  getSubscription(subscriptionId: string): Promise<RcSubscription | null>;
  /** GET /projects/{p}/subscriptions/{id}/transactions (all pages). */
  listTransactions(subscriptionId: string): Promise<RcTransaction[]>;
}

/** RevenueCat unreachable, 429 or 5xx: the caller fails closed (503 entitlement_unavailable). */
export class RevenueCatUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super('revenuecat_unavailable');
  }
}

// ---------- OpenRouter ----------

export interface ZdrEndpoint {
  model_id: string;
  provider_name: string;
  tag: string;
  /** USD per token, as strings or numbers. */
  pricing: {
    prompt?: string | number | null;
    completion?: string | number | null;
    image?: string | number | null;
  };
  supported_parameters?: string[] | null;
  status: number;
  safety_retention: boolean;
}

export interface OpenRouterKeyInfo {
  /** Cumulative credit usage of the key in USD (the reconciliation source). */
  usage: number;
  usage_daily?: number | null;
  limit: number | null;
  limit_remaining: number | null;
}

export interface OpenRouterClient {
  /** POST /chat/completions with the already-allowlisted body. Returns the raw upstream response. */
  chatCompletions(body: string, init: { signal: AbortSignal }): Promise<Response>;
  /** GET /generation?id= ; null while the generation is not available yet. Cost in USD. */
  getGeneration(id: string): Promise<{ total_cost: number } | null>;
  /** GET /key (with the inference key). */
  getKey(): Promise<OpenRouterKeyInfo>;
  /** GET /endpoints/zdr (public, unauthenticated). */
  listZdrEndpoints(): Promise<ZdrEndpoint[]>;
}

// ---------- Otari (Mozilla AI's OpenAI-compatible gateway) ----------

/** The two gateways Iron chat requests can go through; the D1 `meta` row `upstream` picks one. */
export type UpstreamName = 'openrouter' | 'otari';

export interface OtariUsageSummary {
  /** Spend of the key in the window, USD (its `totals.cost`). */
  costUsd: number;
  requests: number;
  errors: number;
  /** Requests Otari could not price: their cost is missing from `costUsd`. */
  unpriced: number;
}

export interface OtariBudget {
  /** `budgets_enforced`: false when no limit applies to the key. */
  enforced: boolean;
  /** USD left on the tightest limit, null when there is none. */
  remainingUsd: number | null;
}

export interface OtariClient {
  /** POST /chat/completions with the already-built Otari body. Returns the raw upstream response. */
  chatCompletions(body: string, init: { signal: AbortSignal }): Promise<Response>;
  /** GET /key/usage/summary for [startMs, endMs) (sent as epoch seconds), no dimensions. */
  usageSummary(startMs: number, endMs: number): Promise<OtariUsageSummary>;
  /** GET /key/budget. */
  budget(): Promise<OtariBudget>;
}
