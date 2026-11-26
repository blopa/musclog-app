// What each armed coach intention that is answered in one go does: ask the model, write the result
// to the database, and describe it as a coach reply. `useChatMessages` only decides when the
// person's own message is saved and what happens to it when an intention fails.
//
// A runner never touches the chat state. It returns the reply and its payload, or says which
// intention failed, and the hook shows the matching message.
import type { TFunction } from 'i18next';

import type {
  MealPlanPayload,
  TrackMealPayload,
  WorkoutPlanPayload,
} from '@/database/models/ChatMessage';
import { NutritionService } from '@/database/services/NutritionService';
import { resolveMealPlanMacroTargets } from '@/services/mealPlanTargets';
import {
  type ChatHistoryEntry,
  type CoachAIConfig,
  type CoachResponse,
  generateMealPlan,
  generateWorkoutPlan,
} from '@/utils/coachAI';
import { trackMeal } from '@/utils/coachMealEstimate';
import { saveBase64ImageToFile } from '@/utils/file';
import { handleError } from '@/utils/handleError';
import {
  type MealEstimateProgressLine,
  mealEstimateProgressLine,
} from '@/utils/mealEstimateProgress';
import { processMealPlanResponse } from '@/utils/nutritionAI';
import { processWorkoutPlanResponse } from '@/utils/workoutAI';

export type IntentionRun =
  | { ok: true; reply: CoachResponse; payloadJson: string }
  | { ok: false; failure: IntentionFailure };

/** Which one-go intention produced nothing; the hook turns it into its error message. */
export type IntentionFailure = 'mealPlan' | 'workoutPlan' | 'trackMeal';

/** The conversation a plan is generated from: the last few entries and the message just sent. */
export type PlanConversation = readonly ChatHistoryEntry[];

type Context = 'nutrition' | 'exercise' | 'general';

export async function runMealPlanIntention(
  aiConfig: CoachAIConfig,
  conversation: PlanConversation,
  context: Context,
  t: TFunction
): Promise<IntentionRun> {
  const mealPlan = await generateMealPlan(
    aiConfig,
    [...conversation],
    await resolveMealPlanMacroTargets(),
    context
  );
  if (!mealPlan) {
    return { ok: false, failure: 'mealPlan' };
  }

  const processed = await processMealPlanResponse(mealPlan);
  const payload: MealPlanPayload = {
    type: 'mealPlan',
    mealIds: processed.mealIds,
    count: processed.mealIds.length,
    meals: processed.meals,
  };

  return {
    ok: true,
    reply: {
      msg4User: t('coach.success.mealPlanGenerated', {
        count: processed.mealIds.length,
        description: processed.description,
      }),
      sumMsg: 'Generated meal plan',
    },
    payloadJson: JSON.stringify(payload),
  };
}

export async function runWorkoutPlanIntention(
  aiConfig: CoachAIConfig,
  conversation: PlanConversation,
  context: Context,
  t: TFunction
): Promise<IntentionRun> {
  const workoutPlan = await generateWorkoutPlan(aiConfig, [...conversation], context);
  if (!workoutPlan) {
    return { ok: false, failure: 'workoutPlan' };
  }

  // Creates the templates in the database; the payload tells the UI which ones to render.
  const processed = await processWorkoutPlanResponse(workoutPlan);
  const payload: WorkoutPlanPayload = {
    type: 'workoutPlan',
    templateIds: processed.templateIds,
    count: processed.templateIds.length,
    planId: processed.planId ?? undefined,
    planName: processed.planName,
  };

  return {
    ok: true,
    reply: {
      msg4User: t('coach.success.workoutPlanGeneratedWithName', {
        count: processed.templateIds.length,
        description: processed.description,
        planName: processed.planName,
      }),
      sumMsg: 'Generated workout plan',
    },
    payloadJson: JSON.stringify(payload),
  };
}

export async function runTrackMealIntention(
  aiConfig: CoachAIConfig,
  text: string,
  base64Image: string | undefined,
  onProgress: (line: MealEstimateProgressLine | null) => void,
  formatEnergy: (kcal: number) => string,
  t: TFunction
): Promise<IntentionRun> {
  const result = await trackMeal(aiConfig, text, base64Image, (progress) =>
    onProgress(mealEstimateProgressLine(progress))
  );
  if (!result || result.meals.length === 0) {
    return { ok: false, failure: 'trackMeal' };
  }

  // Replace the model's estimate with the stored values for every ingredient matched to a local
  // food (foodId), so the preview in the chat is what will actually be logged.
  const meals = await Promise.all(
    result.meals.map(async (meal) => ({
      ...meal,
      ingredients: await NutritionService.normalizeAiMealIngredients(meal.ingredients),
    }))
  );
  const totalCalories = Math.round(
    meals.flatMap((meal) => meal.ingredients).reduce((total, item) => total + item.kcal, 0)
  );
  // A photo that cannot be saved does not stop the meal from being offered, but it is not silent.
  const mealImageUri = base64Image
    ? await saveBase64ImageToFile(base64Image).catch((error: unknown) => {
        void handleError(error, 'chatIntentionRunners.saveMealPhoto', { showSnackbar: false });

        return undefined;
      })
    : undefined;
  const payload: TrackMealPayload = {
    type: 'trackMeal',
    meals: meals.map((meal) => ({ ...meal, was_tracked: false })),
    ...(mealImageUri ? { mealImageUri } : {}),
  };

  return {
    ok: true,
    reply: {
      msg4User: t('coach.success.trackMealReady', {
        count: meals.length,
        meals: meals.map((meal) => meal.mealType).join(', '),
        calories: formatEnergy(totalCalories),
      }),
      sumMsg: `Analyzed ${meals.length} meal(s) (${totalCalories} kcal total)`,
    },
    payloadJson: JSON.stringify(payload),
  };
}
