// Reservation bound (plan 8.2 step 1). USD per 1M tokens equals micro-USD per token.
import type { AiConfig } from '../config';
import type { AllowlistedRequest } from './allowlist';

export function reservationBound(req: AllowlistedRequest, config: AiConfig): number {
  const { prices, image, finance } = config;
  const inTokens =
    Math.ceil(req.textBytes / 2) +
    req.images * image.tokens_max +
    Math.ceil(req.schemaToolsBytes / 2);
  const raw =
    inTokens * prices.prompt_per_mtok +
    req.maxTokens * prices.completion_per_mtok +
    req.images * prices.image_per_image * 1e6;
  return Math.max(1, Math.ceil(raw * finance.price_slack) + prices.request_fee_u);
}
