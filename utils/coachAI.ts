import { Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';

import { configureBasicGenAI } from './gemini';
import {
  createWorkoutPlanPrompt,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getEstimateMacrosFunctions,
  getEstimateNutritionFromPhotoPrompt,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getGenerateWorkoutPlanFunctions,
  getNutritionInsightsPrompt,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getRecentWorkoutInsightsPromptByLogId,
  getRecentWorkoutsInsightsPrompt,
  getRetrospectiveNutritionPrompt,
  getWorkoutInsightsPrompt,
  getWorkoutVolumeInsightsPrompt,
} from './prompts';

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
    exerciseId: string;
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

// --- Helpers for insight/parsing/vision ---

const INSIGHTS_USER_MESSAGE = 'Based on the data above, provide your analysis and insights.';

async function generateText(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string = INSIGHTS_USER_MESSAGE
): Promise<string> {
  // TODO: use lang
  const lang = config.language ?? 'en-US';
  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        accessToken: config.accessToken,
        apiKey: config.apiKey,
        model: config.model,
      },
      [{ text: systemPrompt } as Part]
    );

    const contents: Content[] = [{ parts: [{ text: userMessage } as Part], role: 'user' }];
    const result = await genModel.generateContent({ contents });
    const raw = extractRawText(result.response);
    return raw?.trim() ?? '';
  }

  const client = new OpenAI({ apiKey: config.apiKey });
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  return raw.trim();
}

function getSchemaFromFunctionDeclaration(fn: {
  parameters?: { type?: string; properties?: object; required?: string[] };
}): object {
  const p = fn.parameters;
  if (!p || typeof p !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }
  return {
    type: p.type ?? 'object',
    properties: p.properties ?? {},
    required: p.required ?? [],
  };
}

async function generateStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string, // TODO: the "user message" (when we generate it) needs to be translated
  schema: object,
  schemaName: string = 'response'
): Promise<T | null> {
  // TODO: shouldn't we use lang?
  const lang = config.language ?? 'en-US';
  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        accessToken: config.accessToken,
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      },
      [{ text: systemPrompt } as Part]
    );
    const contents: Content[] = [{ parts: [{ text: userMessage } as Part], role: 'user' }];
    const result = await genModel.generateContent({ contents });
    const raw = extractRawText(result.response);
    if (!raw?.trim()) {
      return null;
    }
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as T;
    } catch {
      return null;
    }
  }
  const client = new OpenAI({ apiKey: config.apiKey });
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: { ...schema, additionalProperties: false },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content ?? '';
  if (!raw?.trim()) {
    return null;
  }
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

async function generateWithImageStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  base64Image: string,
  mimeType: string,
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string
): Promise<T | null> {
  const userText =
    'Analyze this image and return the structured data.' +
    (userMessageSuffix?.trim() ? `\n\n${userMessageSuffix.trim()}` : '');

  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        accessToken: config.accessToken,
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      },
      [{ text: systemPrompt } as Part]
    );
    const contents: Content[] = [
      {
        parts: [
          { text: userText } as Part,
          { inlineData: { mimeType, data: base64Image } } as Part,
        ],
        role: 'user',
      },
    ];
    const result = await genModel.generateContent({ contents });
    const raw = extractRawText(result.response);
    if (!raw?.trim()) {
      return null;
    }
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as T;
    } catch {
      return null;
    }
  }
  const client = new OpenAI({ apiKey: config.apiKey });
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: { ...schema, additionalProperties: false },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content ?? '';
  if (!raw?.trim()) {
    return null;
  }
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getNutritionInsightsPrompt(startDate, endDate, lang);
    const text = await generateText(config, systemPrompt);
    return text || null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await createWorkoutPlanPrompt(lang);
    const userMessage =
      history.length > 0
        ? history.map((e) => `${e.role === 'user' ? 'User' : 'Coach'}: ${e.content}`).join('\n\n') +
          '\n\nGenerate a workout plan based on this conversation.'
        : 'Generate a basic weekly workout plan (e.g. 3-day split).';
    const fns = getGenerateWorkoutPlanFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<GenerateWorkoutPlanResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'generateWorkoutPlan'
    );
    return parsed ?? null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getCalculateNextWorkoutVolumePrompt(workoutTitle, lang);
    const userMessage =
      typeof completedWorkoutData === 'string'
        ? completedWorkoutData
        : JSON.stringify(completedWorkoutData ?? {}, null, 2);
    const fns = getCalculateNextWorkoutVolumeFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<CalculateVolumeResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'calculateNextWorkoutVolume'
    );
    return parsed ?? null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getWorkoutInsightsPrompt(workoutTitle, lang);
    const text = await generateText(config, systemPrompt);
    return text || null;
  } catch (error) {
    console.error('[coachAI] getWorkoutInsights error:', error);
    return null;
  }
}

/**
 * Get feedback on a recently completed workout (by workout log id).
 */
export async function getRecentWorkoutInsights(
  config: CoachAIConfig,
  workoutLogId: string
): Promise<string | null> {
  try {
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getRecentWorkoutInsightsPromptByLogId(workoutLogId, lang);
    const text = await generateText(config, systemPrompt);
    return text || null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getRecentWorkoutsInsightsPrompt(startDate, endDate, lang);
    const text = await generateText(config, systemPrompt);
    return text || null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getWorkoutVolumeInsightsPrompt(workoutTitle, lang);
    const text = await generateText(config, systemPrompt);
    return text || null;
  } catch (error) {
    console.error('[coachAI] getWorkoutVolumeInsights error:', error);
    return null;
  }
}

/**
 * Optional context from the user to improve meal photo estimation (e.g. description + tags).
 */
export type MealPhotoContext = {
  description: string;
  tags: string[];
};

/**
 * Estimate nutrition from a meal photo
 */
export async function estimateNutritionFromPhoto(
  config: CoachAIConfig,
  base64Image: string,
  context?: MealPhotoContext | null
): Promise<MacroEstimate | null> {
  try {
    const systemPrompt = getEstimateNutritionFromPhotoPrompt();
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const fns = getEstimateMacrosFunctions(false);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    let userMessageSuffix: string | undefined;
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }
      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }
      userMessageSuffix = parts.join('\n');
    }

    const parsed = await generateWithImageStructured<MacroEstimate>(
      config,
      systemPrompt,
      base64,
      mimeType,
      schema,
      'estimateMacros',
      userMessageSuffix
    );
    return parsed ?? null;
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
  base64Image: string,
  context?: MealPhotoContext | null
): Promise<MacroEstimate | null> {
  try {
    const systemPrompt = getExtractMacrosFromLabelPrompt();
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const fns = getEstimateMacrosFunctions(true);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    let userMessageSuffix: string | undefined;
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }

      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }

      userMessageSuffix = parts.join('\n');
    }

    const parsed = await generateWithImageStructured<MacroEstimate>(
      config,
      systemPrompt,
      base64,
      mimeType,
      schema,
      'estimateMacros',
      userMessageSuffix
    );
    return parsed ?? null;
  } catch (error) {
    console.error('[coachAI] extractMacrosFromLabelPhoto error:', error);
    return null;
  }
}

/**
 * Extract macros from OCR text of a nutrition label (no image sent to AI).
 * Use when the app has already run OCR and only the text is available.
 */
export async function extractMacrosFromLabelText(
  config: CoachAIConfig,
  ocrText: string,
  context?: MealPhotoContext | null
): Promise<MacroEstimate | null> {
  try {
    const systemPrompt = getExtractMacrosFromLabelTextPrompt();
    const fns = getEstimateMacrosFunctions(true);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    // TODO: if no text extracted AND no context, then just fails the request
    let userMessage = ocrText.trim() || 'No text extracted from the label.';
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }

      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }

      userMessage += '\n\n' + parts.join('\n');
    }

    const parsed = await generateStructured<MacroEstimate>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'estimateMacros'
    );

    return parsed ?? null;
  } catch (error) {
    console.error('[coachAI] extractMacrosFromLabelText error:', error);
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = getParsePastWorkoutsPrompt(userMessage, exerciseNames, lang);
    const fns = getParsePastWorkoutsFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastWorkouts: ParsedWorkout[] }>(
      config,
      systemPrompt,
      'Parse the workouts and return the structured list.',
      schema,
      'parsePastWorkouts'
    );
    return parsed?.pastWorkouts ?? null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = getParsePastNutritionPrompt(userMessage, lang);
    const fns = getParsePastNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastNutrition: ParsedNutrition[] }>(
      config,
      systemPrompt,
      'Parse the nutrition data and return the structured list.',
      schema,
      'parsePastNutrition'
    );
    return parsed?.pastNutrition ?? null;
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
    const lang = config.language ?? 'en-US';
    const systemPrompt = getRetrospectiveNutritionPrompt(targetDate, userMessage, lang);
    const fns = getParseRetrospectiveNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ nutritionEntries: NutritionEntry[] }>(
      config,
      systemPrompt,
      'Parse the meals and return the structured list.',
      schema,
      'parseRetrospectiveNutrition'
    );

    return parsed?.nutritionEntries ?? null;
  } catch (error) {
    console.error('[coachAI] parseRetrospectiveNutrition error:', error);
    return null;
  }
}
