// IMPORTANT: only list models that support vision and language

// https://ai.google.dev/gemini-api/docs/models/gemini
export const GEMINI_MODELS = {
    GEMINI_1_5_FLASH: { model: 'gemini-1.5-flash', value: 1 },
    GEMINI_1_5_PRO: { model: 'gemini-1.5-pro', value: 2 },
    GEMINI_2_0_FLASH: { model: 'gemini-2.0-flash', value: 3 },
    GEMINI_2_0_FLASH_LITE: { model: 'gemini-2.0-flash-lite', value: 4 },
    GEMINI_2_5_FLASH: { model: 'gemini-2.5-flash', value: 5 },
    GEMINI_2_5_PRO: { model: 'gemini-2.5-pro', value: 6 },
} as const;

// https://platform.openai.com/docs/models/gp
export const OPENAI_MODELS = {
    GPT_4: { model: 'gpt-4', value: 1 },
    GPT_4_1: { model: 'gpt-4.1', value: 2 },
    GPT_4_TURBO: { model: 'gpt-4-turbo', value: 3 },
    GPT_4O: { model: 'gpt-4o', value: 4 },
    GPT_4O_MINI: { model: 'gpt-4o-mini', value: 5 },
    GPT_O1: { model: 'o1', value: 6 },
    GPT_O1_MINI: { model: 'o1-mini', value: 7 },
    GPT_O3: { model: 'o3', value: 8 },
    GPT_O3_MINI: { model: 'o3-mini', value: 9 },
    GPT_O4_MINI: { model: 'o4-mini', value: 10 },
} as const;
