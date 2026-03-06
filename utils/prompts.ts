import { FunctionDeclaration } from '@google/generative-ai';
import OpenAI from 'openai';

import { User } from '../database/models';
import { UserService } from '../database/services';

export const WORDS_SOFT_LIMIT = 100;
export const BE_CONCISE_PROMPT = `Be concise and limit your message to ${WORDS_SOFT_LIMIT} words.`;

/**
 * Base system prompt for Loggy persona
 */
export const getBaseSystemPrompt = (language: string = 'en-US'): string => {
  return `You are Loggy, a friendly and knowledgeable personal trainer with a PhD in Exercise Science and Nutrition, embedded in the Musclog app.
Your goal is to provide expert, motivating, and practical fitness advice.

STRICT GUIDELINES:
1. TONE: Friendly, professional, and human-like. Use colloquial language and emojis naturally—don't sound like a robot.
2. LANGUAGE: You MUST respond in ${language}, even if the user speaks to you in another language.
3. SCOPE: If the user asks about topics unrelated to nutrition, health, or fitness, politely explain you are specialized only in those areas.
4. CONTENT: Provide specific exercises, sets, and reps for workouts. Prioritize safety and form.
5. CONCISE: ${BE_CONCISE_PROMPT}`.trim();
};

/**
 * One-line user profile summary for context injection
 */
export const getUserDetailsPrompt = (
  user: User | null,
  eatingPhase?: string,
  weightUnit: string = 'kg'
): string => {
  if (!user) {
    return 'User profile information not available.';
  }

  const parts: string[] = [];

  if (eatingPhase) {
    parts.push(`is currently ${eatingPhase}`);
  }

  if (user.dateOfBirth) {
    const birthDate = new Date(user.dateOfBirth);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age > 0) {
      parts.push(`${age} years old`);
    }
  }

  if (user.gender) {
    parts.push(`${user.gender}`);
  }

  if (user.fitnessGoal) {
    parts.push(`fitness goal is "${user.fitnessGoal}"`);
  }

  if (user.activityLevel) {
    parts.push(`activity level is "${user.activityLevel}"`);
  }

  if (user.liftingExperience) {
    parts.push(`lifting experience is "${user.liftingExperience}"`);
  }

  // Note: Encrypted metrics (weight, body fat %) would need to be decrypted via UserMetricService
  // For now, we note this limitation
  const summary =
    parts.length > 0 ? `The user ${parts.join(', ')}.` : 'User profile information limited.';
  return summary;
};

/**
 * Full chat system message with user context and recent workouts
 * Call this on chat session init to build the system message
 * Note: eatingPhase needs to be fetched from NutritionGoal separately
 */
export const getChatMessagePromptContent = async (
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch last 4 recent workouts via WorkoutService
  // Format them as JSON for AI consumption
  const recentWorkoutsJson = '[]'; // Placeholder - implement with WorkoutService

  const sections = [
    getBaseSystemPrompt(language),
    `The current date is ${new Date().toLocaleDateString(language)}.`,
    `The current time is ${new Date().toLocaleTimeString(language)}.`,
    `Some details about the user: ${userDetails}`,
    `The following JSON data are the recent workouts the user did:`,
    '```json',
    recentWorkoutsJson,
    '```',
    "All weights are in the user's preferred unit (kg or lbs).",
    'The following content is a conversation between the user and Loggy...',
  ];

  return sections.join('\n');
};

/**
 * System prompt for workout plan generation
 */
export const createWorkoutPlanPrompt = async (
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch all exercises from ExerciseService
  const exercisesList = '[exercises would be listed here]'; // Placeholder

  return [
    getBaseSystemPrompt(language),
    "Generate a workout plan with exercises, reps, sets, and percentages of 1 rep max based on the user's fitness goals, activity level, weight, height and available equipment.",
    "If you can't infer what workout the user wants you to generate from the messages, simply generate a basic weekly workout plan, like a 3-day split.",
    `Please only use the exercises from the following list: ${exercisesList}`,
    userDetails,
  ].join('\n');
};

/**
 * System prompt for nutrition insights
 */
export const getNutritionInsightsPrompt = async (
  startDate: string,
  endDate: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch nutrition data via NutritionService
  // Format as: { date, calories, protein, carbs, fat }[]
  const nutritionData = '[]'; // Placeholder

  // TODO: Fetch user metrics via UserMetricService
  // Format as: { date, weight, fatPercentage }[]
  const metricsData = '[]'; // Placeholder

  const diffInDays = Math.floor(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return [
    getBaseSystemPrompt(language),
    `Please provide insights about the user's nutrition in these ${diffInDays} days range, like if they are eating enough protein, if they are consuming too many calories, etc. Base your analysis on their goal, eating phase, and activity level.`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Weight and fat percentage metrics:',
    '```json',
    metricsData,
    '```',
    'Daily nutrition aggregates:',
    '```json',
    nutritionData,
    '```',
  ].join('\n');
};

/**
 * System prompt for recent workouts insights
 */
export const getRecentWorkoutsInsightsPrompt = async (
  startDate: string,
  endDate: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch recent workouts via WorkoutService
  const workoutsJson = '[]'; // Placeholder

  const diffInDays = Math.floor(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return [
    getBaseSystemPrompt(language),
    `Please provide insights about the user's workouts in these ${diffInDays} days range, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Recent workouts:',
    '```json',
    workoutsJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for calculating next workout volume
 */
export const getCalculateNextWorkoutVolumePrompt = async (
  workoutTitle: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch all past occurrences of this workout
  const pastOccurrencesJson = '[]'; // Placeholder

  return [
    getBaseSystemPrompt(language),
    `The user just completed a "${workoutTitle}" workout. Your task is to:
1. Congratulate them and give specific feedback on their performance (check difficulty level 1-10, rest times, exhaustion level 1-10, workout score 1-10)
2. Calculate the volume for the next workout session using an average of these formulas: Epley, Brzycki, Lander, Lombardi, Mayhew, O'Connor, and Wathan
3. Volume doesn't always mean increases - suggest adjustments based on the data and their goals`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Historical data for this workout:',
    '```json',
    pastOccurrencesJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for upcoming workout insights
 */
export const getWorkoutInsightsPrompt = async (
  workoutTitle: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch workout template details
  const workoutJson = '{}'; // Placeholder

  return [
    getBaseSystemPrompt(language),
    `Please provide insights about the user's "${workoutTitle}" workout, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Workout details:',
    '```json',
    workoutJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for single recent workout insights
 */
export const getRecentWorkoutInsightsPrompt = async (
  workoutTitle: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch single completed workout event
  const workoutJson = '{}'; // Placeholder

  return [
    getBaseSystemPrompt(language),
    `Please provide insights and feedback about the user's recent "${workoutTitle}" workout performance, including volume, exercise selection, rest times, and effort level.`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Completed workout:',
    '```json',
    workoutJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for workout volume trends
 */
export const getWorkoutVolumeInsightsPrompt = async (
  workoutTitle: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const userDetails = getUserDetailsPrompt(user, eatingPhase);

  // TODO: Fetch all historical occurrences sorted by date
  const historyJson = '[]'; // Placeholder

  return [
    getBaseSystemPrompt(language),
    `Analyze the volume trend for the user's "${workoutTitle}" workout over time. Identify patterns, recommend adjustments, and assess progress.`,
    BE_CONCISE_PROMPT,
    userDetails,
    'Historical volume data (sorted by date):',
    '```json',
    historyJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for parsing past workouts from natural language
 */
export const getParsePastWorkoutsPrompt = (
  userMessage: string,
  exerciseNames: string[],
  language: string = 'en-US'
): string => {
  return [
    getBaseSystemPrompt(language),
    "Parse past workouts from the user's text description. Try to match exercise names to the provided list.",
    `If too long, only parse the first 20 workouts. Available exercises: ${exerciseNames.join(', ')}`,
    `User's message:\n${userMessage}`,
  ].join('\n');
};

/**
 * System prompt for parsing past nutrition from natural language
 */
export const getParsePastNutritionPrompt = (
  userMessage: string,
  language: string = 'en-US'
): string => {
  return [
    getBaseSystemPrompt(language),
    "Parse past nutrition data from the user's text into structured entries. Parse up to 20 entries.",
    'Extract: date, calories, protein, carbs, fat, fiber, and other macronutrients if available.',
    `User's message:\n${userMessage}`,
  ].join('\n');
};

/**
 * System prompt for retrospective nutrition logging
 */
export const getRetrospectiveNutritionPrompt = (
  targetDate: string,
  userMessage: string,
  language: string = 'en-US'
): string => {
  return [
    getBaseSystemPrompt(language),
    `The user wants to log nutrition data for ${targetDate}. Break down their natural language description into individual food items.`,
    'Categorize each item by meal type: 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack.',
    'Estimate reasonable portions and nutritional values based on common serving sizes.',
    `User's description:\n${userMessage}`,
  ].join('\n');
};

/**
 * System prompt for meal photo nutrition estimation
 */
export const getEstimateNutritionFromPhotoPrompt = (): string => {
  return [
    'You are an expert nutritionist with extensive knowledge of food composition.',
    'Analyze the provided food photo and estimate the macronutrients.',
    'Be as accurate as possible based on portion size visible in the image.',
    'If uncertain about portion size, provide estimates for a typical serving.',
    'Return structured nutritional data.',
  ].join('\n');
};

/**
 * System prompt for nutrition label photo extraction
 */
export const getExtractMacrosFromLabelPrompt = (): string => {
  return [
    'You are an expert at reading and extracting data from nutrition labels.',
    'Use OCR to read all text from the provided nutrition label image.',
    'Extract all nutritional information: calories, protein, carbs, fat, fiber, sugars, sodium, etc.',
    'If a barcode or EAN code is visible (typically 8-14 digits), extract it as well.',
    'Return the extracted nutritional data in structured format.',
  ].join('\n');
};

/**
 * Function schema for chat message response (Gemini + OpenAI compatible)
 */
export const getSendChatMessageFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'generateMessage',
      description: "A response to a user's message with optional user summary.",
      parameters: {
        type: 'object',
        properties: {
          msg4User: {
            type: 'string',
            description: `A message to be displayed to the user. ${BE_CONCISE_PROMPT}`,
          },
          sumMsg: {
            type: 'string',
            description:
              'A brief 1-2 sentence summary of the main advice given (for conversation compression).',
          },
          sumUserMsg: {
            type: 'string',
            description:
              "A brief 1-2 sentence summary of the user's message, capturing their intent (for history compression).",
          },
        },
        required: ['msg4User', 'sumMsg'],
      },
    },
  ];
};

/**
 * Function schema for workout plan generation
 */
export const getGenerateWorkoutPlanFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'generateWorkoutPlan',
      description:
        'Generates a complete workout plan with exercises, reps, sets, and intensity percentages',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A brief description of the workout plan to show the user',
          },
          workoutPlan: {
            type: 'array',
            description: 'Array of individual workouts in the plan',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Workout name (e.g., "Push Day", "Leg Day")',
                },
                description: {
                  type: 'string',
                  description: 'Brief description of the workout focus',
                },
                recurringOnWeekDay: {
                  type: 'string',
                  description: 'Day of week: "monday", "tuesday", etc.',
                },
                exercises: {
                  type: 'array',
                  description: 'List of exercises in this workout',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Exercise name (should match available exercises in database)',
                      },
                      reps: {
                        type: 'number',
                        description: 'Target number of reps per set',
                      },
                      sets: {
                        type: 'number',
                        description: 'Number of sets to perform',
                      },
                      oneRepMaxPercentage: {
                        type: 'number',
                        description: 'Percentage of estimated 1RM to use (e.g., 75 for 75%)',
                      },
                    },
                    required: ['name', 'reps', 'sets', 'oneRepMaxPercentage'],
                  },
                },
              },
              required: ['title', 'recurringOnWeekDay', 'exercises'],
            },
          },
        },
        required: ['workoutPlan', 'description'],
      },
    },
  ];
};

/**
 * Function schema for next workout volume calculation
 */
export const getCalculateNextWorkoutVolumeFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'calculateNextWorkoutVolume',
      description:
        'Calculates recommended volume for the next workout session based on performance history',
      parameters: {
        type: 'object',
        properties: {
          messageToUser: {
            type: 'string',
            description: `Feedback message for the user about their workout. ${BE_CONCISE_PROMPT}`,
          },
          workoutVolume: {
            type: 'array',
            description: 'Recommended volume adjustments per exercise',
            items: {
              type: 'object',
              properties: {
                exerciseId: {
                  type: 'number',
                  description: 'Database ID of the exercise',
                },
                sets: {
                  type: 'array',
                  description: 'Recommended sets with reps and weight',
                  items: {
                    type: 'object',
                    properties: {
                      setId: {
                        type: 'number',
                        description: 'Set number/order',
                      },
                      reps: {
                        type: 'number',
                        description: 'Target reps',
                      },
                      weight: {
                        type: 'number',
                        description: "Recommended weight in user's preferred unit",
                      },
                    },
                    required: ['setId', 'reps', 'weight'],
                  },
                },
              },
              required: ['exerciseId', 'sets'],
            },
          },
        },
        required: ['messageToUser', 'workoutVolume'],
      },
    },
  ];
};

/**
 * Function schema for parsing past workouts
 */
export const getParsePastWorkoutsFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'parsePastWorkouts',
      description: 'Parses historical workout data from natural language text',
      parameters: {
        type: 'object',
        properties: {
          pastWorkouts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Workout name',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                duration: {
                  type: 'number',
                  description: 'Duration in minutes',
                },
                description: {
                  type: 'string',
                  description: 'Additional notes about the workout',
                },
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      muscleGroup: {
                        type: 'string',
                      },
                      type: {
                        type: 'string',
                      },
                      sets: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            reps: { type: 'number' },
                            weight: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
              required: ['title', 'date', 'exercises'],
            },
          },
        },
        required: ['pastWorkouts'],
      },
    },
  ];
};

/**
 * Function schema for parsing past nutrition
 */
export const getParsePastNutritionFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'parsePastNutrition',
      description: 'Parses historical nutrition data from natural language text',
      parameters: {
        type: 'object',
        properties: {
          pastNutrition: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                calories: {
                  type: 'number',
                },
                carbs: {
                  type: 'number',
                },
                fat: {
                  type: 'number',
                },
                protein: {
                  type: 'number',
                },
                fiber: {
                  type: 'number',
                },
                sugar: {
                  type: 'number',
                },
                sodium: {
                  type: 'number',
                },
                cholesterol: {
                  type: 'number',
                },
              },
              required: ['date', 'calories', 'protein', 'carbs', 'fat'],
            },
          },
        },
        required: ['pastNutrition'],
      },
    },
  ];
};

/**
 * Function schema for retrospective nutrition parsing
 */
export const getParseRetrospectiveNutritionFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'parseRetrospectiveNutrition',
      description: 'Parses a natural language description of meals eaten on a specific day',
      parameters: {
        type: 'object',
        properties: {
          nutritionEntries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productTitle: {
                  type: 'string',
                  description: 'Food item name',
                },
                calories: {
                  type: 'number',
                },
                carbs: {
                  type: 'number',
                },
                fat: {
                  type: 'number',
                },
                protein: {
                  type: 'number',
                },
                mealType: {
                  type: 'number',
                  description: '1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack, 5=Other',
                },
                fiber: {
                  type: 'number',
                },
                sodium: {
                  type: 'number',
                },
                sugar: {
                  type: 'number',
                },
              },
              required: ['productTitle', 'calories', 'carbs', 'fat', 'protein', 'mealType'],
            },
          },
        },
        required: ['nutritionEntries'],
      },
    },
  ];
};

/**
 * Function schema for nutrition estimation from photos
 */
export const getEstimateMacrosFunctions = (
  includeBarcode: boolean = false
): FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  const properties: any = {
    name: {
      type: 'string',
      description: 'Name of the food item',
    },
    kcal: {
      type: 'number',
      description: 'Kilocalories',
    },
    kj: {
      type: 'number',
      description: 'Kilojoules',
    },
    carbs: {
      type: 'number',
      description: 'Carbohydrates in grams',
    },
    fat: {
      type: 'number',
      description: 'Fat in grams',
    },
    protein: {
      type: 'number',
      description: 'Protein in grams',
    },
    grams: {
      type: 'number',
      description: 'Total weight of the food item',
    },
  };

  if (includeBarcode) {
    properties.barcode = {
      type: 'string',
      description: 'Product barcode/EAN code if visible (8-14 digits)',
    };
  }

  return [
    {
      name: 'estimateMacros',
      description: 'Estimates macronutrients for a food item',
      parameters: {
        type: 'object',
        properties,
        required: includeBarcode
          ? ['name', 'kcal', 'kj', 'carbs', 'fat', 'protein', 'grams']
          : ['name', 'kcal', 'kj', 'carbs', 'fat', 'protein', 'grams'],
      },
    },
  ];
};
