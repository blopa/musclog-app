import { Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';

import { configureBasicGenAI } from './gemini';

export type CoachAIProvider = 'gemini' | 'openai';

export type CoachAIConfig = {
  provider: CoachAIProvider;
  apiKey?: string;
  accessToken?: string;
  model: string;
  language?: string; // Re-introduced from old code
};

export type ChatHistoryEntry = {
  role: 'user' | 'coach';
  content: string;
};

export type CoachResponse = {
  msg4User: string;
  sumMsg: string;
  sumUserMsg?: string;
};

export const WORDS_SOFT_LIMIT = 100;
export const BE_CONCISE_PROMPT = `Be concise and limit your message to ${WORDS_SOFT_LIMIT} words.`;

/**
 * Merged System Prompt:
 * Combines Loggy's app integration with Chad's PhD personality and guardrails.
 */
const getSystemPrompt = (language: string = 'en-US') =>
  `
You are Loggy, a friendly and knowledgeable personal trainer with a PhD in Exercise Science and Nutrition, embedded in the Musclog app.
Your goal is to provide expert, motivating, and practical fitness advice.

STRICT GUIDELINES:
1. TONE: Friendly, professional, and human-like. Use colloquial language and emojis naturally—don't sound like a robot.
2. LANGUAGE: You MUST respond in ${language}, even if the user speaks to you in another language.
3. SCOPE: If the user asks about topics unrelated to nutrition, health, or fitness, politely explain you are specialized only in those areas.
4. CONTENT: Provide specific exercises, sets, and reps for workouts. Prioritize safety and form.
5. CONCISE: ${BE_CONCISE_PROMPT}
`.trim();

const baseSchemaProperties = {
  msg4User: {
    type: 'string',
    description: 'The full response to display to the user in the chat.',
  },
  sumMsg: {
    type: 'string',
    description: 'A brief 1-2 sentence summary of the main advice given.',
  },
};

const sumUserMsgProperty = {
  sumUserMsg: {
    type: 'string',
    description:
      "A brief 1-2 sentence summary of the user's message, capturing their intent. Used to compress long messages in future conversation history.",
  },
};

function buildResponseSchema(includeUserSummary: boolean) {
  return {
    type: 'object',
    properties: includeUserSummary
      ? { ...baseSchemaProperties, ...sumUserMsgProperty }
      : baseSchemaProperties,
    required: includeUserSummary ? ['msg4User', 'sumMsg', 'sumUserMsg'] : ['msg4User', 'sumMsg'],
  };
}

// --- Helper Functions ---

function extractRawText(response: any): string {
  if (typeof response?.text === 'function') {
    return response.text() as string;
  }
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseCoachResponse(raw: string): CoachResponse {
  try {
    // Handle cases where the model might wrap JSON in markdown blocks
    const cleanJson = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      msg4User: parsed.msg4User ?? raw,
      sumMsg: parsed.sumMsg ?? raw,
      sumUserMsg: parsed.sumUserMsg ?? undefined,
    };
  } catch {
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

// --- Provider Implementations ---

async function sendViaGemini(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<CoachResponse> {
  const systemParts: Part[] = [{ text: getSystemPrompt(config.language) }];
  const includeUserSummary = userMessage.length > WORDS_SOFT_LIMIT;

  const genModel = await configureBasicGenAI(
    {
      accessToken: config.accessToken,
      apiKey: config.apiKey,
      model: config.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(includeUserSummary),
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
  const includeUserSummary = userMessage.length > WORDS_SOFT_LIMIT;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt(config.language) },
    ...history.map((entry) => ({
      role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: entry.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const schema = buildResponseSchema(includeUserSummary);

  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'coach_response',
        strict: true,
        schema: {
          ...schema,
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
