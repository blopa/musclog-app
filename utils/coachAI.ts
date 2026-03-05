import { Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';

import { configureBasicGenAI } from './gemini';

export type CoachAIProvider = 'gemini' | 'openai';

export type CoachAIConfig = {
  provider: CoachAIProvider;
  apiKey: string;
  model: string;
};

export type ChatHistoryEntry = {
  role: 'user' | 'coach';
  content: string;
};

const COACH_SYSTEM_PROMPT = `You are Musclog Trainer, an expert personal trainer and nutritionist embedded in the Musclog fitness app.
Your role is to help users with:
- Planning and optimizing workouts
- Analyzing workout history and progress
- Providing nutrition advice and meal planning guidance
- Answering questions about exercises, form, and recovery

Keep responses concise, practical, and motivating. When suggesting workouts, be specific with exercises, sets, and reps.
When discussing nutrition, give actionable advice. Always prioritize safety and proper form.
You have access to the user's workout and nutrition logs through the app.`;

function extractGeminiText(response: any): string {
  if (typeof response?.text === 'function') {
    return response.text() as string;
  }
  // Raw API response (access token path)
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
): Promise<string> {
  const systemParts: Part[] = [{ text: COACH_SYSTEM_PROMPT }];
  const genModel = await configureBasicGenAI(
    { apiKey: config.apiKey, model: config.model },
    systemParts
  );

  const contents = buildGeminiContents(history, userMessage);
  const result = await genModel.generateContent({ contents });
  return extractGeminiText(result.response);
}

async function sendViaOpenAI(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
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
  });

  return completion.choices[0]?.message?.content ?? '';
}

export async function sendCoachMessage(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
  if (config.provider === 'gemini') {
    return sendViaGemini(config, history, userMessage);
  }
  return sendViaOpenAI(config, history, userMessage);
}
