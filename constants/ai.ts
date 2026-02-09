// IMPORTANT: only list models that support vision and language

// https://ai.google.dev/gemini-api/docs/models/gemini
export const GEMINI_MODELS = {
  GEMINI_2_0_FLASH: { model: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
  GEMINI_2_0_FLASH_LITE: { model: 'gemini-2.0-flash-lite', value: 'gemini-2.0-flash-lite' },
  GEMINI_2_5_FLASH: { model: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
  GEMINI_2_5_FLASH_LITE: { model: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite' },
  GEMINI_2_5_PRO: { model: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
} as const;

// https://platform.openai.com/docs/models/gp
// https://github.com/openai/openai-node/blob/master/src/resources/shared.ts#L18
export const OPENAI_MODELS = {
  GPT_4: { model: 'gpt-4', value: 'gpt-4' },
  GPT_4_1: { model: 'gpt-4.1', value: 'gpt-4.1' },
  GPT_4_TURBO: { model: 'gpt-4-turbo', value: 'gpt-4-turbo' },
  GPT_4O: { model: 'gpt-4o', value: 'gpt-4o' },
  GPT_4O_MINI: { model: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  GPT_O1: { model: 'o1', value: 'o1' },
  GPT_O1_MINI: { model: 'o1-mini', value: 'o1-mini' },
  GPT_O3: { model: 'o3', value: 'o3' },
  GPT_O3_MINI: { model: 'o3-mini', value: 'o3-mini' },
  GPT_O4_MINI: { model: 'o4-mini', value: 'o4-mini' },
} as const;
