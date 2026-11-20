// RevenueCat API v2 client (plan 3). Fails closed: anything but a clean 2xx (or a 404 where the
// resource simply does not exist) throws RevenueCatUnavailableError. The key is never logged.
import type { RcRevenueUsd, RcSubscription, RcTransaction, RevenueCatClient } from './types';
import { RevenueCatUnavailableError } from './types';

const TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseSubscription(v: unknown): RcSubscription | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  if (!id) return null;
  return {
    id,
    customer_id: str(v.customer_id) ?? '',
    original_customer_id: str(v.original_customer_id),
    product_id: str(v.product_id),
    gives_access: v.gives_access === true,
    status: str(v.status) ?? '',
    store: str(v.store) ?? '',
    environment: str(v.environment) ?? '',
    ownership: str(v.ownership) ?? '',
    starts_at: num(v.starts_at),
    current_period_starts_at: num(v.current_period_starts_at),
    current_period_ends_at: num(v.current_period_ends_at),
  };
}

function parseRevenue(v: unknown): RcRevenueUsd | null {
  if (!isObj(v)) return null;
  return {
    gross: num(v.gross),
    commission: num(v.commission),
    tax: num(v.tax),
    proceeds: num(v.proceeds),
  };
}

function parseTransaction(v: unknown): RcTransaction | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const purchased = num(v.purchased_at);
  if (!id || purchased === null) return null;
  return {
    id,
    purchased_at: purchased,
    expiration_date: num(v.expiration_date),
    revenue_in_usd: parseRevenue(v.revenue_in_usd),
  };
}

export function createRevenueCatClient(o: {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  fetch?: typeof fetch;
}): RevenueCatClient {
  const doFetch = o.fetch ?? fetch;
  const base = `${o.baseUrl.replace(/\/+$/, '')}/projects/${encodeURIComponent(o.projectId)}`;
  const origin = new URL(o.baseUrl).origin;

  /** One GET. Returns the parsed JSON, or null on 404. */
  async function get(url: string): Promise<unknown | null> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${o.apiKey}`, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new RevenueCatUnavailableError(null);
    }
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new RevenueCatUnavailableError(res.status);
    }
    try {
      return await res.json();
    } catch {
      throw new RevenueCatUnavailableError(res.status);
    }
  }

  async function list<T>(path: string, parse: (v: unknown) => T | null): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = `${base}${path}`;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await get(url!);
      if (body === null) {
        if (page === 0) return [];
        // A page vanishing mid-list would hide items (a second qualifying subscription): fail closed.
        throw new RevenueCatUnavailableError(404);
      }
      if (!isObj(body) || !Array.isArray(body.items)) throw new RevenueCatUnavailableError(null);
      for (const item of body.items) {
        const p = parse(item);
        if (p) out.push(p);
      }
      const next = str(body.next_page);
      if (!next) return out;
      url = /^https?:\/\//i.test(next)
        ? next
        : `${origin}${next.startsWith('/') ? '' : '/'}${next}`;
    }
    // More pages than we are willing to follow: fail closed rather than decide on a partial list.
    throw new RevenueCatUnavailableError(null);
  }

  return {
    listCustomerSubscriptions: (customerId) =>
      list(`/customers/${encodeURIComponent(customerId)}/subscriptions`, parseSubscription),
    async getSubscription(subscriptionId) {
      const body = await get(`${base}/subscriptions/${encodeURIComponent(subscriptionId)}`);
      return body === null ? null : parseSubscription(body);
    },
    listTransactions: (subscriptionId) =>
      list(`/subscriptions/${encodeURIComponent(subscriptionId)}/transactions`, parseTransaction),
  };
}
