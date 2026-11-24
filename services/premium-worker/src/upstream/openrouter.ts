// OpenRouter client. The key is only ever placed in the Authorization header, never logged.
import { createUpstreamHttp, isObj, num } from './http';
import type { OpenRouterClient, OpenRouterKeyInfo, ZdrEndpoint } from './types';

export function createOpenRouterClient(o: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}): OpenRouterClient {
  const http = createUpstreamHttp({ name: 'openrouter', ...o });

  return {
    chatCompletions: http.chatCompletions,
    async getGeneration(id) {
      const body = await http.getJson(`/generation?id=${encodeURIComponent(id)}`, {
        allow404: true,
      });
      if (!isObj(body) || !isObj(body.data)) return null;
      const cost = num(body.data.total_cost);
      return cost === null ? null : { total_cost: cost };
    },
    async getKey(): Promise<OpenRouterKeyInfo> {
      const body = await http.getJson('/key');
      const d = isObj(body) && isObj(body.data) ? body.data : null;
      const usage = d ? num(d.usage) : null;
      if (!d || usage === null) throw new Error('openrouter_bad_key_response');
      return {
        usage,
        usage_daily: num(d.usage_daily),
        limit: num(d.limit),
        limit_remaining: num(d.limit_remaining),
      };
    },
    async listZdrEndpoints(): Promise<ZdrEndpoint[]> {
      const body = await http.getJson('/endpoints/zdr', { auth: false });
      if (!isObj(body) || !Array.isArray(body.data)) throw new Error('openrouter_bad_zdr_response');
      return body.data as ZdrEndpoint[];
    },
  };
}
