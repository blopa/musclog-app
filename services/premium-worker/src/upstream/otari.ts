// Otari client (an OpenAI-compatible gateway). The key is only ever placed in the Authorization
// header, never logged. Parsing is defensive: a missing or odd field is a thrown error, never a guess.
import type { OtariBudget, OtariClient, OtariUsageSummary } from './types';

const GET_TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function createOtariClient(o: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}): OtariClient {
  const doFetch = o.fetch ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');

  async function getJson(path: string): Promise<unknown> {
    const res = await doFetch(`${base}${path}`, {
      method: 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${o.apiKey}` },
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`otari_http_${res.status}`);
    }
    return res.json();
  }

  return {
    chatCompletions(body, init) {
      return doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${o.apiKey}`,
          'content-type': 'application/json',
        },
        body,
        signal: init.signal,
      });
    },
    async usageSummary(startMs, endMs): Promise<OtariUsageSummary> {
      const start = Math.floor(startMs / 1000);
      const end = Math.ceil(endMs / 1000);
      const body = await getJson(
        `/key/usage/summary?start_date=${start}&end_date=${end}&dimensions=none`
      );
      const t = isObj(body) && isObj(body.totals) ? body.totals : null;
      const costUsd = t ? num(t.cost) : null;
      if (!t || costUsd === null || costUsd < 0) throw new Error('otari_bad_usage_response');
      return {
        costUsd,
        requests: num(t.request_count) ?? 0,
        errors: num(t.error_count) ?? 0,
        unpriced: num(t.unpriced_requests) ?? 0,
      };
    },
    async budget(): Promise<OtariBudget> {
      const body = await getJson('/key/budget');
      if (!isObj(body) || typeof body.budgets_enforced !== 'boolean') {
        throw new Error('otari_bad_budget_response');
      }
      return { enforced: body.budgets_enforced, remainingUsd: num(body.remaining_usd) };
    },
  };
}
