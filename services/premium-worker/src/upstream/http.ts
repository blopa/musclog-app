// Shared JSON and HTTP helpers for upstream inference gateways (OpenRouter, Otari).
import type { UpstreamName } from './types';

export const GET_TIMEOUT_MS = 15_000;

export type Json = Record<string, unknown>;
export const isObj = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function createUpstreamHttp(o: {
  name: UpstreamName;
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}) {
  const doFetch = o.fetch ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');

  async function getJson(
    path: string,
    opts: { auth?: boolean; allow404?: boolean } = {}
  ): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.auth ?? true) headers.authorization = `Bearer ${o.apiKey}`;
    const res = await doFetch(`${base}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    });
    if (opts.allow404 && res.status === 404) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`${o.name}_http_${res.status}`);
    }
    return res.json();
  }

  function chatCompletions(body: string, init: { signal: AbortSignal }): Promise<Response> {
    return doFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${o.apiKey}`,
        'content-type': 'application/json',
      },
      body,
      signal: init.signal,
    });
  }

  return { getJson, chatCompletions };
}
