// Otari client (an OpenAI-compatible gateway). The key is only ever placed in the Authorization
// header, never logged. Parsing is defensive: a missing or odd field is a thrown error, never a guess.
import { createUpstreamHttp, isObj, num } from './http';
import type { OtariBudget, OtariClient, OtariUsageSummary } from './types';

export function createOtariClient(o: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}): OtariClient {
  const http = createUpstreamHttp({ name: 'otari', ...o });

  return {
    chatCompletions: http.chatCompletions,
    async usageSummary(startMs, endMs): Promise<OtariUsageSummary> {
      const start = Math.floor(startMs / 1000);
      const end = Math.ceil(endMs / 1000);
      const body = await http.getJson(
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
      const body = await http.getJson('/key/budget');
      if (!isObj(body) || typeof body.budgets_enforced !== 'boolean') {
        throw new Error('otari_bad_budget_response');
      }
      return { enforced: body.budgets_enforced, remainingUsd: num(body.remaining_usd) };
    },
  };
}
