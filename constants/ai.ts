// IMPORTANT: only list models that support vision and language
// Last updated: October 2026

// Documentation: https://ai.google.dev/gemini-api/docs/models
// Shutdown dates: https://ai.google.dev/gemini-api/docs/deprecations
// The 2.5 models are not shut down but only stay available to projects that already used them, so
// they are no longer offered. Anything a user has stored that is not listed here is replaced by the
// default (see `utils/aiModels.ts`), so removing a model from this list retires it for everyone.
export const GEMINI_MODELS = {
  // Gemini 4: flagship
  GEMINI_4_ARGON: { model: 'gemini-4-argon', value: 'gemini-4-argon' },

  // Gemini 3.x: Flash tiers (3.8 is Google's recommendation for new projects)
  GEMINI_3_8_FLASH: { model: 'gemini-3.8-flash', value: 'gemini-3.8-flash' },
  GEMINI_3_6_FLASH: { model: 'gemini-3.6-flash', value: 'gemini-3.6-flash' },
  GEMINI_3_5_FLASH_LITE: { model: 'gemini-3.5-flash-lite', value: 'gemini-3.5-flash-lite' },

  // Gemini 3.1 Pro has no stable release yet
  GEMINI_3_1_PRO: { model: 'gemini-3.1-pro-preview', value: 'gemini-3.1-pro-preview' },
} as const;

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS.GEMINI_3_8_FLASH.value;

// https://developers.openai.com/api/docs/models
// Shutdown dates: https://developers.openai.com/api/docs/deprecations
// Older families (gpt-4o / gpt-4.1 shut down 2027-01-14, o3 2026-12-11, gpt-5.1 2027-04-01) are
// not offered.
export const OPENAI_MODELS = {
  GPT_6_ASTRA: { model: 'gpt-6-astra', value: 'gpt-6-astra' },
  GPT_6_1_SOL: { model: 'gpt-6.1-sol', value: 'gpt-6.1-sol' },
  GPT_6_1_TERRA: { model: 'gpt-6.1-terra', value: 'gpt-6.1-terra' },
  GPT_6_LUNA: { model: 'gpt-6-luna', value: 'gpt-6-luna' },
} as const;

export const DEFAULT_OPENAI_MODEL = OPENAI_MODELS.GPT_6_LUNA.value;

/** Which provider answers AI requests; the order mirrors `AiService.getAiConfig()`'s priority. */
export const AI_PROVIDER_KINDS = ['gateway', 'on-device', 'local', 'gemini', 'openai'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

/**
 * How well a provider handles messy real-world food (a restaurant plate, a vague description).
 * The hosted models are strong; the small on-device and local ones are fine for simple meals but
 * guess more on a dish they cannot see well, so tips that lean on AI say so for them.
 */
export const AI_PROVIDER_STRENGTH: Record<AiProviderKind, 'strong' | 'basic'> = {
  gateway: 'strong',
  gemini: 'strong',
  openai: 'strong',
  'on-device': 'basic',
  local: 'basic',
};
