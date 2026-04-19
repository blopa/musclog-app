import {
  Content,
  GenerateContentConfig,
  GenerateContentParameters,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
} from '@google/genai';
import type { ChatCompletionMessageParam } from 'openai/resources';

import { GEMINI_MODELS } from '@/constants/ai';

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

  return {
    models: {
      generateContent: async (params: GenerateContentParameters) => {
        captureMessage('No API key provided for generative AI');
        return {
          text: '',
          candidates: [],
        } as any;
      },
    },
    chats: {
      create: () => {
        return {
          sendMessage: async () => {
            captureMessage('No API key provided for generative AI');
            return {
              response: {},
              status: 401,
            } as any;
          },
        };
      },
    },
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
    generateContent: async (params: { contents: Content[] }) => {
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
