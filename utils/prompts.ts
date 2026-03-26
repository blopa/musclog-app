import { FunctionDeclaration } from '@google/generative-ai';
import convert, { Unit } from 'convert';
import OpenAI from 'openai';

import type { Units } from '../constants/settings';
import { User } from '../database/models';
import {
  AiCustomPromptService,
  ExerciseService,
  FoodService,
  NutritionGoalService,
  NutritionService,
  SettingsService,
  UserMetricService,
  UserService,
  WorkoutService,
  WorkoutTemplateService,
} from '../database/services';
import { kgToDisplay } from './unitConversion';
import { getWeightUnit } from './units';

export const WORDS_SOFT_LIMIT = 100;
export const BE_CONCISE_PROMPT = `Be concise and limit your message to ${WORDS_SOFT_LIMIT} words.`;

/**
 * Base system prompt for Loggy persona
 */
/**
 * Get active custom system prompts formatted for inclusion
 */
export const getActiveCustomPrompts = async (
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  try {
    const activePrompts = await AiCustomPromptService.getActivePrompts(context, 'system');
    if (activePrompts.length === 0) {
      return '';
    }
    return activePrompts.map((p) => p.content).join('\n\n');
  } catch (error) {
    console.error('[prompts] Error fetching active custom prompts:', error);
    return '';
  }
};

/**
 * Get active memories for the conversation context
 */
export const getActiveMemories = async (
  context: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  try {
    const memories = await AiCustomPromptService.getActivePrompts(context, 'memory');
    if (memories.length === 0) {
      return '';
    }

    const memoryList = memories.map((m) => `- ${m.content}`).join('\n');
    return `This is your memory about the convo with this user:\n${memoryList}`;
  } catch (error) {
    console.error('[prompts] Error fetching active memories:', error);
    return '';
  }
};

/**
 * Base system prompt for Loggy persona
 */
export const getBaseSystemPrompt = async (
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const customPrompts = await getActiveCustomPrompts(context);
  const memories = context ? await getActiveMemories(context) : '';

  const basePrompt =
    `You are Loggy, a friendly and knowledgeable personal trainer with a PhD in Exercise Science and Nutrition, embedded in the Musclog app.
Your goal is to provide expert, motivating, and practical fitness advice.

STRICT GUIDELINES:
1. TONE: Friendly, professional, and human-like. Use colloquial language and emojis naturally—don't sound like a robot.
2. LANGUAGE: You MUST respond in ${language}, even if the user speaks to you in another language.
3. SCOPE: If the user asks about topics unrelated to nutrition, health, or fitness, politely explain you are specialized only in those areas.
4. CONTENT: Provide specific exercises, sets, and reps for workouts. Prioritize safety and form.
5. CONCISE: ${BE_CONCISE_PROMPT}
6. MEMORY: If the user shares something personally significant, a specific preference, or an important milestone that should be remembered for future context, provide a brief note in the "remember_me" field.`.trim();

  let finalPrompt = basePrompt;
  if (customPrompts) {
    finalPrompt += `\n\n${customPrompts}`;
  }
  if (memories) {
    finalPrompt += `\n\n${memories}`;
  }

  return finalPrompt;
};

/**
 * One-line user profile summary for context injection
 */
export const getUserDetailsPrompt = async (
  user: User | null,
  eatingPhase?: string
): Promise<string> => {
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
    const fitnessGoalLabels: Record<string, string> = {
      hypertrophy: 'Hypertrophy (Build Muscle)',
      strength: 'Strength (Lift Heavier)',
      endurance: 'Endurance (Stamina)',
      weight_loss: 'Weight Loss (Burn Fat)',
      general: 'General Fitness',
    };
    parts.push(`fitness goal is "${fitnessGoalLabels[user.fitnessGoal] ?? user.fitnessGoal}"`);
  }

  if (user.activityLevel) {
    const activityLevelLabels: Record<number, string> = {
      1: 'Sedentary',
      2: 'Light',
      3: 'Moderate',
      4: 'Active',
      5: 'Super Active',
    };
    parts.push(`activity level is "${activityLevelLabels[user.activityLevel] ?? user.activityLevel}"`);
  }

  if (user.liftingExperience) {
    const liftingExperienceLabels: Record<string, string> = {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    };
    parts.push(`lifting experience is "${liftingExperienceLabels[user.liftingExperience] ?? user.liftingExperience}"`);
  }

  const units = await SettingsService.getUnits();
  const weightUnit = getWeightUnit(units);

  // Get and decrypt latest weight and body fat metrics
  try {
    const [latestWeight, latestBodyFat] = await Promise.all([
      UserMetricService.getLatest('weight'),
      UserMetricService.getLatest('body_fat'),
    ]);

    if (latestWeight) {
      const { value, unit: storedUnit = 'kg' } = await latestWeight.getDecrypted();

      // 1. Ensure our strings are treated as valid Units
      const fromUnit = storedUnit as Unit;
      const toUnit = weightUnit as Unit;

      // 2. Perform the conversion logic
      const finalValue = fromUnit === toUnit ? value : convert(value, fromUnit).to(toUnit);

      const displayValue = Math.round(finalValue);
      parts.push(`current weight is ${displayValue} ${weightUnit}`);
    }

    if (latestBodyFat) {
      const { value } = await latestBodyFat.getDecrypted();
      parts.push(`body fat is ${Math.round(value)}%`);
    }
  } catch (error) {
    console.warn('[prompts] Error decrypting user metrics:', error);
    // Continue without metrics if decryption fails
  }

  const summary =
    parts.length > 0 ? `The user ${parts.join(', ')}.` : 'User profile information limited.';

  return summary;
};

/** Build workout summary object from getWorkoutWithDetails result (same shape as prepareWorkoutDataForAI).
 * When units is provided: omits muscleGroup from exercises and formats totalVolume as string with unit (e.g. "5400 kg" or "11905 lbs"). */
function buildWorkoutSummaryFromDetails(
  details: {
    workoutLog: {
      workoutName: string;
      startedAt: number;
      completedAt?: number;
      totalVolume?: number;
      exhaustionLevel?: number;
      workoutScore?: number;
    };
    sets: {
      exerciseId?: string;
      reps?: number;
      weight?: number;
      partials?: number;
      repsInReserve?: number;
    }[];
    exercises: { id: string; name?: string; muscleGroup?: string }[];
  },
  units?: Units
): string {
  const { workoutLog, sets, exercises } = details;
  const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));
  const exercisesByName = new Map<string, { sets: typeof sets; exercise: (typeof exercises)[0] }>();
  for (const set of sets) {
    const exercise = exerciseMap.get(set.exerciseId ?? '');
    if (!exercise) {
      continue;
    }
    const name = exercise.name ?? 'Unknown';
    if (!exercisesByName.has(name)) {
      exercisesByName.set(name, { sets: [], exercise });
    }
    exercisesByName.get(name)!.sets.push(set);
  }

  const totalVolumeKg = workoutLog.totalVolume ?? 0;
  const totalVolumeWithUnit =
    units !== undefined
      ? `${Math.round(kgToDisplay(totalVolumeKg, units))} ${units === 'imperial' ? 'lbs' : 'kg'}`
      : totalVolumeKg;

  const workoutData = {
    title: workoutLog.workoutName,
    date: new Date(workoutLog.startedAt).toISOString(),
    duration: workoutLog.completedAt
      ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
      : 0,
    totalVolume: totalVolumeWithUnit,
    exhaustionLevel: workoutLog.exhaustionLevel,
    workoutScore: workoutLog.workoutScore,
    exercises: Array.from(exercisesByName.entries()).map(([name, data]) => {
      const base = {
        name,
        sets: data.sets.map((set) => ({
          reps: set.reps,
          weight: set.weight,
          partials: set.partials ?? 0,
          repsInReserve: set.repsInReserve ?? 0,
        })),
      };

      if (units === undefined) {
        return { ...base, muscleGroup: data.exercise.muscleGroup };
      }

      return base;
    }),
  };
  return JSON.stringify(workoutData);
}

async function buildWorkoutSummaryJson(workoutLogId: string, units?: Units): Promise<string> {
  try {
    const resolvedUnits = units ?? (await SettingsService.getUnits());
    const details = await WorkoutService.getWorkoutWithDetails(workoutLogId);
    return buildWorkoutSummaryFromDetails(details, resolvedUnits);
  } catch (error) {
    console.error('[prompts] buildWorkoutSummaryJson error:', error);
    return '{}';
  }
}

/**
 * Full chat system message with user context and recent workouts
 * Call this on chat session init to build the system message
 * Note: eatingPhase needs to be fetched from NutritionGoal separately
 */
export const getChatMessagePromptContent = async (
  language: string = 'en-US',
  eatingPhase?: string,
  context: 'nutrition' | 'exercise' | 'general' = 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let recentWorkoutsJson = '[]';
  try {
    const units = await SettingsService.getUnits();
    const recentLogs = await WorkoutService.getWorkoutHistory(undefined, 4);
    const summaries: string[] = [];
    for (const log of recentLogs) {
      const json = await buildWorkoutSummaryJson(log.id, units);
      if (json !== '{}') {
        summaries.push(json);
      }
    }
    recentWorkoutsJson = summaries.length > 0 ? '[' + summaries.join(',\n') + ']' : '[]';
  } catch (error) {
    console.error('Error fetching recent workouts for chat prompt:', error);
  }

  const sections = [
    await getBaseSystemPrompt(language, context),
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
  eatingPhase?: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let exercisesList = '[]';
  try {
    const exercises = await ExerciseService.getAllExercises();
    const list = exercises.map((e) => ({ id: e.id, name: e.name ?? '' }));
    exercisesList = JSON.stringify(list, null, 2);
  } catch (error) {
    console.error('Error fetching exercises for workout plan prompt:', error);
  }

  return [
    await getBaseSystemPrompt(language, context),
    "Generate a workout plan with exercises, reps, sets, and percentages of 1 rep max based on the user's fitness goals, activity level, weight, height and available equipment.",
    "If you can't infer what workout the user wants you to generate from the messages, simply generate a basic weekly workout plan, like a 3-day split.",
    'You MUST only use exercises from the list below. For each exercise in your plan, return the exact "id" from this list (do not invent IDs).',
    `Available exercises (id, name):`,
    '```json',
    exercisesList,
    '```',
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
  eatingPhase?: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  // Fetch nutrition data via NutritionService
  // Format as: { date, calories, protein, carbs, fat }[]
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  let nutritionData = '[]';
  try {
    const logs = await NutritionService.getNutritionLogsForDateRange(startDateObj, endDateObj);

    // Group logs by date and calculate daily totals
    const dailyNutritionMap = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >();

    for (const log of logs) {
      try {
        const nutrients = await log.getNutrients();
        const dateKey = new Date(log.date ?? Date.now()).toISOString().split('T')[0]; // YYYY-MM-DD format

        const existing = dailyNutritionMap.get(dateKey) || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        };

        dailyNutritionMap.set(dateKey, {
          calories: existing.calories + nutrients.calories,
          protein: existing.protein + nutrients.protein,
          carbs: existing.carbs + nutrients.carbs,
          fat: existing.fat + nutrients.fat,
        });
      } catch (error) {
        console.error('Error getting nutrients for log:', error);
        continue;
      }
    }

    // Convert to array format and sort by date
    const nutritionArray = Array.from(dailyNutritionMap.entries())
      .map(([date, nutrition]) => ({
        date,
        ...nutrition,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    nutritionData = JSON.stringify(nutritionArray, null, 2);
  } catch (error) {
    console.error('Error fetching nutrition data:', error);
    nutritionData = '[]'; // Fallback to empty array
  }

  let metricsData = '[]';
  try {
    const startTs = startDateObj.getTime();
    const endTs = endDateObj.getTime();
    const [weightMetrics, bodyFatMetrics] = await Promise.all([
      UserMetricService.getMetricsHistory('weight', { startDate: startTs, endDate: endTs }),
      UserMetricService.getMetricsHistory('body_fat', { startDate: startTs, endDate: endTs }),
    ]);
    const byDate = new Map<string, { weight?: number; fatPercentage?: number }>();
    for (const m of weightMetrics) {
      const { value } = await m.getDecrypted();
      const dateKey = new Date(m.date).toISOString().split('T')[0];
      const existing = byDate.get(dateKey) ?? {};
      byDate.set(dateKey, { ...existing, weight: value });
    }
    for (const m of bodyFatMetrics) {
      const { value } = await m.getDecrypted();
      const dateKey = new Date(m.date).toISOString().split('T')[0];
      const existing = byDate.get(dateKey) ?? {};
      byDate.set(dateKey, { ...existing, fatPercentage: value });
    }
    const metricsArray = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
    metricsData = JSON.stringify(metricsArray, null, 2);
  } catch (error) {
    console.error('Error fetching user metrics for nutrition prompt:', error);
  }

  const diffInDays = Math.floor(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return [
    await getBaseSystemPrompt(language, context),
    `Please provide insights about the user's nutrition in these ${diffInDays} days range, like if they are eating enough protein, if they are consuming too many calories, etc. Base your analysis on their goal, eating phase, and activity level.`,
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
 * System prompt for critiquing a single meal
 */
export const getMealCritiquePrompt = async (
  mealType: string,
  foods: { name: string; gramWeight: number }[],
  totals: { calories: number; protein: number; carbs: number; fat: number },
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const nutritionGoal = await NutritionGoalService.getCurrent();
  const eatingPhase = nutritionGoal?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhase);

  let heightInfo = '';
  try {
    const latestHeight = await UserMetricService.getLatest('height');
    if (latestHeight) {
      const { value, unit: storedUnit } = await latestHeight.getDecrypted();
      heightInfo = `User height: ${Math.round(value)} ${storedUnit ?? 'cm'}`;
    }
  } catch {
    // height not available
  }

  let nutritionGoalInfo = '';
  if (nutritionGoal) {
    nutritionGoalInfo = [
      'Daily nutrition targets:',
      `- Calories: ${nutritionGoal.totalCalories} kcal`,
      `- Protein: ${nutritionGoal.protein}g`,
      `- Carbs: ${nutritionGoal.carbs}g`,
      `- Fat: ${nutritionGoal.fats}g`,
    ].join('\n');
  }

  const foodList = foods.map((f) => `- ${f.name}: ${Math.round(f.gramWeight)}g`).join('\n');

  return [
    await getBaseSystemPrompt(language, context),
    `The user wants feedback on their ${mealType} meal.`,
    userDetails,
    heightInfo,
    nutritionGoalInfo,
    `Meal to give feedback: ${mealType}`,
    'Foods in the meal:',
    foodList,
    `Combined totals: Calories ${Math.round(totals.calories)} kcal | Protein ${Math.round(totals.protein)}g | Carbs ${Math.round(totals.carbs)}g | Fat ${Math.round(totals.fat)}g`,
    "Please provide a concise, constructive critique of this meal. Comment on nutritional balance, macro distribution relative to the user's daily targets and goals, and give 1–2 practical suggestions to improve it. Be encouraging and positive.",
  ]
    .filter(Boolean)
    .join('\n');
};

/**
 * System prompt for recent workouts insights
 */
export const getRecentWorkoutsInsightsPrompt = async (
  startDate: string,
  endDate: string,
  language: string = 'en-US',
  eatingPhase?: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let workoutsJson = '[]';
  try {
    const units = await SettingsService.getUnits();
    const startTs = new Date(startDate).setUTCHours(0, 0, 0, 0);
    const endTs = new Date(endDate).setUTCHours(23, 59, 59, 999);
    const logs = await WorkoutService.getWorkoutHistory({ startDate: startTs, endDate: endTs });
    const summaries: string[] = [];
    for (const log of logs) {
      const json = await buildWorkoutSummaryJson(log.id, units);
      if (json !== '{}') {
        summaries.push(json);
      }
    }
    workoutsJson = summaries.length > 0 ? '[' + summaries.join(',\n') + ']' : '[]';
  } catch (error) {
    console.error('Error fetching recent workouts for insights prompt:', error);
  }

  const diffInDays = Math.floor(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return [
    await getBaseSystemPrompt(language, context),
    `Please provide insights about the user's workouts in these ${diffInDays} days range, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.`,
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
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let pastOccurrencesJson = '[]';
  try {
    const units = await SettingsService.getUnits();
    const logs = await WorkoutService.getWorkoutLogsByWorkoutName(workoutTitle);
    const summaries: string[] = [];
    for (const log of logs) {
      const json = await buildWorkoutSummaryJson(log.id, units);
      if (json !== '{}') {
        summaries.push(json);
      }
    }
    pastOccurrencesJson = summaries.length > 0 ? '[' + summaries.join(',\n') + ']' : '[]';
  } catch (error) {
    console.error('Error fetching past occurrences for volume prompt:', error);
  }

  return [
    await getBaseSystemPrompt(language),
    // TODO: use the same as the other functions, and have an array that is joined
    `The user just completed a "${workoutTitle}" workout. Your task is to:
1. Congratulate them and give specific feedback on their performance (check difficulty level 1-10, rest times, exhaustion level 1-10, workout score 1-10)
2. Calculate the volume for the next workout session using an average of these formulas: Epley, Brzycki, Lander, Lombardi, Mayhew, O'Connor, and Wathan
3. Volume doesn't always mean increases - suggest adjustments based on the data and their goals`,
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
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let workoutJson = '{}';
  try {
    const template = await WorkoutTemplateService.getTemplateByName(workoutTitle);
    if (template) {
      const {
        template: t,
        templateExercises,
        sets,
      } = await WorkoutTemplateService.getTemplateWithDetails(template.id);
      const exerciseIds = [...new Set(templateExercises.map((te) => te.exerciseId))];
      const exercises =
        exerciseIds.length > 0
          ? await ExerciseService.getAllExercises().then((all) =>
              all.filter((e) => exerciseIds.includes(e.id))
            )
          : [];
      const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
      const setsByTe = new Map<string, typeof sets>();
      for (const s of sets) {
        if (!setsByTe.has(s.templateExerciseId)) {
          setsByTe.set(s.templateExerciseId, []);
        }
        setsByTe.get(s.templateExerciseId)!.push(s);
      }
      const exercisesForJson = templateExercises.map((te) => {
        const exercise = exerciseMap.get(te.exerciseId);
        const setList = setsByTe.get(te.id) ?? [];
        return {
          name: exercise?.name ?? 'Unknown',
          muscleGroup: exercise?.muscleGroup,
          sets: setList.length,
          targetReps: setList.map((s) => s.targetReps),
          targetWeight: setList.map((s) => s.targetWeight),
        };
      });
      workoutJson = JSON.stringify(
        {
          name: t.name,
          description: t.description,
          exercises: exercisesForJson,
        },
        null,
        2
      );
    }
  } catch (error) {
    console.error('Error fetching workout template for insights prompt:', error);
  }

  return [
    await getBaseSystemPrompt(language),
    `Please provide insights about the user's "${workoutTitle}" workout, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.`,
    userDetails,
    'Workout details:',
    '```json',
    workoutJson,
    '```',
  ].join('\n');
};

/**
 * System prompt for single recent workout insights.
 * When workoutJson is provided (e.g. from getRecentWorkoutInsightsPromptByLogId), it is used; otherwise placeholder.
 */
export const getRecentWorkoutInsightsPrompt = async (
  workoutTitle: string,
  language: string = 'en-US',
  eatingPhase?: string,
  workoutJson?: string
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  const resolvedJson = workoutJson ?? '{}';

  return [
    await getBaseSystemPrompt(language),
    `Please provide insights and feedback about the user's recent "${workoutTitle}" workout performance, including volume, exercise selection, rest times, and effort level.`,
    userDetails,
    'Completed workout:',
    '```json',
    resolvedJson,
    '```',
  ].join('\n');
};

/**
 * Build system prompt for single recent workout insights by workout log id (fetches workout and injects JSON).
 */
export const getRecentWorkoutInsightsPromptByLogId = async (
  workoutLogId: string,
  language: string = 'en-US',
  eatingPhase?: string
): Promise<string> => {
  const details = await WorkoutService.getWorkoutWithDetails(workoutLogId);
  const units = await SettingsService.getUnits();
  const workoutJson = buildWorkoutSummaryFromDetails(details, units);
  return getRecentWorkoutInsightsPrompt(
    details.workoutLog.workoutName,
    language,
    eatingPhase,
    workoutJson
  );
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
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  let historyJson = '[]';
  try {
    const units = await SettingsService.getUnits();
    const logs = await WorkoutService.getWorkoutLogsByWorkoutName(workoutTitle);
    const summaries: string[] = [];
    for (const log of logs) {
      const json = await buildWorkoutSummaryJson(log.id, units);
      if (json !== '{}') {
        summaries.push(json);
      }
    }
    historyJson = summaries.length > 0 ? '[' + summaries.join(',\n') + ']' : '[]';
  } catch (error) {
    console.error('Error fetching workout volume history for prompt:', error);
  }

  return [
    await getBaseSystemPrompt(language),
    `Analyze the volume trend for the user's "${workoutTitle}" workout over time. Identify patterns, recommend adjustments, and assess progress.`,
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
export const getParsePastWorkoutsPrompt = async (
  userMessage: string,
  exerciseNames: string[],
  language: string = 'en-US'
): Promise<string> => {
  return [
    await getBaseSystemPrompt(language),
    "Parse past workouts from the user's text description. Try to match exercise names to the provided list.",
    `If too long, only parse the first 20 workouts. Available exercises: ${exerciseNames.join(', ')}`,
    `User's message:\n${userMessage}`,
  ].join('\n');
};

/**
 * System prompt for parsing past nutrition from natural language
 */
export const getParsePastNutritionPrompt = async (
  userMessage: string,
  language: string = 'en-US'
): Promise<string> => {
  return [
    await getBaseSystemPrompt(language),
    "Parse past nutrition data from the user's text into structured entries. Parse up to 20 entries.",
    'Extract: date, calories, protein, carbs, fat, fiber, and other macronutrients if available.',
    `User's message:\n${userMessage}`,
  ].join('\n');
};

/**
 * System prompt for retrospective nutrition logging
 */
export const getRetrospectiveNutritionPrompt = async (
  targetDate: string,
  userMessage: string,
  language: string = 'en-US'
): Promise<string> => {
  return [
    await getBaseSystemPrompt(language),
    `The user wants to log nutrition data for ${targetDate}. Break down their natural language description into individual food items.`,
    'Categorize each item by meal type: 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack.',
    'Estimate reasonable portions and nutritional values based on common serving sizes.',
    `User's description:\n${userMessage}`,
  ].join('\n');
};

const MACRO_CALORIE_NOTE =
  'Keep in mind the relation between macros and calories: 1g protein ≈ 4 kcal, 1g carbs ≈ 4 kcal, 1g fat ≈ 9 kcal, 1g fiber ≈ 2 kcal. Ensure your kcal estimate is consistent with the macros you return.';

/**
 * Get the foundation foods prompt part
 */
export const getFoundationFoodsPrompt = async (): Promise<string> => {
  try {
    const foundationFoods = await FoodService.getFoundationFoods(200);
    if (foundationFoods.length === 0) {
      return '';
    }

    const foodList = foundationFoods.map((f) => ({
      id: f.id,
      name: f.name,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
    }));

    return [
      'You MUST prioritize matching ingredients to the "foundation foods" provided in the list below.',
      'If an ingredient matches a foundation food, return its exact "foodId" from the list and the estimated "grams". When "foodId" is provided, you still need to provide the name, but you can omit or provide 0 for kcal, protein, carbs, fat and fiber as they will be fetched from the database using the "foodId".',
      'If no foundation food is a good match, return the ingredient with its full macronutrients (kcal, protein, carbs, fat, fiber, grams) and leave "foodId" null or omit it.',
      'Foundation Foods List (macros per 100g):',
      '```json',
      JSON.stringify(foodList, null, 2),
      '```',
    ].join('\n');
  } catch (error) {
    console.error('[prompts] Error fetching foundation foods:', error);
    return '';
  }
};

/**
 * System prompt for meal tracking (text or photo)
 */
/**
 * System prompt for meal plan generation
 */
export const getGenerateMealPlanPrompt = async (
  language: string = 'en-US',
  macroTargets?: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
  eatingPhase?: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const user = await UserService.getCurrentUser();
  const eatingPhaseResolved =
    eatingPhase ?? (await NutritionGoalService.getCurrent())?.eatingPhase ?? undefined;
  const userDetails = await getUserDetailsPrompt(user, eatingPhaseResolved);

  const macroContext = macroTargets
    ? `The user's daily nutrition targets are: ${macroTargets.calories} kcal, ${macroTargets.protein}g protein, ${macroTargets.carbs}g carbs, ${macroTargets.fat}g fat, ${macroTargets.fiber}g fiber.`
    : '';

  return [
    await getBaseSystemPrompt(language, context),
    'Generate a custom 3-day meal plan with 4 meals per day (breakfast, lunch, dinner, and snack).',
    "Each meal should be balanced and align with the user's nutritional goals and fitness level.",
    'For each meal, provide a name, a brief description, and a list of ingredients with their macronutrients.',
    macroContext,
    userDetails,
    `Your response must be in ${language}.`,
  ].join('\n');
};

export const getTrackMealPrompt = async (
  language: string = 'en-US',
  includeFoundationFoods: boolean = false
): Promise<string> => {
  const foundationPrompt = includeFoundationFoods ? await getFoundationFoodsPrompt() : '';
  const sections = [
    'You are an expert nutritionist with extensive knowledge of food composition and recipe breakdown.',
    "Analyze ALL meals and snacks mentioned in the user's message or photo.",
    'Group ingredients by meal type (breakfast, lunch, dinner, snack). If the user only describes one meal, return a single-item meals array.',
    'You MUST break down dishes into their individual ingredients (e.g., instead of "Pizza", return "Pizza Dough", "Tomato Sauce", "Mozzarella Cheese", etc.).',
    'For each ingredient, estimate the macronutrients (calories, protein, carbs, fat, fiber) based on a reasonable portion size for that specific meal.',
    'Be as accurate as possible. If a photo is provided, use it to judge portions.',
  ];

  if (foundationPrompt) {
    sections.push(foundationPrompt);
  }

  sections.push(
    MACRO_CALORIE_NOTE,
    `Your response must be in ${language}.`,
    'Return the data as a structured list of meals, each with their mealType and ingredients.'
  );

  return sections.join('\n');
};

/**
 * System prompt for meal photo nutrition estimation
 */
export const getEstimateNutritionFromPhotoPrompt = async (
  includeFoundationFoods: boolean = false
): Promise<string> => {
  const foundationPrompt = includeFoundationFoods ? await getFoundationFoodsPrompt() : '';
  const sections = [
    'You are an expert nutritionist with extensive knowledge of food composition.',
    'Analyze the provided food photo and estimate the macronutrients.',
    'You MUST break down dishes into their individual ingredients (e.g., instead of "Pizza", return "Pizza Dough", "Tomato Sauce", "Mozzarella Cheese", etc.).',
    'Be as accurate as possible based on portion size visible in the image.',
    'If uncertain about portion size, provide estimates for a typical serving.',
  ];

  if (foundationPrompt) {
    sections.push(foundationPrompt);
  }

  sections.push(MACRO_CALORIE_NOTE, 'Return structured nutritional data.');

  return sections.join('\n');
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
    MACRO_CALORIE_NOTE,
    'Return the extracted nutritional data in structured format.',
  ].join('\n');
};

/**
 * System prompt for extracting macros from OCR text (no image).
 * Used when the app runs OCR first and sends only the text to the AI.
 */
export const getExtractMacrosFromLabelTextPrompt = (): string => {
  return [
    'You are an expert at reading and extracting data from nutrition labels.',
    'The following text was extracted by OCR from a nutrition label image. Extract all nutritional information: calories (kcal), protein, carbs, fat, fiber, sugars, sodium, etc.',
    'If a barcode or EAN code appears in the text (typically 8-14 digits), extract it as well.',
    MACRO_CALORIE_NOTE,
    'Return the extracted nutritional data in the same structured format as for label images (name, kcal, carbs, fat, protein, grams; optional barcode).',
    'Use the product name or a short description as "name" if present in the text.',
  ].join('\n');
};

/**
 * Function schema for chat message response (Gemini + OpenAI compatible)
 */
export const getSendChatMessageFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  const BE_CONCISE_PROMPT_LOCAL = `Be concise and limit your message to ${WORDS_SOFT_LIMIT} words.`;
  return [
    {
      name: 'generateMessage',
      description: "A response to a user's message with optional user summary.",
      parameters: {
        type: 'object',
        properties: {
          msg4User: {
            type: 'string',
            description: `A message to be displayed to the user. ${BE_CONCISE_PROMPT_LOCAL}`,
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
          remember_me: {
            type: 'string',
            description: 'A short sentence with something important to remember about the user.',
          },
        },
        required: ['msg4User', 'sumMsg', 'sumUserMsg'],
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
                  description:
                    'List of exercises in this workout. Use the exact exercise id from the available exercises list.',
                  items: {
                    type: 'object',
                    properties: {
                      exerciseId: {
                        type: 'string',
                        description:
                          'The exact id of the exercise from the available exercises list (required)',
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
                    required: ['exerciseId', 'reps', 'sets', 'oneRepMaxPercentage'],
                  },
                },
              },
              required: ['title', 'description', 'recurringOnWeekDay', 'exercises'],
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
                          required: ['reps', 'weight'],
                        },
                      },
                    },
                    required: ['name', 'muscleGroup', 'type', 'sets'],
                  },
                },
              },
              required: ['title', 'date', 'duration', 'description', 'exercises'],
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
              required: [
                'date',
                'calories',
                'protein',
                'carbs',
                'fat',
                'fiber',
                'sugar',
                'sodium',
                'cholesterol',
              ],
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
              required: [
                'productTitle',
                'calories',
                'carbs',
                'fat',
                'protein',
                'mealType',
                'fiber',
                'sodium',
                'sugar',
              ],
            },
          },
        },
        required: ['nutritionEntries'],
      },
    },
  ];
};

/**
 * Function schema for meal tracking with multiple ingredients
 */
/**
 * Function schema for meal plan generation
 */
export const getGenerateMealPlanFunctions = ():
  | FunctionDeclaration[]
  | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  return [
    {
      name: 'generateMealPlan',
      description: 'Generates a 3-day meal plan with 4 meals per day',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A brief encouraging description of the meal plan',
          },
          meals: {
            type: 'array',
            description: 'List of meals for the 3-day plan',
            items: {
              type: 'object',
              properties: {
                day: { type: 'number', description: 'Day number (1, 2, or 3)' },
                mealType: {
                  type: 'string',
                  enum: ['breakfast', 'lunch', 'dinner', 'snack'],
                },
                name: { type: 'string', description: 'Name of the meal' },
                description: { type: 'string', description: 'Brief description of the meal' },
                ingredients: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      kcal: { type: 'number' },
                      carbs: { type: 'number' },
                      fat: { type: 'number' },
                      protein: { type: 'number' },
                      fiber: { type: 'number' },
                      grams: { type: 'number' },
                    },
                    required: ['name', 'kcal', 'carbs', 'fat', 'protein', 'fiber', 'grams'],
                  },
                },
              },
              required: ['day', 'mealType', 'name', 'description', 'ingredients'],
            },
          },
        },
        required: ['meals', 'description'],
      },
    },
  ];
};

export const getTrackMealFunctions = (
  includeFoundationFoods: boolean = false
): FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  const ingredientProperties: any = {
    name: {
      type: 'string',
      description: 'Name of the ingredient (e.g., "Basmati Rice", "Chicken Breast")',
    },
    kcal: { type: 'number', description: 'Kilocalories' },
    carbs: { type: 'number', description: 'Carbohydrates in grams' },
    fat: { type: 'number', description: 'Fat in grams' },
    protein: { type: 'number', description: 'Protein in grams' },
    fiber: { type: 'number', description: 'Fiber in grams' },
    grams: { type: 'number', description: 'Estimated weight of this ingredient in grams' },
  };

  const ingredientRequired = ['name', 'kcal', 'carbs', 'fat', 'protein', 'fiber', 'grams'];

  if (includeFoundationFoods) {
    ingredientProperties.foodId = {
      type: 'string',
      description: 'The local ID of the matched foundation food from the provided list.',
    };
  }

  const ingredientSchema = {
    type: 'object',
    properties: ingredientProperties,
    required: ingredientRequired,
  };

  return [
    {
      name: 'trackMeal',
      description:
        'Break down one or more meals into their ingredients and estimate macronutrients. Group ingredients by meal type.',
      parameters: {
        type: 'object',
        properties: {
          meals: {
            type: 'array',
            description: 'List of meals identified in the message. Use one entry per meal type.',
            items: {
              type: 'object',
              properties: {
                mealType: {
                  type: 'string',
                  enum: ['breakfast', 'lunch', 'dinner', 'snack'],
                  description: 'Type of meal',
                },
                ingredients: {
                  type: 'array',
                  description: 'List of ingredients in this meal',
                  items: ingredientSchema,
                },
              },
              required: ['mealType', 'ingredients'],
            },
          },
        },
        required: ['meals'],
      },
    },
  ];
};

/**
 * Function schema for nutrition estimation from photos
 */
export const getEstimateMacrosFunctions = (
  includeBarcode: boolean = false,
  includeFoundationFoods: boolean = false
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
    fiber: {
      type: 'number',
      description: 'Fiber in grams',
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

  if (includeFoundationFoods) {
    properties.foodId = {
      type: 'string',
      description: 'The local ID of the matched foundation food from the provided list.',
    };
  }

  const required = ['name', 'kcal', 'carbs', 'fat', 'protein', 'fiber', 'grams'];
  if (includeBarcode) {
    required.push('barcode');
  }

  return [
    {
      name: 'estimateMacros',
      description: 'Estimates macronutrients for a food item',
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  ];
};
