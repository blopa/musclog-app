import { NutritionService } from '@/database/services/NutritionService';

import { reviewAndRevise, runSamples, sameValue } from './aiPasses';
import { THINKING_PIPELINE, type ThinkingLevel } from './aiThinkingLevel';
import {
  type CoachAIConfig,
  reportAiError,
  type TrackedMeal,
  type TrackMealResponse,
} from './coachAI';
import {
  bestEffort,
  countMealProblems,
  observeMeal,
  reportMealProgress,
  reviewTrackedMeal,
  trackMealVerified,
} from './coachMealSteps';
import { consensusMeals, mealStageIsSettled } from './mealConsensus';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import type { MealImage } from './mealImages';
import type { MealObservation } from './mealObservation';
import { providerPolicyFor } from './providerPolicy';

/**
 * The numbers of an ingredient that kept a food id are that food's own, at the grams the readings
 * agreed on. The averaging takes medians over every reading, including readings that estimated the
 * same food instead of matching it, so the matched foods are read from the database again.
 */
async function withFoodNumbers(response: TrackMealResponse): Promise<TrackMealResponse> {
  const meals = await Promise.all(
    response.meals.map(async (meal) => ({
      ...meal,
      ingredients: await NutritionService.normalizeAiMealIngredients(meal.ingredients),
    }))
  );

  return { ...response, meals };
}

/** One answered sample: the look it read (-1 for none) and whether it needed the plausibility recheck. */
type Sample = { answer: TrackMealResponse; look: number; rechecked: boolean };

/**
 * The meal estimate of High and Tokenmaxxing. Samples of the verified path (Tokenmaxxing runs
 * several and code keeps what most of them agree on), then rounds of review: the model, shown the
 * estimate beside the description or photo, names what is missing or off, code applies it and
 * estimates what was added, and the result replaces the estimate only when it has no more
 * implausible figures than before. Medium is one sample and no review: the verified path itself.
 */
export async function trackMealThinking(
  config: CoachAIConfig,
  level: ThinkingLevel,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  const pipeline = THINKING_PIPELINE[level];
  // A small model invents detail when asked to describe, so it has no first look.
  const mealLooks = providerPolicyFor(config).skipsMealFirstLook ? null : pipeline.mealLooks;
  const perLook = mealLooks?.samplesPerLook ?? 1;
  const looks: MealObservation[] = [];
  const samples: Sample[] = [];

  // Each first look is its own request, so a mistake in one never reaches every sample. A look that
  // fails or reads as nothing is left out: an extra request can only help, never fail the estimate.
  const takeLooks = (count: number) =>
    bestEffort(
      'coachAI.observeMeal',
      async () => {
        reportMealProgress(onProgress, {
          step: 'observing',
          photo: images.length > 0,
          photoCount: images.length,
        });

        return runSamples(config, count, () => observeMeal(config, userMessage, images), {
          onDroppedFailure: (error) => reportAiError(error, 'coachAI.observeMeal'),
        });
      },
      (): MealObservation[] => []
    );

  // `count` verified samples; sample `i` reads look `floor(i / perLook)` of `stageLooks` (none: the
  // plain estimate). `runSamples` leaves failed samples out. Only the first sample reports its
  // steps: several at once would interleave their lines.
  const takeStage = async (stageLooks: MealObservation[], firstLook: number, count: number) => {
    const answered = await runSamples(
      config,
      count,
      async (index): Promise<Sample | null> => {
        const look = stageLooks.length > 0 ? Math.floor(index / perLook) : -1;
        const verified = await trackMealVerified(
          config,
          userMessage,
          images,
          index === 0 ? onProgress : undefined,
          look >= 0 ? stageLooks[look] : undefined
        );

        return verified
          ? {
              answer: verified.response,
              look: look >= 0 ? firstLook + look : -1,
              rechecked: verified.rechecked,
            }
          : null;
      },
      {
        onDroppedFailure: (error) => reportAiError(error, 'coachAI.trackMealSample'),
      }
    );
    samples.push(...answered);

    return answered;
  };

  // Looks come in stages. A level that exits early takes ONE look and the samples that read it first;
  // when they agree and nothing flags doubt (the look lists nothing uncertain, no sample needed the
  // plausibility recheck) the estimate is stable and the remaining looks are never made. Anything
  // else (an unsettled stage, a look that failed or read as nothing, samples that all failed) goes
  // on to the remaining looks and their samples.
  const stages = mealLooks
    ? (pipeline.earlyExit ? [1, mealLooks.looks - 1] : [mealLooks.looks]).filter((n) => n > 0)
    : [];
  for (const count of stages) {
    const stageLooks = await takeLooks(count);
    if (stageLooks.length === 0) {
      continue;
    }

    const firstLook = looks.length;
    looks.push(...stageLooks);
    const stage = await bestEffort(
      'coachAI.trackMealStage',
      () => takeStage(stageLooks, firstLook, stageLooks.length * perLook),
      (): Sample[] => []
    );
    const settled =
      pipeline.earlyExit &&
      stageLooks.length === 1 &&
      mealStageIsSettled({
        samples: stage.map((item) => item.answer),
        look: stageLooks[0],
        rechecked: stage.map((item) => item.rechecked),
      });
    if (settled) {
      break;
    }
  }

  if (samples.length === 0) {
    // No look read anything (or the level has none): the plain estimate, as at every level.
    await takeStage([], 0, pipeline.samples);
  }

  if (samples.length === 0) {
    return null;
  }

  let draft = samples[0].answer;
  if (samples.length > 1) {
    reportMealProgress(onProgress, { step: 'comparing', count: samples.length });
    draft = await withFoodNumbers(
      consensusMeals(
        samples.map((item) => item.answer),
        looks.length > 1 ? samples.map((item) => item.look) : undefined
      )
    );
  }

  if (pipeline.reviewRounds === 0) {
    return draft;
  }

  return reviewAndRevise<TrackMealResponse>({
    draft,
    rounds: pipeline.reviewRounds,
    critique: async (current) => {
      reportMealProgress(onProgress, { step: 'reviewing' });
      const meals: TrackedMeal[] = [];
      for (const meal of current.meals) {
        meals.push(await reviewTrackedMeal(config, meal, userMessage, images, onProgress));
      }

      return { ...current, meals };
    },
    accept: (current, revised) => countMealProblems(revised) <= countMealProblems(current),
    onError: (error) => reportAiError(error, 'coachAI.reviewTrackedMeal'),
    isUnchanged: pipeline.earlyExit ? sameValue : undefined,
  });
}
