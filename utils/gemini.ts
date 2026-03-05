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
// import fetch from 'isomorphic-fetch';
import { fetch } from 'expo/fetch';
import type { ChatCompletionMessageParam } from 'openai/resources';

import { GEMINI_MODELS } from '../constants/ai';
import { getAccessToken } from './googleAuth';
import { captureMessage } from './sentry';

const getModel = async () => {
  const defaultModel = GEMINI_MODELS.GEMINI_2_5_FLASH.model;

  return defaultModel;
};

// https://cloud.google.com/vertex-ai/generative-ai/docs/reference/python/latest/vertexai.generative_models.FinishReason
const ACCEPTABLE_STOP_REASONS = ['MAX_TOKENS', 'STOP'];

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
  accessToken,
  apiKey,
}: {
  accessToken?: string;
  apiKey?: string;
}): Promise<GoogleGenerativeAI> => {
  if (accessToken) {
    return {
      getGenerativeModel: ({ model, ...modelParams }: ModelParams) => {
        return {
          generateContent: async (request: GenerateContentRequest) => {
            return await rawFetchGeminiApi(model, accessToken, {
              ...modelParams,
              ...request,
            });
          },
          startChat: ({ history }: StartChatParams) => {
            return {
              sendMessage: async (request: string) => {
                return await rawFetchGeminiApi(model, accessToken, {
                  ...modelParams,
                  contents: [
                    ...(history || []),
                    { parts: [{ text: request } as Part], role: 'user' },
                  ],
                });
              },
            };
          },
        };
      },
    } as unknown as GoogleGenerativeAI;
  }

  if (apiKey) {
    return new GoogleGenerativeAI(apiKey);
  }

  return {
    getGenerativeModel: (modelParams: ModelParams) => {
      return {
        generateContent: async (request: GenerateContentRequest) => {
          captureMessage('No API key or access token provided for generative AI');
          return {
            response: null,
            status: 401,
          };
        },
        startChat: async (startChatParams: StartChatParams) => {
          return {
            sendMessage: async (request: string) => {
              captureMessage('No API key or access token provided for generative AI');
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

const rawFetchGeminiApi = async (model: string, accessToken: string, body: any) => {
  const makeRequest = async (accessToken: string) => {
    const result = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    );

    return result;
  };

  // First attempt
  let result = await makeRequest(accessToken);

  if (result.status === 401) {
    try {
      console.warn('Access token is invalid. Attempting to refresh...');
      const newAccessToken = await getAccessToken();

      if (newAccessToken) {
        // Retry with the new access token
        result = await makeRequest(newAccessToken);
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token and retry the request.');
    }
  }

  if (result.ok) {
    const data = await result.json();

    return {
      response: data,
      status: result.status,
    };
  }

  return {
    response: null,
    status: result.status,
  };
};

export const configureBasicGenAI = async (
  {
    accessToken,
    apiKey,
    model,
    generationConfig,
  }: {
    accessToken?: string;
    apiKey?: string;
    model?: string;
    generationConfig?: Record<string, unknown>;
  },
  systemParts?: Part[]
) => {
  const genAI = await getGenerativeAI({ accessToken, apiKey });

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
