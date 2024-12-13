export const GEMINI_MODELS = {
    GEMINI_FLASH_1_5: { model: 'gemini-1.5-flash', value: 1 },
    GEMINI_FLASH_1_5_8B: { model: 'gemini-1.5-flash-8b', value: 2 },
    GEMINI_FLASH_2_0: { model: 'gemini-2.0-flash-exp', value: 3 },
    GEMINI_PRO_1_0: { model: 'gemini-1.0-pro', value: 4 },
    GEMINI_PRO_1_5: { model: 'gemini-1.5-pro', value: 5 },
} as const;

export const OPENAI_MODELS = {
    GPT_3_5_TURBO: { model: 'gpt-3.5-turbo', value: 1 },
    GPT_4: { model: 'gpt-4-turbo', value: 2 },
    GPT_4_TURBO: { model: 'gpt-4-turbo', value: 3 },
    GPT_4O: { model: 'gpt-4o', value: 4 },
    GPT_4O_MINI: { model: 'gpt-4o-mini', value: 5 },
    O1_MINI: { model: 'o1-mini', value: 6 },
    O1_PREVIEW: { model: 'o1-preview', value: 7 },
} as const;
