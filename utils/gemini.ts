import {
  Content,
  GenerateContentRequest,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
  Part,
  StartChatParams,
} from '@google/generative-ai';
import type { ChatCompletionMessageParam } from 'openai/resources';

import { GEMINI_MODELS } from '../constants/ai';
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

const getGenerativeAI = async ({ apiKey }: { apiKey?: string }): Promise<GoogleGenerativeAI> => {
  if (apiKey) {
    return new GoogleGenerativeAI(apiKey);
  }

  return {
    getGenerativeModel: (modelParams: ModelParams) => {
      return {
        generateContent: async (request: GenerateContentRequest) => {
          captureMessage('No API key provided for generative AI');
          return {
            response: null,
            status: 401,
          };
        },
        startChat: async (startChatParams: StartChatParams) => {
          return {
            sendMessage: async (request: string) => {
              captureMessage('No API key provided for generative AI');
              return {
                response: {},
                status: 401,
              };
            },
          };
        },
      };
    },
  } as unknown as GoogleGenerativeAI;
};

export const configureBasicGenAI = async (
  {
    apiKey,
    model,
    generationConfig,
  }: {
    apiKey?: string;
    model?: string;
    generationConfig?: Record<string, unknown>;
  },
  systemParts?: Part[]
) => {
  const genAI = await getGenerativeAI({ apiKey });

  return genAI.getGenerativeModel({
    model: model || (await getModel()),
    safetySettings,
    ...(generationConfig && { generationConfig }),
    ...(systemParts && {
      systemInstruction: {
        parts: systemParts,
        role: 'system',
      },
    }),
  });
};

export const createConversationContent = (messages: ChatCompletionMessageParam[]): Content[] =>
  messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      parts: [{ text: msg.content } as Part],
      role: msg.role === 'assistant' ? 'model' : msg.role,
    }));
