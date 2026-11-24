// The gateway-specific half of the request body. `allowlistRequest` produces one gateway-neutral
// body (every client field, validated); each upstream gets its own builder, so a field that one
// gateway does not know (OpenRouter's `provider`/`reasoning`, Otari's `metadata`/`reasoning_effort`)
// can never reach the other. Each builder's output is checked by an assert right before sending.
import type { AiConfig, Feature, OtariConfig } from '../config';
import type { NeutralBody } from './allowlist';
import { assertPremiumPrivacy } from './allowlist';

type Json = Record<string, unknown>;

/**
 * The OpenRouter body. Key order and values are exactly what `allowlistRequest` returned before the
 * split (pinned by test/fixtures/openrouterBodies.json).
 */
export function buildOpenRouterBody(neutral: NeutralBody, config: AiConfig): Json {
  const { prices, provider } = config;
  const body: Json = {
    model: config.model,
    provider: {
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      max_price: {
        prompt: prices.prompt_per_mtok,
        completion: prices.completion_per_mtok,
        image: prices.image_per_image,
      },
      ...(provider.only ? { only: provider.only, order: provider.only } : {}),
    },
    messages: neutral.messages,
    stream: neutral.stream,
    max_tokens: neutral.max_tokens,
  };
  assertPremiumPrivacy(body);
  if (neutral.temperature !== undefined) body.temperature = neutral.temperature;
  if (neutral.reasoning !== null) body.reasoning = { effort: neutral.reasoning };
  if (neutral.response_format) body.response_format = neutral.response_format;
  if (neutral.tools) body.tools = neutral.tools;
  if (neutral.tool_choice !== undefined) body.tool_choice = neutral.tool_choice;
  if (neutral.parallel_tool_calls !== undefined)
    body.parallel_tool_calls = neutral.parallel_tool_calls;
  if (neutral.stop !== undefined) body.stop = neutral.stop;
  return body;
}

/**
 * The Otari body: the pinned selector of the request's feature as `model`, `reasoning_effort` in
 * place of `reasoning`, usage on streams, and metadata that names no person or device.
 */
export function buildOtariBody(
  neutral: NeutralBody,
  otari: OtariConfig,
  feature: Feature,
  workerEnv: string
): Json {
  const body: Json = {
    model: otari.models[feature].model,
    messages: neutral.messages,
    stream: neutral.stream,
    max_tokens: neutral.max_tokens,
  };
  if (neutral.stream) body.stream_options = { include_usage: true };
  if (neutral.temperature !== undefined) body.temperature = neutral.temperature;
  if (neutral.reasoning !== null) body.reasoning_effort = neutral.reasoning;
  if (neutral.response_format) body.response_format = neutral.response_format;
  if (neutral.tools) body.tools = neutral.tools;
  if (neutral.tool_choice !== undefined) body.tool_choice = neutral.tool_choice;
  if (neutral.parallel_tool_calls !== undefined)
    body.parallel_tool_calls = neutral.parallel_tool_calls;
  if (neutral.stop !== undefined) body.stop = neutral.stop;
  body.metadata = { app: 'musclog-iron', env: workerEnv, feature };
  return body;
}

const PINNED_MODEL = /^([a-z0-9-]+):\S+$/;

/** The provider prefix of a pinned selector, or null when it is not one. */
export const selectorProvider = (model: unknown): string | null =>
  typeof model === 'string' ? (PINNED_MODEL.exec(model)?.[1] ?? null) : null;

/**
 * Runtime guard, the Otari twin of `assertPremiumPrivacy`: the model must be pinned to one allowed
 * provider (no fallback) and no OpenRouter `provider` object may be present. Throws, never sends.
 */
export function assertOtariPinned(body: Json, otari: OtariConfig): void {
  const prefix = selectorProvider(body.model);
  if (prefix === null || !otari.providers.includes(prefix) || 'provider' in body) {
    throw new Error('premium_privacy_invariant_violated');
  }
}
