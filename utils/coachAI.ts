import { Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';

import { SettingsService } from '@/database/services';
import i18n from '@/lang/lang';

import { configureBasicGenAI } from './gemini';
import {
  createWorkoutPlanPrompt,
  getActiveCustomPrompts,
  getBaseSystemPrompt,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getEstimateMacrosFunctions,
  getEstimateNutritionFromPhotoPrompt,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getGenerateMealPlanFunctions,
  getGenerateMealPlanPrompt,
  getGenerateWorkoutPlanFunctions,
  getMealCritiquePrompt,
  getNutritionInsightsPrompt,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getRecentWorkoutInsightsPromptByLogId,
  getRecentWorkoutsInsightsPrompt,
  getRetrospectiveNutritionPrompt,
  getTrackMealFunctions,
  getTrackMealPrompt,
  getWorkoutInsightsPrompt,
  getWorkoutVolumeInsightsPrompt,
} from './prompts';

export class AiCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiCreditsError';
  }
}

export function isAiCreditsError(error: any): boolean {
  if (error instanceof AiCreditsError) {
    return true;
  }

  const status = error?.status ?? error?.response?.status;
  const code = error?.error?.code ?? error?.code;
  const message = (error?.message ?? '').toLowerCase();
  if (status === 429) {
    return true;
  }

  if (code === 'insufficient_quota') {
    return true;
  }

  if (
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted') ||
    message.includes('billing')
  ) {
    return true;
  }

  return false;
}

export type CoachAIProvider = 'gemini' | 'openai';

export type CoachAIConfig = {
  provider: CoachAIProvider;
  apiKey?: string;
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
  rememberMe?: string;
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
  fiber: number;
  grams: number;
  barcode?: string;
  foodId?: string;
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

export type TrackMealIngredient = {
  name: string;
  kcal: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number;
  grams: number;
  foodId?: string;
};

export type TrackedMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ingredients: TrackMealIngredient[];
};

export type TrackMealResponse = {
  meals: TrackedMeal[];
};

export type GenerateMealPlanResponse = {
  meals: {
    day: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    description: string;
    ingredients: TrackMealIngredient[];
  }[];
  description: string;
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

/**
 * Merged System Prompt:
 * Combines Loggy's app integration with Chad's PhD personality and guardrails.
 */
const getSystemPrompt = async (
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
) => {
  return await getBaseSystemPrompt(language, context);
};

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

const rememberMeProperty = {
  remember_me: {
    type: 'string',
    description: 'A short sentence with something important to remember about the user.',
  },
};

function buildResponseSchema(includeUserSummary: boolean) {
  const properties = {
    ...baseSchemaProperties,
    ...rememberMeProperty,
  };

  if (includeUserSummary) {
    Object.assign(properties, sumUserMsgProperty);
  }

  return {
    type: 'object',
    properties,
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
      rememberMe: parsed.remember_me ?? undefined,
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

/**
 * Recursively adds additionalProperties: false to all objects in a JSON schema.
 * Required for OpenAI's 'strict: true' mode.
 */
function makeSchemaStrict(schema: any): any {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  if (schema.type === 'object') {
    const properties = schema.properties ? { ...schema.properties } : {};
    Object.keys(properties).forEach((key) => {
      properties[key] = makeSchemaStrict(properties[key]);
    });

    return {
      ...schema,
      properties,
      additionalProperties: false,
    };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: makeSchemaStrict(schema.items),
    };
  }

  return schema;
}

// --- Provider Implementations ---

async function sendViaGemini(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<CoachResponse> {
  const systemPrompt = await getSystemPrompt(config.language, context);
  const systemParts: Part[] = [{ text: systemPrompt }];
  const includeUserSummary = userMessage.length > WORDS_SOFT_LIMIT;

  const genModel = await configureBasicGenAI(
    {
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
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<CoachResponse> {
  const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  const includeUserSummary = userMessage.length > WORDS_SOFT_LIMIT;
  const systemPrompt = await getSystemPrompt(config.language, context);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((entry) => ({
      role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: entry.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const schema = makeSchemaStrict(buildResponseSchema(includeUserSummary));

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'coach_response',
          strict: true,
          schema,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    return parseCoachResponse(raw);
  } catch (error: any) {
    console.error('[coachAI] sendViaOpenAI error:', error);
    if (isAiCreditsError(error)) {
      throw new AiCreditsError(error?.message ?? 'OpenAI quota exceeded');
    }
    // Return a friendly error message if the API call fails (e.g. invalid key, quota exceeded)
    const errorMsg = error?.message || 'Error communicating with OpenAI';
    return {
      msg4User: `Error: ${errorMsg}`,
      sumMsg: 'OpenAI error',
    };
  }
}

// --- Helpers for insight/parsing/vision ---

const INSIGHTS_USER_MESSAGE = 'Based on the data above, provide your analysis and insights.';

async function generateText(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string = INSIGHTS_USER_MESSAGE
): Promise<string> {
  const lang = config.language ?? 'en-US';
  const promptWithLang = `${systemPrompt}\n\nRespond in the following language/locale: ${lang}.`;
  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
      },
      [{ text: promptWithLang } as Part]
    );

    const contents: Content[] = [{ parts: [{ text: userMessage } as Part], role: 'user' }];
    const result = await genModel.generateContent({ contents });
    const raw = extractRawText(result.response);
    return raw?.trim() ?? '';
  }

  const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: promptWithLang },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  return raw.trim();
}

/**
 * Generate text with recent conversation history so the model keeps context.
 * Sends system prompt, then history (last N messages), then final user message.
 */
async function generateTextWithHistory(
  config: CoachAIConfig,
  systemPrompt: string,
  recentConversation: ChatHistoryEntry[],
  finalUserMessage: string
): Promise<string> {
  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
      },
      [{ text: systemPrompt } as Part]
    );
    const contents = buildGeminiContents(recentConversation, finalUserMessage);
    const result = await genModel.generateContent({ contents });
    const raw = extractRawText(result.response);
    return raw?.trim() ?? '';
  }

  const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  const historyMessages = recentConversation.map((e) => ({
    role: (e.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: e.content,
  }));
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: finalUserMessage },
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
  userMessage: string,
  schema: object,
  schemaName: string = 'response'
): Promise<T | null> {
  const lang = config.language ?? 'en-US';
  const promptWithLang = `${systemPrompt}\n\nRespond in the following language/locale: ${lang}. All user-facing content in the structured output (e.g. titles, descriptions) must be in this language.`;
  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      },
      [{ text: promptWithLang } as Part]
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
  const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  const strictSchema = makeSchemaStrict(schema);
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: promptWithLang },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: strictSchema,
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
  const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  const strictSchema = makeSchemaStrict(schema);
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
        schema: strictSchema,
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

/**
 * Track a meal from description or base64 image
 */
export async function trackMeal(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string
): Promise<TrackMealResponse | null> {
  try {
    const lang = config.language ?? 'en-US';
    const includeFoundationFoods = await SettingsService.getSendFoundationFoodsToLlm();
    const systemPrompt = await getTrackMealPrompt(lang, includeFoundationFoods);
    const fns = getTrackMealFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    if (base64Image) {
      const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      return await generateWithImageStructured<TrackMealResponse>(
        config,
        systemPrompt,
        base64,
        mimeType,
        schema,
        'trackMeal',
        userMessage
      );
    }

    return await generateStructured<TrackMealResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'trackMeal'
    );
  } catch (error) {
    console.error('[coachAI] trackMeal error:', error);
    return null;
  }
}

export async function sendCoachMessage(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<CoachResponse> {
  if (config.provider === 'gemini') {
    return sendViaGemini(config, history, userMessage, context);
  }

  return sendViaOpenAI(config, history, userMessage, context);
}

/**
 * AI FUNCTION DISPATCHERS
 * These delegate to provider-specific implementations
 */

/**
 * Get nutrition insights for a date range.
 * Optional userRemarks are passed to the model so it can factor them into the analysis.
 * Optional recentConversation (e.g. last 3 messages) gives the model context so it doesn't reply as if starting fresh.
 */
export async function getNutritionInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string,
  userRemarks?: string,
  recentConversation?: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'nutrition'
): Promise<string | null> {
  try {
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getNutritionInsightsPrompt(
      startDate,
      endDate,
      lang,
      undefined,
      context
    );

    const finalUserMessage = userRemarks?.trim()
      ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
      : INSIGHTS_USER_MESSAGE;

    if (recentConversation?.length) {
      const text = await generateTextWithHistory(
        config,
        systemPrompt,
        recentConversation,
        finalUserMessage
      );
      return text || null;
    }

    const text = await generateText(config, systemPrompt, finalUserMessage);
    return text || null;
  } catch (error) {
    console.error('[coachAI] getNutritionInsights error:', error);
    return null;
  }
}

/**
 * Generate a workout plan from conversation history
 */
/**
 * Generate a meal plan from conversation history
 */
export async function generateMealPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  macroTargets?: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
  context: 'nutrition' | 'exercise' | 'general' = 'nutrition'
): Promise<GenerateMealPlanResponse | null> {
  try {
    const lang = config.language ?? 'en-US';
    const includeFoundationFoods = await SettingsService.getSendFoundationFoodsToLlm();
    const systemPrompt = await getGenerateMealPlanPrompt(
      lang,
      macroTargets,
      undefined,
      context,
      includeFoundationFoods
    );

    const userMessage =
      history.map((e) => `${e.role === 'user' ? 'User' : 'Coach'}: ${e.content}`).join('\n\n') +
      '\n\nGenerate the meal plan.';

    const fns = getGenerateMealPlanFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<GenerateMealPlanResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'generateMealPlan'
    );
    return parsed ?? null;
  } catch (error) {
    console.error('[coachAI] generateMealPlan error:', error);
    return null;
  }
}

/**
 * Generate a workout plan from conversation history
 */
export async function generateWorkoutPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'exercise'
): Promise<GenerateWorkoutPlanResponse | null> {
  try {
    const lang = config.language ?? 'en-US';
    const systemPrompt = await createWorkoutPlanPrompt(lang, undefined, context);
    const instruction =
      history.length > 0
        ? i18n.t('coach.aiInstructions.generateWorkoutPlanWithHistory', { lng: lang })
        : i18n.t('coach.aiInstructions.generateWorkoutPlanDefault', { lng: lang });

    const userMessage =
      history.length > 0
        ? history.map((e) => `${e.role === 'user' ? 'User' : 'Coach'}: ${e.content}`).join('\n\n') +
          '\n\n' +
          instruction
        : instruction;

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
 * Get insights about recent workouts in a date range.
 * Optional userRemarks are passed to the model so it can factor them into the analysis.
 * Optional recentConversation (e.g. last 3 messages) gives the model context so it doesn't reply as if starting fresh.
 */
export async function getRecentWorkoutsInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string,
  userRemarks?: string,
  recentConversation?: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'exercise'
): Promise<string | null> {
  try {
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getRecentWorkoutsInsightsPrompt(
      startDate,
      endDate,
      lang,
      undefined,
      context
    );

    const finalUserMessage = userRemarks?.trim()
      ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
      : INSIGHTS_USER_MESSAGE;

    if (recentConversation?.length) {
      const text = await generateTextWithHistory(
        config,
        systemPrompt,
        recentConversation,
        finalUserMessage
      );
      return text || null;
    }

    const text = await generateText(config, systemPrompt, finalUserMessage);
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
    const customPrompts = await getActiveCustomPrompts();
    const includeFoundationFoods = await SettingsService.getSendFoundationFoodsToLlm();
    const baseSystemPrompt = await getEstimateNutritionFromPhotoPrompt(includeFoundationFoods);
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const fns = getEstimateMacrosFunctions(false, includeFoundationFoods);
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
    const customPrompts = await getActiveCustomPrompts();
    const baseSystemPrompt = getExtractMacrosFromLabelPrompt();
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;
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
    const hasContext = context && (context.description.trim() || context.tags.length > 0);
    if (!ocrText.trim() && !hasContext) {
      return null;
    }

    const customPrompts = await getActiveCustomPrompts();
    const baseSystemPrompt = getExtractMacrosFromLabelTextPrompt();
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;
    const fns = getEstimateMacrosFunctions(true);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

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
    const systemPrompt = await getParsePastWorkoutsPrompt(userMessage, exerciseNames, lang);
    const fns = getParsePastWorkoutsFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastWorkouts: ParsedWorkout[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseWorkouts', { lng: lang }),
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
    const systemPrompt = await getParsePastNutritionPrompt(userMessage, lang);
    const fns = getParsePastNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastNutrition: ParsedNutrition[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseNutrition', { lng: lang }),
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
    const systemPrompt = await getRetrospectiveNutritionPrompt(targetDate, userMessage, lang);
    const fns = getParseRetrospectiveNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ nutritionEntries: NutritionEntry[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseRetrospectiveNutrition', { lng: lang }),
      schema,
      'parseRetrospectiveNutrition'
    );

    return parsed?.nutritionEntries ?? null;
  } catch (error) {
    console.error('[coachAI] parseRetrospectiveNutrition error:', error);
    return null;
  }
}

/**
 * Get AI critique/insights for a single meal.
 */
export async function getMealCritique(
  config: CoachAIConfig,
  mealType: string,
  foods: { name: string; gramWeight: number }[],
  totals: { calories: number; protein: number; carbs: number; fat: number },
  userRemarks?: string
): Promise<string | null> {
  try {
    const lang = config.language ?? 'en-US';
    const systemPrompt = await getMealCritiquePrompt(mealType, foods, totals, lang, 'nutrition');
    const finalUserMessage = userRemarks?.trim()
      ? userRemarks.trim()
      : 'Please critique this meal.';
    const text = await generateText(config, systemPrompt, finalUserMessage);
    return text || null;
  } catch (error) {
    console.error('[coachAI] getMealCritique error:', error);
    return null;
  }
}
