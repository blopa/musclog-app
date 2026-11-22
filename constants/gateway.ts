// The Musclog free tier calls OpenRouter's OpenAI-compatible API directly from the app.
// The free variant needs no provider key: no Google key is shipped in the app or stored in OpenRouter.
export const DEFAULT_GATEWAY_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_GATEWAY_MODEL = 'google/gemma-4-31b-it:free';

/**
 * An environment override, unless it is left over from the retired Cloudflare AI Gateway: that
 * gateway answers the OpenRouter key with `401 [{"code":2009,"message":"Unauthorized"}]` (2.17.2
 * shipped with the old EAS variable still set), and its model ids (`google-ai-studio/...`) mean
 * nothing to OpenRouter.
 */
export function resolveGatewaySetting(
  value: string | undefined,
  fallback: string,
  retired: RegExp
): string {
  const trimmed = value?.trim();

  return trimmed && !retired.test(trimmed) ? trimmed : fallback;
}

export const MUSCLOG_GATEWAY_BASE_URL = resolveGatewaySetting(
  process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  /gateway\.ai\.cloudflare\.com/i
);
// A restricted OpenRouter key (guardrails: this model and Google AI Studio only, plus a daily budget), shipped in the bundle on
// purpose: it can only spend what the guardrail allows. The OpenAI SDK sends it as
// "Authorization: Bearer <token>".
export const MUSCLOG_GATEWAY_AUTH_TOKEN = process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_AUTH_TOKEN ?? '';
// OpenRouter model id. The free tier is Google AI Studio's unpaid `:free` Gemma endpoint.
export const MUSCLOG_GATEWAY_MODEL = resolveGatewaySetting(
  process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_MODEL,
  DEFAULT_GATEWAY_MODEL,
  /^google-ai-studio\//i
);
// Cap on a free-tier reply, added to a request that sets none (a key shipped in the bundle must not
// be able to ask for unbounded output).
export const MUSCLOG_GATEWAY_MAX_TOKENS = 2048;
// The OpenRouter provider slug every free-tier request is pinned to (no fallbacks), so a Google quota
// error cannot spill onto other providers or OpenRouter's shared capacity and bill the maintainer's
// credits. An empty string means no pin.
export const MUSCLOG_GATEWAY_PROVIDER =
  process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_PROVIDER ?? 'google-ai-studio';
