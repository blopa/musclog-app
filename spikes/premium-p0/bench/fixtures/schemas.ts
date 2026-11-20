// REAL schemas and prompts, copied read-only from the Musclog app (do not "improve" them here: the
// benchmark must measure what the app actually sends). Sources, all in the repo root:
//   - trackMeal schema:       getTrackMealFunctions()         in utils/prompts.ts (includeFoundationFoods = false)
//   - estimateMacros schema:  getEstimateMacrosFunctions(true) in utils/prompts.ts
//   - workout plan schema:    getGenerateWorkoutPlanFunctions() in utils/prompts.ts
//   - coach_response schema:  buildResponseSchema(true) in utils/coachAI.ts (sendViaOpenAI, includeUserSummary)
//   - strictness:             makeSchemaStrict() in utils/coachAI.ts (adds additionalProperties:false to objects)
//   - meal photo request:     estimateNutritionFromPhoto() -> generateWithImageStructured() in utils/coachAI.ts
//                             (system = getMealAnalysisPrompt(), user text = 'Analyze this image and return the structured data.',
//                              image as an image_url data URL, response_format json_schema strict)
//   - label photo request:    extractMacrosFromLabelPhoto() in utils/coachAI.ts, prompt getExtractMacrosFromLabelPrompt()
// NOTE: the app lists every property in `required` itself; makeSchemaStrict does not populate it.

export type JsonSchema = Record<string, any>;

export const MACRO_CALORIE_NOTE =
  'Keep in mind the relation between macros and calories: 1g protein ≈ 4 kcal, 1g carbs ≈ 4 kcal, 1g fat ≈ 9 kcal, 1g fiber ≈ 2 kcal. Ensure your kcal estimate is consistent with the macros you return.';

// utils/prompts.ts getMealAnalysisPrompt(false)
export const MEAL_ANALYSIS_PROMPT = [
  'You are an expert nutritionist with extensive knowledge of food composition and recipe breakdown.',
  "Analyze ALL meals and snacks mentioned in the user's message or photo.",
  'Group ingredients by meal type (breakfast, lunch, dinner, snack). If the user only describes one meal, return a single-item meals array.',
  'You MUST break down dishes into their individual ingredients (e.g., instead of "Pizza", return "Pizza Dough", "Tomato Sauce", "Mozzarella Cheese", etc.).',
  'For each ingredient, estimate the macronutrients (calories, protein, carbs, fat, fiber) based on a reasonable portion size for that specific meal.',
  'Be as accurate as possible. If a photo is provided, use it to judge portions.',
  MACRO_CALORIE_NOTE,
  'Return the data as a structured list of meals, each with their mealType and ingredients.',
].join('\n');

// utils/prompts.ts getExtractMacrosFromLabelPrompt()
export const LABEL_PROMPT = [
  'You are an expert at reading and extracting data from nutrition labels.',
  'Use OCR to read all text from the provided nutrition label image.',
  'Extract all nutritional information: calories, protein, carbs, fat, fiber, sugars, sodium, etc.',
  'If a barcode or EAN code is visible (typically 8-14 digits), extract it as well.',
  MACRO_CALORIE_NOTE,
  'Return the extracted nutritional data in structured format.',
].join('\n');

// utils/coachAI.ts generateWithImageStructured(): user text for images
export const IMAGE_USER_TEXT = 'Analyze this image and return the structured data.';

export const TRACK_MEAL_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      description: 'List of meals identified in the message. Use one entry per meal type.',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Type of meal' },
          mealName: {
            type: 'string',
            description:
              'The name of the dish or meal (e.g. "Butter Chicken", "Caesar Salad"). Use the specific dish name, not the meal type.',
          },
          ingredients: {
            type: 'array',
            description: 'List of ingredients in this meal',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the ingredient (e.g., "Basmati Rice", "Chicken Breast")' },
                kcal: { type: 'number', description: 'Kilocalories' },
                carbs: { type: 'number', description: 'Carbohydrates in grams' },
                fat: { type: 'number', description: 'Fat in grams' },
                protein: { type: 'number', description: 'Protein in grams' },
                fiber: { type: 'number', description: 'Fiber in grams' },
                grams: { type: 'number', description: 'Estimated weight of this ingredient in grams' },
              },
              required: ['name', 'kcal', 'carbs', 'fat', 'protein', 'fiber', 'grams'],
            },
          },
        },
        required: ['mealType', 'mealName', 'ingredients'],
      },
    },
  },
  required: ['meals'],
};

export const ESTIMATE_MACROS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name of the food item' },
    kcal: { type: 'number', description: 'Kilocalories' },
    carbs: { type: 'number', description: 'Carbohydrates in grams' },
    fat: { type: 'number', description: 'Fat in grams' },
    protein: { type: 'number', description: 'Protein in grams' },
    fiber: { type: 'number', description: 'Fiber in grams' },
    grams: { type: 'number', description: 'Total weight of the food item' },
    barcode: { type: 'string', description: 'Product barcode/EAN code if visible (8-14 digits)' },
  },
  required: ['name', 'kcal', 'carbs', 'fat', 'protein', 'fiber', 'grams', 'barcode'],
};

export const WORKOUT_PLAN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    planTitle: { type: 'string', description: 'Name of the plan as a whole (for example "Push Pull Legs"), not one workout' },
    description: { type: 'string', description: 'A brief description of the workout plan to show the user' },
    workoutPlan: {
      type: 'array',
      description: 'Array of individual workouts in the plan',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Workout name (e.g., "Push Day", "Leg Day")' },
          description: { type: 'string', description: 'Brief description of the workout focus' },
          recurringOnWeekDay: { type: 'string', description: 'Day of week: "monday", "tuesday", etc.' },
          exercises: {
            type: 'array',
            description: 'List of exercises in this workout. Use the exact exercise id from the available exercises list.',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                exerciseId: { type: 'string', description: 'The exact id of the exercise from the available exercises list (required)' },
                reps: { type: 'number', description: 'Target number of reps per set' },
                sets: { type: 'number', description: 'Number of sets to perform' },
                oneRepMaxPercentage: { type: 'number', description: 'Percentage of estimated 1RM to use (e.g., 75 for 75%)' },
              },
              required: ['exerciseId', 'reps', 'sets', 'oneRepMaxPercentage'],
            },
          },
        },
        required: ['title', 'description', 'recurringOnWeekDay', 'exercises'],
      },
    },
  },
  required: ['planTitle', 'workoutPlan', 'description'],
};

// utils/coachAI.ts buildResponseSchema(true)
export const COACH_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    msg4User: { type: 'string', description: 'The full response to display to the user in the chat.' },
    sumMsg: {
      type: 'string',
      description:
        'A shortened version of msg4User trimmed to 1-2 sentences. Keep the same first-person voice and key points — write it as you would say it, not as a description of what you said.',
    },
    sumUserMsg: {
      type: 'string',
      description:
        "A shortened version of the user's message trimmed to 1 sentence. Keep their voice and key intent — write it as they would say it, not as a description of what they said.",
    },
    remember_me: { type: 'string', description: 'A short sentence with something important to remember about the user.' },
  },
  required: ['msg4User', 'sumMsg', 'sumUserMsg'],
};

// utils/coachAI.ts makeSchemaStrict()
export function makeSchemaStrict(schema: any): any {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (schema.type === 'object') {
    const properties: Record<string, any> = schema.properties ? { ...schema.properties } : {};
    for (const key of Object.keys(properties)) properties[key] = makeSchemaStrict(properties[key]);
    return { ...schema, properties, additionalProperties: false };
  }
  if (schema.type === 'array' && schema.items) return { ...schema, items: makeSchemaStrict(schema.items) };
  return schema;
}

// Short stand-in for createWorkoutPlanPrompt() (utils/prompts.ts), which builds its exercise list from the
// user's database. The ids below are the free-exercise-db slugs the bundled catalogue uses.
export const WORKOUT_PLAN_SYSTEM = [
  'You are an expert strength coach. Create a complete workout plan for the user.',
  'Use ONLY exercise ids from this list: fx-barbell-bench-press, fx-barbell-squat, fx-deadlift, fx-overhead-press, fx-pull-up, fx-barbell-row, fx-dumbbell-curl, fx-triceps-pushdown, fx-leg-press, fx-lateral-raise, fx-romanian-deadlift, fx-lat-pulldown.',
  'User: 29 years old, intermediate lifter, 4 days per week available, goal hypertrophy, metric units.',
].join('\n');
export const WORKOUT_PLAN_USER = 'Create a 4 day upper/lower workout plan for me.';

export const COACH_SYSTEM =
  'You are Loggy, a concise, friendly fitness and nutrition coach inside a tracking app. Answer in the language of the user. Keep answers under 120 words. Respond only with the JSON object requested.';

export const COACH_MESSAGES = [
  'Hoje treinei peito e tríceps, mas estou com dor no ombro direito. Devo continuar com supino na próxima semana?',
  'I ate 2800 kcal yesterday while cutting at 2200. Should I skip dinner today to compensate?',
  '¿Cuántas proteínas necesito al día si peso 82 kg y quiero ganar músculo?',
];

export const TRACK_MEAL_MESSAGES = [
  'Breakfast: two scrambled eggs, a slice of whole wheat toast with butter and a flat white with whole milk. Lunch: chicken burrito bowl with rice, black beans, salsa and guacamole.',
  'Een bord macaroni met gehakt en tomatensaus en een glas melk als avondeten.',
];

// Synthetic tool round trips (two different tools). Not an app schema: the app's functions are JSON-schema
// replies today; this checks the generic tools + tool_choice path the proxy allows (<= 32 tools).
export const TOOLS_A = [
  {
    type: 'function',
    function: {
      name: 'get_day_totals',
      description: 'Returns the calories and macros logged by the user on a day.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'ISO date, yyyy-MM-dd' } },
        required: ['date'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
export const TOOLS_B = [
  {
    type: 'function',
    function: {
      name: 'log_water',
      description: 'Logs an amount of water the user drank.',
      parameters: {
        type: 'object',
        properties: { millilitres: { type: 'number' }, note: { type: 'string' } },
        required: ['millilitres', 'note'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day_totals',
      description: 'Returns the calories and macros logged by the user on a day.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string' } },
        required: ['date'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
