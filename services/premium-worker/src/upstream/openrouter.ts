// OpenRouter client. The key is only ever placed in the Authorization header, never logged.
import type { OpenRouterClient, OpenRouterKeyInfo, ZdrEndpoint } from './types';

const GET_TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function createOpenRouterClient(o: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}): OpenRouterClient {
  const doFetch = o.fetch ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');

  async function getJson(path: string, auth: boolean): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (auth) headers.authorization = `Bearer ${o.apiKey}`;
    const res = await doFetch(`${base}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    });
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {});
      return { status: 404, body: null };
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`openrouter_http_${res.status}`);
    }
    return { status: res.status, body: await res.json() };
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
    async getGeneration(id) {
      const { body } = await getJson(`/generation?id=${encodeURIComponent(id)}`, true);
      if (!isObj(body) || !isObj(body.data)) return null;
      const cost = num(body.data.total_cost);
      return cost === null ? null : { total_cost: cost };
    },
    async getKey(): Promise<OpenRouterKeyInfo> {
      const { body } = await getJson('/key', true);
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
      const { body } = await getJson('/endpoints/zdr', false);
      if (!isObj(body) || !Array.isArray(body.data)) throw new Error('openrouter_bad_zdr_response');
      return body.data as ZdrEndpoint[];
    },
  };
}
