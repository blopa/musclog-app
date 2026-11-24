import { AiCancelledError } from './aiErrors';
import { reviewAndRevise, runSamples, sameValue } from './aiPasses';
import { THINKING_PIPELINE, type ThinkingLevel } from './aiThinkingLevel';
import type { CoachAIConfig, TrackedMeal, TrackMealResponse } from './coachAI';
import { consensusMeals, mealStageIsSettled } from './mealConsensus';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import type { MealImage } from './mealImages';
import type { MealObservation } from './mealObservation';

type MealSamplingDependencies = {
  observeMeal: (
    config: CoachAIConfig,
    message: string,
    images: readonly MealImage[]
  ) => Promise<MealObservation | null>;
  trackMealVerified: (
    config: CoachAIConfig,
    message: string,
    images: readonly MealImage[],
    progress?: MealEstimateProgressListener,
    observation?: MealObservation,
    signals?: { rechecked: boolean }
  ) => Promise<TrackMealResponse | null>;
  reviewTrackedMeal: (
    config: CoachAIConfig,
    meal: TrackedMeal,
    message: string,
    images: readonly MealImage[],
    progress?: MealEstimateProgressListener
  ) => Promise<TrackedMeal>;
  reportAiError: (error: unknown, operation: string) => void;
  reportMealProgress: (
    progress: MealEstimateProgressListener | undefined,
    event: Parameters<MealEstimateProgressListener>[0]
  ) => void;
  countMealProblems: (response: TrackMealResponse) => number;
};

export async function trackMealThinking(
  deps: MealSamplingDependencies,
  config: CoachAIConfig,
  level: ThinkingLevel,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  const pipeline = THINKING_PIPELINE[level];
  // The on-device model has no first look: a small model invents detail when asked to describe.
  const mealLooks = config.provider === 'on-device' ? null : pipeline.mealLooks;

  // Each first look is its own request, so a mistake in one never reaches every sample. A look that
  // fails or reads as nothing is left out; with none left the estimate goes on without looks (an
  // extra request can only help, never fail the estimate), and a cancel stops everything.
  const takeLooks = async (count: number): Promise<MealObservation[]> => {
    deps.reportMealProgress(onProgress, {
      step: 'observing',
      photo: images.length > 0,
      photoCount: images.length,
    });
    try {
      return await runSamples(config, count, () => deps.observeMeal(config, userMessage, images));
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      deps.reportAiError(error, 'coachAI.observeMeal');
      return [];
    }
  };

  // With looks: `samplesPerLook` samples per look, sample `i` of a stage reading look `floor(i /
  // perLook)` of that stage. `runSamples` leaves failed samples out, so each answered sample keeps
  // the look it read and whether it needed the plausibility recheck. Only the first sample of a
  // stage reports its steps: several at once would interleave their lines.
  const perLook = mealLooks?.samplesPerLook ?? 1;
  const samples: { answer: TrackMealResponse; look: number; rechecked: boolean }[] = [];
  const takeStage = async (stageLooks: MealObservation[], firstLook: number, count: number) => {
    const answers = await runSamples(config, count, async (index) => {
      const look = stageLooks.length > 0 ? Math.floor(index / perLook) : -1;
      const signals = { rechecked: false };
      const answer = await deps.trackMealVerified(
        config,
        userMessage,
        images,
        index === 0 ? onProgress : undefined,
        look >= 0 ? stageLooks[look] : undefined,
        signals
      );
      return answer
        ? { answer, look: look >= 0 ? firstLook + look : -1, rechecked: signals.rechecked }
        : null;
    });
    samples.push(...answers);
    return {
      answers: answers.map((item) => item.answer),
      rechecked: answers.map((item) => item.rechecked),
    };
  };

  const looks: MealObservation[] = [];
  if (mealLooks && pipeline.earlyExit) {
    // Stage 1: ONE first look and the samples that read it. When they agree and nothing flags doubt
    // (the look lists nothing uncertain, no sample needed the plausibility recheck) the estimate is
    // stable and the remaining looks are never made. Anything else, a first look that failed or read
    // as nothing, or samples that all failed, goes on to stage 2: the remaining looks and theirs.
    const [first] = await takeLooks(1);
    let settled = false;
    if (first) {
      looks.push(first);
      try {
        const stage = await takeStage([first], 0, perLook);
        settled = mealStageIsSettled({
          samples: stage.answers,
          look: first,
          rechecked: stage.rechecked,
        });
      } catch (error) {
        if (error instanceof AiCancelledError) {
          throw error;
        }

        deps.reportAiError(error, 'coachAI.trackMealFirstStage');
      }
    }

    if (!settled && mealLooks.looks > 1) {
      const more = await takeLooks(mealLooks.looks - 1);
      const firstLook = looks.length;
      looks.push(...more);
      if (more.length > 0) {
        try {
          await takeStage(more, firstLook, more.length * perLook);
        } catch (error) {
          if (error instanceof AiCancelledError) {
            throw error;
          }

          deps.reportAiError(error, 'coachAI.trackMealSecondStage');
        }
      }
    }

    if (samples.length === 0) {
      // No look read anything: the estimate goes on without looks, as it does at every level.
      await takeStage([], 0, pipeline.samples);
    }
  } else {
    if (mealLooks) {
      looks.push(...(await takeLooks(mealLooks.looks)));
    }

    await takeStage(looks, 0, looks.length > 0 ? looks.length * perLook : pipeline.samples);
  }

  if (samples.length === 0) {
    return null;
  }

  let draft = samples[0].answer;
  if (samples.length > 1) {
    deps.reportMealProgress(onProgress, { step: 'comparing', count: samples.length });
    draft = consensusMeals(
      samples.map((item) => item.answer),
      looks.length > 1 ? samples.map((item) => item.look) : undefined
    );
  }

  if (pipeline.reviewRounds === 0) {
    return draft;
  }

  return reviewAndRevise<TrackMealResponse>({
    draft,
    rounds: pipeline.reviewRounds,
    critique: async (current) => {
      deps.reportMealProgress(onProgress, { step: 'reviewing' });
      const meals: TrackedMeal[] = [];
      for (const meal of current.meals) {
        meals.push(await deps.reviewTrackedMeal(config, meal, userMessage, images, onProgress));
      }

      return { ...current, meals };
    },
    accept: (current, revised) =>
      deps.countMealProblems(revised) <= deps.countMealProblems(current),
    onError: (error) => deps.reportAiError(error, 'coachAI.reviewTrackedMeal'),
    isUnchanged: pipeline.earlyExit ? sameValue : undefined,
  });
}
