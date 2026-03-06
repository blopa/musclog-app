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

/**
 * Response types for various AI functions
 */

export type WorkoutPlan = {
  title: string;
  description?: string;
  recurringOnWeekDay: string;
  exercises: {
    name: string;
    reps: number;
    sets: number;
    oneRepMaxPercentage: number;
  }[];
};

export type GenerateWorkoutPlanResponse = {
  workoutPlan: WorkoutPlan[];
  description: string;
};

export type CalculateVolumeResponse = {
  messageToUser: string;
  workoutVolume: {
    exerciseId: number;
    sets: {
      setId: number;
      reps: number;
      weight: number;
    }[];
  }[];
};

export type MacroEstimate = {
  name: string;
  kcal: number;
  kj: number;
  carbs: number;
  fat: number;
  protein: number;
  grams: number;
  barcode?: string;
};

export type ParsedWorkout = {
  title: string;
  date: string;
  duration?: number;
  description?: string;
  exercises: {
    name: string;
    muscleGroup?: string;
    type?: string;
    sets: {
      reps: number;
      weight: number;
    }[];
  }[];
};

export type ParsedNutrition = {
  date: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
};

export type NutritionEntry = {
  productTitle: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  mealType: number; // 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack, 5=Other
  fiber?: number;
  sodium?: number;
  sugar?: number;
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

/**
 * AI FUNCTION DISPATCHERS
 * These delegate to provider-specific implementations
 */

/**
 * Get nutrition insights for a date range
 */
export async function getNutritionInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] getNutritionInsights not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] getNutritionInsights error:', error);
    return null;
  }
}

/**
 * Generate a workout plan from conversation history
 */
export async function generateWorkoutPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[]
): Promise<GenerateWorkoutPlanResponse | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] generateWorkoutPlan not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] generateWorkoutPlan error:', error);
    return null;
  }
}

/**
 * Calculate next workout volume based on performance
 */
export async function calculateNextWorkoutVolume(
  config: CoachAIConfig,
  workoutTitle: string,
  completedWorkoutData: any
): Promise<CalculateVolumeResponse | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] calculateNextWorkoutVolume not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] calculateNextWorkoutVolume error:', error);
    return null;
  }
}

/**
 * Get insights about an upcoming workout
 */
export async function getWorkoutInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] getWorkoutInsights not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] getWorkoutInsights error:', error);
    return null;
  }
}

/**
 * Get feedback on a recently completed workout
 */
export async function getRecentWorkoutInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] getRecentWorkoutInsights not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] getRecentWorkoutInsights error:', error);
    return null;
  }
}

/**
 * Get insights about recent workouts in a date range
 */
export async function getRecentWorkoutsInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] getRecentWorkoutsInsights not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] getRecentWorkoutsInsights error:', error);
    return null;
  }
}

/**
 * Get volume trend analysis for a specific workout
 */
export async function getWorkoutVolumeInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] getWorkoutVolumeInsights not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] getWorkoutVolumeInsights error:', error);
    return null;
  }
}

/**
 * Estimate nutrition from a meal photo
 */
export async function estimateNutritionFromPhoto(
  config: CoachAIConfig,
  base64Image: string
): Promise<MacroEstimate | null> {
  try {
    // TODO: Implement via Gemini/OpenAI vision
    console.warn('[coachAI] estimateNutritionFromPhoto not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] estimateNutritionFromPhoto error:', error);
    return null;
  }
}

/**
 * Extract macros from a nutrition label photo
 */
export async function extractMacrosFromLabelPhoto(
  config: CoachAIConfig,
  base64Image: string
): Promise<MacroEstimate | null> {
  try {
    // TODO: Implement via Gemini/OpenAI vision
    console.warn('[coachAI] extractMacrosFromLabelPhoto not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] extractMacrosFromLabelPhoto error:', error);
    return null;
  }
}

/**
 * Parse past workouts from natural language
 */
export async function parsePastWorkouts(
  config: CoachAIConfig,
  userMessage: string,
  exerciseNames: string[]
): Promise<ParsedWorkout[] | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] parsePastWorkouts not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] parsePastWorkouts error:', error);
    return null;
  }
}

/**
 * Parse past nutrition from natural language
 */
export async function parsePastNutrition(
  config: CoachAIConfig,
  userMessage: string
): Promise<ParsedNutrition[] | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] parsePastNutrition not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] parsePastNutrition error:', error);
    return null;
  }
}

/**
 * Parse nutrition from a natural language description of a past day
 */
export async function parseRetrospectiveNutrition(
  config: CoachAIConfig,
  userMessage: string,
  targetDate: string
): Promise<NutritionEntry[] | null> {
  try {
    // TODO: Implement via Gemini/OpenAI
    console.warn('[coachAI] parseRetrospectiveNutrition not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] parseRetrospectiveNutrition error:', error);
    return null;
  }
}

/**
 * Generate an exercise image via AI
 */
export async function generateExerciseImage(
  config: CoachAIConfig,
  exerciseName: string
): Promise<string | null> {
  try {
    // TODO: Implement via Gemini/OpenAI vision
    console.warn('[coachAI] generateExerciseImage not yet implemented');
    return null;
  } catch (error) {
    console.error('[coachAI] generateExerciseImage error:', error);
    return null;
  }
}
