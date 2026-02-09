// IMPORTANT: only list models that support vision and language
// Last updated: February 2026

// Documentation: https://ai.google.dev/gemini-api/docs/models
export const GEMINI_MODELS = {
  // Gemini 3 Series: Latest reasoning and agentic capabilities
  GEMINI_3_PRO: { model: 'gemini-3-pro-preview', value: 'gemini-3-pro-preview' },
  GEMINI_3_FLASH: { model: 'gemini-3-flash-preview', value: 'gemini-3-flash-preview' },

  // Gemini 2.5 Series: Stable production-grade models
  GEMINI_2_5_PRO: { model: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
  GEMINI_2_5_FLASH: { model: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
  GEMINI_2_5_FLASH_LITE: { model: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite' },

  // Specialized Multimodal
  GEMINI_2_5_FLASH_IMAGE: { model: 'gemini-2.5-flash-image', value: 'gemini-2.5-flash-image' },
} as const;

// https://platform.openai.com/docs/models/gp
// https://github.com/openai/openai-node/blob/master/src/resources/shared.ts#L18
export const OPENAI_MODELS = {
  // Flagship Multimodal Series (GPT-5)
  GPT_5_2: { model: 'gpt-5.2', value: 'gpt-5.2' },
  GPT_5_1: { model: 'gpt-5.1', value: 'gpt-5.1' },

  // High-Efficiency Multimodal (GPT-4.1 series)
  GPT_4_1: { model: 'gpt-4.1', value: 'gpt-4.1' },
  GPT_4_1_MINI: { model: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },

  // Legacy Omni Series (Still maintained in API)
  GPT_4O: { model: 'gpt-4o', value: 'gpt-4o' },
  GPT_4O_MINI: { model: 'gpt-4o-mini', value: 'gpt-4o-mini' },

  // Reasoning Series (Only those with Vision support)
  GPT_O1: { model: 'o1', value: 'o1' },
  GPT_O1_PRO: { model: 'o1-pro', value: 'o1-pro' },
  GPT_O3: { model: 'o3', value: 'o3' },
  GPT_O3_PRO: { model: 'o3-pro', value: 'o3-pro' },
} as const;
