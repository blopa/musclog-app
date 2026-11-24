import { DEFAULT_LANG } from '@/lang/lang';

import { OnDeviceUnavailableError, rethrowUserFacingAiError } from './aiErrors';
import { THINKING_PIPELINE } from './aiThinkingLevel';
import {
  type CoachAIConfig,
  foundationFoodsFor,
  generateStructured,
  generateWithImagesStructured,
  mealSchemaDialect,
  prepareMealImages,
  reportAiError,
  schemaOfFunction,
  thinkingLevelFor,
  type TrackMealResponse,
} from './coachAI';
import { estimateMealFromPhotoOnDevice } from './coachMealPhotoOnDevice';
import { trackMealThinking } from './coachMealSampling';
import { refineTrackedMeals, reportMealProgress } from './coachMealSteps';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import { MAX_MEAL_IMAGES, type MealImage, toMealImage, toMealImages } from './mealImages';
import { formatMealPhotoContext, type MealPhotoContext } from './mealPhotoContext';
import {
  getMealAnalysisPrompt,
  getMultiPhotoMealNote,
  getTrackMealFunctions,
  withCustomPrompts,
} from './prompts';

/**
 * What a meal estimate is asked: the person's words and extras (a description, the notes of the
 * photo sheet) and the photos as taken. Both entry points below only build this.
 */
type MealEstimateRequest = {
  text: string;
  photos: readonly MealImage[];
};

/**
 * The one meal estimate for every cloud and own-key provider, at the person's thinking level: the
 * verified path from Medium up, one request refined by code at Off.
 *
 * A failure the person can act on (a rejected key, a timeout, a spent allowance, a cancel) is thrown
 * as its typed error, for the caller to describe; anything else is reported once and the estimate is
 * `null`. Nothing is toasted here: the caller shows the reason where the person is looking.
 */
async function estimateMeal(
  config: CoachAIConfig,
  { text, photos }: MealEstimateRequest,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  try {
    reportMealProgress(
      onProgress,
      photos.length > 0
        ? { step: 'reading', photo: true, photoCount: photos.length }
        : { step: 'reading', photo: false }
    );
    // Prepared once: every look, sample and review below reuses these, never re-encodes them.
    const images = await prepareMealImages(config, photos);
    const level = await thinkingLevelFor(config);
    if (THINKING_PIPELINE[level].verifiedMeal) {
      const lead = images.length > 1 ? 'Analyze these meal photos.' : 'Analyze this meal photo.';

      return await trackMealThinking(
        config,
        level,
        images.length > 0 ? [lead, text].filter(Boolean).join('\n') : text,
        images,
        onProgress
      );
    }

    const foundation = await foundationFoodsFor(config, 'estimate');
    const systemPrompt = await withCustomPrompts(
      await getMealAnalysisPrompt(foundation, config.language ?? DEFAULT_LANG)
    );
    const schema = schemaOfFunction(
      getTrackMealFunctions(foundation !== null, mealSchemaDialect(config))
    );

    // Foundation-food matches arrive with zero macros: the lookup fills the real values in, and an
    // id the database does not have is estimated in a follow-up request instead of logged at 0 kcal.
    const parsed =
      images.length > 0
        ? await generateWithImagesStructured<TrackMealResponse>(
            config,
            systemPrompt,
            images,
            schema,
            'trackMeal',
            text || undefined,
            'extraction',
            { prepared: true }
          )
        : await generateStructured<TrackMealResponse>(
            config,
            systemPrompt,
            text,
            schema,
            'trackMeal'
          );

    return parsed ? await refineTrackedMeals(config, parsed, onProgress, foundation) : null;
  } catch (error) {
    rethrowUserFacingAiError(error);
    reportAiError(error, 'coachAI.estimateMeal');

    return null;
  }
}

/**
 * Track a meal from a description, with or without one photo (the coach chat, My Meals).
 */
export async function trackMeal(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  if (config.provider === 'on-device' && base64Image) {
    return estimateNutritionFromPhoto(
      config,
      base64Image,
      { description: userMessage, tags: [] },
      onProgress
    );
  }

  return estimateMeal(
    config,
    { text: userMessage, photos: base64Image ? [toMealImage(base64Image)] : [] },
    onProgress
  );
}

/**
 * Estimate nutrition from one photo of a meal, or up to `MAX_MEAL_IMAGES` of the same meal (data
 * URLs or bare base64), with the notes of the photo sheet. Returns a `TrackMealResponse` with the
 * ingredients breakdown, like `trackMeal`.
 */
export async function estimateNutritionFromPhoto(
  config: CoachAIConfig,
  photos: string | readonly string[],
  context?: MealPhotoContext | null,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  const images = toMealImages(photos).slice(0, MAX_MEAL_IMAGES);
  if (images.length === 0) {
    return null;
  }

  if (config.provider === 'on-device') {
    if (config.engine !== 'gguf') {
      throw new OnDeviceUnavailableError('photosUnsupported');
    }

    if (!config.vision) {
      throw new OnDeviceUnavailableError('photosNotInstalled');
    }

    // Utils throw and the caller at the UI boundary reports, so one failure is one event.
    return estimateMealFromPhotoOnDevice(config, images, context, onProgress);
  }

  return estimateMeal(
    config,
    {
      text: [getMultiPhotoMealNote(images.length), formatMealPhotoContext(context)]
        .filter(Boolean)
        .join('\n'),
      photos: images,
    },
    onProgress
  );
}
