import {
  Content,
  GenerateContentConfig,
  GenerateContentParameters,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
  ThinkingLevel,
} from '@google/genai';
import type { ChatCompletionMessageParam } from 'openai/resources';

import { GEMINI_MODELS } from '@/constants/ai';

import { AiInvalidKeyError } from './aiErrors';
import { captureMessage } from './sentry';

const getModel = async () => {
  const defaultModel = GEMINI_MODELS.GEMINI_2_5_FLASH.model;

  return defaultModel;
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const getGenerativeAI = async ({
  apiKey,
  httpOptions,
}: {
  apiKey?: string;
  httpOptions?: { baseUrl?: string; headers?: Record<string, string> };
}): Promise<GoogleGenAI> => {
  if (apiKey) {
    return new GoogleGenAI({ apiKey, httpOptions });
  }

  // No key: fail loudly. The old stand-in returned an empty result, which every caller read as
  // "the model said nothing" and showed as a generic failure instead of "add an API key".
  const fail = async (): Promise<never> => {
    captureMessage('No API key provided for generative AI');
    throw new AiInvalidKeyError('gemini', 'No API key provided for generative AI');
  };

  return {
    models: { generateContent: fail },
    chats: { create: () => ({ sendMessage: fail }) },
  } as unknown as GoogleGenAI;
};

export const configureBasicGenAI = async (
  {
    apiKey,
    httpOptions,
    model,
    generationConfig,
    tools,
  }: {
    apiKey?: string;
    httpOptions?: { baseUrl?: string; headers?: Record<string, string> };
    model?: string;
    generationConfig?: Record<string, unknown>;
    tools?: any[];
  },
  systemParts?: Part[]
) => {
  const genAI = await getGenerativeAI({ apiKey, httpOptions });
  const modelName = model || (await getModel());

  return {
    generateContent: async (params: { contents: Content[]; abortSignal?: AbortSignal }) => {
      return genAI.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: {
          safetySettings,
          ...(generationConfig as any),
          systemInstruction: systemParts
            ? {
                parts: systemParts,
              }
            : undefined,
          ...(tools && { tools }),
          ...(params.abortSignal && { abortSignal: params.abortSignal }),
        },
      });
    },
  };
};

export const createConversationContent = (messages: ChatCompletionMessageParam[]): Content[] =>
  messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      parts: [{ text: msg.content } as Part],
      role: msg.role === 'assistant' ? 'model' : msg.role,
    }));

// --- Response text ---

export interface GeminiTextResult {
  /** The answer, with thought summaries left out. Empty when there is none. */
  text: string;
  finishReason?: string;
  /** Why the prompt was refused, when it was (`promptFeedback.blockReason`). */
  blockReason?: string;
  /** The model produced only thoughts: an empty answer that is not "the model said nothing". */
  thoughtOnly: boolean;
}

/**
 * The answer text of a Gemini response. A thinking model returns several parts — thought summaries
 * (`thought: true`) and the answer — so the first part is not the answer. The SDK's `response.text`
 * getter skips thoughts, but when EVERY part is a thought it returns `undefined`, and the old
 * `response.text ?? parts[0].text` fell through to the thought text and parsed it as the answer.
 * This reads the parts itself, and falls back to `response.text` only when there are no parts at
 * all (mocks, and the gateway's flattened shape).
 */
export function extractGeminiText(response: any): GeminiTextResult {
  const candidate = response?.candidates?.[0];
  const parts: any[] = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const answerParts = parts.filter(
    (part) => typeof part?.text === 'string' && part.thought !== true
  );

  let text = answerParts.map((part) => part.text as string).join('');
  if (parts.length === 0 && typeof response?.text === 'string') {
    text = response.text;
  }

  return {
    text,
    finishReason: candidate?.finishReason ?? undefined,
    blockReason: response?.promptFeedback?.blockReason ?? undefined,
    thoughtOnly: parts.length > 0 && answerParts.length === 0,
  };
}

// --- Generation config ---

export type GeminiModelFamily =
  | 'gemini-3-pro'
  | 'gemini-3-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'other';

type ThinkingCapability =
  | { kind: 'level'; structured: ThinkingLevel }
  | { kind: 'budget'; structured: number }
  | { kind: 'none' };

/**
 * How each family is told to think less on a structured JSON call (a food scan does not need a
 * long chain of thought). Gemini 3 takes `thinkingLevel`; 2.5 takes `thinkingBudget`; sending both
 * is rejected, so a family has exactly one kind. Pro models cannot switch thinking off — Gemini 3
 * Pro's lowest level is LOW and 2.5 Pro's minimum budget is 128 — so those get the lowest allowed
 * value rather than zero. The Gemini docs have moved these names between preview releases:
 * re-check this table against https://ai.google.dev/gemini-api/docs/thinking when adding a model.
 */
export const GEMINI_MODEL_CAPABILITIES: Record<GeminiModelFamily, ThinkingCapability> = {
  'gemini-3-pro': { kind: 'level', structured: ThinkingLevel.LOW },
  'gemini-3-flash': { kind: 'level', structured: ThinkingLevel.MINIMAL },
  'gemini-2.5-pro': { kind: 'budget', structured: 128 },
  'gemini-2.5-flash': { kind: 'budget', structured: 0 },
  'gemini-2.5-flash-lite': { kind: 'budget', structured: 0 },
  other: { kind: 'none' },
};

export function geminiModelFamily(model: string | undefined): GeminiModelFamily {
  const name = (model ?? '').toLowerCase();
  if (name.startsWith('gemini-3') && name.includes('pro')) {
    return 'gemini-3-pro';
  }

  if (name.startsWith('gemini-3')) {
    return 'gemini-3-flash';
  }

  if (name.startsWith('gemini-2.5-flash-lite')) {
    return 'gemini-2.5-flash-lite';
  }

  if (name.startsWith('gemini-2.5-flash')) {
    return 'gemini-2.5-flash';
  }

  if (name.startsWith('gemini-2.5-pro')) {
    return 'gemini-2.5-pro';
  }

  return 'other';
}

/**
 * The generation config for a JSON call. `thinking: 'low'` asks the model to think as little as it
 * is allowed to (structured extraction); `'default'` leaves thinking to the model, which is what
 * the user's "thinking mode" setting asks for. Exactly one of `thinkingLevel` / `thinkingBudget`
 * is ever set, and an unknown model gets neither rather than a field it might reject.
 */
export function buildGeminiGenerationConfig(
  model: string | undefined,
  options: { responseSchema?: unknown; thinking: 'low' | 'default'; json?: boolean }
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (options.json !== false) {
    config.responseMimeType = 'application/json';
  }

  if (options.responseSchema) {
    config.responseSchema = options.responseSchema;
  }

  if (options.thinking === 'low') {
    const capability = GEMINI_MODEL_CAPABILITIES[geminiModelFamily(model)];
    if (capability.kind === 'level') {
      config.thinkingConfig = { thinkingLevel: capability.structured };
    } else if (capability.kind === 'budget') {
      config.thinkingConfig = { thinkingBudget: capability.structured };
    }
  }

  return config;
}
