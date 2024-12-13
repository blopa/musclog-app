// IMPORTANT: only list models that support vision and language

// https://ai.google.dev/gemini-api/docs/models/gemini
export const GEMINI_MODELS = {
    GEMINI_FLASH_1_5: { model: 'gemini-1.5-flash', value: 1 },
    GEMINI_FLASH_1_5_8B: { model: 'gemini-1.5-flash-8b', value: 2 },
    GEMINI_FLASH_2_0: { model: 'gemini-2.0-flash-exp', value: 3 },
    GEMINI_PRO_1_5: { model: 'gemini-1.5-pro', value: 4 },
} as const;

// https://platform.openai.com/docs/models/gp
export const OPENAI_MODELS = {
    GPT_4_TURBO: { model: 'gpt-4-turbo', value: 1 },
    GPT_4O: { model: 'gpt-4o', value: 2 },
    GPT_4O_MINI: { model: 'gpt-4o-mini', value: 3 },
} as const;
