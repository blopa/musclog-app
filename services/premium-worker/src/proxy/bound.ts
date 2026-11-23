// Reservation bound (plan 8.2 step 1). USD per 1M tokens equals micro-USD per token.
import type { AiConfig } from '../config';
import type { UpstreamName } from '../upstream/types';
import type { AllowlistedRequest } from './allowlist';

/**
 * Priced with the active upstream's own prices: OpenRouter keeps `config.prices`, Otari prices each
 * feature with its pinned model's. The flat per-request fee stays `config.prices.request_fee_u`.
 */
export function reservationBound(
  req: AllowlistedRequest,
  config: AiConfig,
  upstream: UpstreamName = 'openrouter'
): number {
  const { image, finance } = config;
  const prices =
    upstream === 'otari' && config.otari ? config.otari.models[req.feature].prices : config.prices;
  const inTokens =
    Math.ceil(req.textBytes / 2) +
    req.images * image.tokens_max +
    Math.ceil(req.schemaToolsBytes / 2);
  const raw =
    inTokens * prices.prompt_per_mtok +
    req.maxTokens * prices.completion_per_mtok +
    req.images * prices.image_per_image * 1e6;
  return Math.max(1, Math.ceil(raw * finance.price_slack) + config.prices.request_fee_u);
}
