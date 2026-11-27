// The gateway-specific half of the request body. `allowlistRequest` produces one gateway-neutral
// body (every client field, validated); each upstream gets its own builder, so a field that one
// gateway does not know (OpenRouter's `provider`/`reasoning`, Otari's `metadata`/`reasoning_effort`)
// can never reach the other. Each builder's output is checked by an assert right before sending.
import type { AiConfig, Feature, OtariConfig } from '../config';
import { isObj, type Json } from '../upstream/http';
import { assignDefined, type NeutralBody } from './allowlist';

const OPTIONAL_AFTER_REASONING = [
  'response_format',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'stop',
] as const;

function appendOptionalFields(
  body: Json,
  neutral: NeutralBody,
  reasoningField: [string, unknown] | null
): Json {
  if (neutral.temperature !== undefined) body.temperature = neutral.temperature;
  if (reasoningField) body[reasoningField[0]] = reasoningField[1];
  return assignDefined(body, neutral, OPTIONAL_AFTER_REASONING);
}

/**
 * Runtime guard for the Premium privacy invariant: account-level ZDR is off at OpenRouter, so this
 * per-request `provider` object is the only thing keeping a request off providers that retain or
 * train on data. Throws (never sends) when any of the three fields is missing or different.
 */
export function assertPremiumPrivacy(body: Json): void {
  const p = body.provider;
  if (!isObj(p) || p.zdr !== true || p.data_collection !== 'deny' || p.allow_fallbacks !== false) {
    throw new Error('premium_privacy_invariant_violated');
  }
}

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
  const full = appendOptionalFields(
    body,
    neutral,
    neutral.reasoning !== null ? ['reasoning', { effort: neutral.reasoning }] : null
  );
  // Checked last, on the body that is sent: nothing added above can have changed `provider`.
  assertPremiumPrivacy(full);

  return full;
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
  appendOptionalFields(
    body,
    neutral,
    neutral.reasoning !== null ? ['reasoning_effort', neutral.reasoning] : null
  );
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
