import { Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';

import { configureBasicGenAI } from './gemini';

export type CoachAIProvider = 'gemini' | 'openai';

export type CoachAIConfig = {
  provider: CoachAIProvider;
  apiKey?: string;
  accessToken?: string;
  model: string;
};

export type ChatHistoryEntry = {
  role: 'user' | 'coach';
  content: string;
};

export type CoachResponse = {
  msg4User: string;
  sumMsg: string;
};

const COACH_SYSTEM_PROMPT = `You are Musclog Trainer, an expert personal trainer and nutritionist embedded in the Musclog fitness app.
Your role is to help users with:
- Planning and optimizing workouts
- Analyzing workout history and progress
- Providing nutrition advice and meal planning guidance
- Answering questions about exercises, form, and recovery

Keep responses concise, practical, and motivating. When suggesting workouts, be specific with exercises, sets, and reps.
When discussing nutrition, give actionable advice. Always prioritize safety and proper form.
You have access to the user's workout and nutrition logs through the app.

You must always respond with a JSON object containing exactly two fields:
- "msg4User": The full response to display to the user in the chat.
- "sumMsg": A brief 1-2 sentence summary of your response, used to preserve context in future turns without wasting tokens.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    msg4User: {
      type: 'string',
      description: 'The full response to display to the user in the chat.',
    },
    sumMsg: {
      type: 'string',
      description: 'A brief 1-2 sentence summary of the response for future context.',
    },
  },
  required: ['msg4User', 'sumMsg'],
};

function extractRawText(response: any): string {
  if (typeof response?.text === 'function') {
    return response.text() as string;
  }
  // Raw API response (access token path)
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseCoachResponse(raw: string): CoachResponse {
  try {
    const parsed = JSON.parse(raw);
    return {
      msg4User: parsed.msg4User ?? raw,
      sumMsg: parsed.sumMsg ?? raw,
    };
  } catch {
    // Fallback: if JSON parsing fails, use raw text for both fields
    return { msg4User: raw, sumMsg: raw };
  }
}

function buildGeminiContents(history: ChatHistoryEntry[], userMessage: string): Content[] {
  const historyContents: Content[] = history.map((entry) => ({
    parts: [{ text: entry.content } as Part],
    role: entry.role === 'coach' ? 'model' : 'user',
  }));

  return [...historyContents, { parts: [{ text: userMessage } as Part], role: 'user' }];
}

async function sendViaGemini(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<CoachResponse> {
  const systemParts: Part[] = [{ text: COACH_SYSTEM_PROMPT }];
  const genModel = await configureBasicGenAI(
    {
      accessToken: config.accessToken,
      apiKey: config.apiKey,
      model: config.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    },
    systemParts
  );

  const contents = buildGeminiContents(history, userMessage);
  const result = await genModel.generateContent({ contents });
  const raw = extractRawText(result.response);
  return parseCoachResponse(raw);
}

async function sendViaOpenAI(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<CoachResponse> {
  const client = new OpenAI({ apiKey: config.apiKey });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: COACH_SYSTEM_PROMPT },
    ...history.map((entry) => ({
      role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: entry.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'coach_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            msg4User: { type: 'string' },
            sumMsg: { type: 'string' },
          },
          required: ['msg4User', 'sumMsg'],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  return parseCoachResponse(raw);
}

export async function sendCoachMessage(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<CoachResponse> {
  if (config.provider === 'gemini') {
    return sendViaGemini(config, history, userMessage);
  }
  return sendViaOpenAI(config, history, userMessage);
}
