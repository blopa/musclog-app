import { AiCancelledError } from './aiErrors';
import { runSamples } from './aiPasses';
import { reportAiEvent } from './aiTelemetry';
import { extractionSamples } from './aiThinkingLevel';
import {
  type CoachAIConfig,
  logLlmDebugEvent,
  repairStructuredWithModel,
  reportAiError,
  thinkingLevelFor,
  type TrackMealResponse,
} from './coachAI';
import {
  completeMealIngredients,
  recheckImplausibleIngredients,
  reportMealProgress,
} from './coachMealSteps';
import { withLlmRetry } from './llmRetry';
import {
  type IdentifiedFood,
  LOCAL_FOOD_IDENTIFY_SCHEMA,
  LOCAL_PHOTO_RETRY_TEMPERATURE,
  localFoodIdentifyPrompt,
  mealTypeForHour,
  mergeFoodsAcrossPhotos,
  parseIdentifiedFoods,
  photoMealName,
  voteIdentifiedFoods,
} from './localFoodPhoto';
import { checkStructuredShape, parseStructuredJson } from './localReplyShape';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import type { MealImage } from './mealImages';
import { formatMealPhotoContext, type MealPhotoContext } from './mealPhotoContext';
import { sendLocalStructuredRaw } from './onDeviceLocal';
import { wrapUserContent } from './promptSanitizer';

/**
 * Reads a meal photo with the downloaded on-device model: it names what it sees and guesses grams
 * (grammar-constrained, never asked for calories), the names are matched to foods this phone has,
 * and anything unmatched is estimated by name through the same follow-up the cloud path uses.
 * Returns null when nothing recognisable is in the photo; the review screen takes it from there.
 */
export async function estimateMealFromPhotoOnDevice(
  config: CoachAIConfig,
  rawImages: readonly MealImage[],
  context?: MealPhotoContext | null,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  reportMealProgress(onProgress, { step: 'reading', photo: true, photoCount: rawImages.length });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiImage: typeof import('@/utils/aiImage') = require('@/utils/aiImage');
  // The engine takes one image per request, so every photo is prepared (and later read) alone.
  const images: MealImage[] = [];
  for (const raw of rawImages) {
    images.push(await aiImage.prepareOnDeviceImage(raw.base64, raw.mimeType));
  }

  const systemPrompt = localFoodIdentifyPrompt();
  const formattedContext = formatMealPhotoContext(context);
  const details = formattedContext ? wrapUserContent(formattedContext) : '';
  const messages = [
    {
      role: 'user' as const,
      content: details
        ? `What foods are in this photo?\nMeal notes: ${details}`
        : 'What foods are in this photo?',
    },
  ];
  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'request',
    operation: 'estimateNutritionFromPhoto',
    payload: { systemPrompt, messages, schema: LOCAL_FOOD_IDENTIFY_SCHEMA },
    config,
  });

  const askForPhoto = (image: MealImage, temperature?: number) =>
    withLlmRetry('estimateNutritionFromPhoto', config, (signal, touch) =>
      sendLocalStructuredRaw(messages, systemPrompt, LOCAL_FOOD_IDENTIFY_SCHEMA, {
        image: `data:${image.mimeType};base64,${image.base64}`,
        signal,
        // Every token resets the timeout, so it limits a stall, not model load plus generation.
        onDelta: () => touch(),
        ...(temperature === undefined ? {} : { temperature }),
      })
    );

  const readPhotoReply = (text: string) =>
    checkStructuredShape(
      parseStructuredJson<unknown>(text),
      LOCAL_FOOD_IDENTIFY_SCHEMA,
      'estimateNutritionFromPhoto'
    );

  // One reading of the photo. `firstTemperature` lets a further sample differ from the first.
  const identifyFoods = async (
    image: MealImage,
    firstTemperature?: number
  ): Promise<IdentifiedFood[]> => {
    let raw = await askForPhoto(image, firstTemperature);
    let parsed = readPhotoReply(raw);
    if (parsed.kind !== 'ok') {
      // Syntax is the grammar's job and the schema check is ours; a reply that fails both gets one
      // warmer second try (temperature 0 would repeat itself) before the person is told it failed.
      const firstRaw = raw;
      raw = await askForPhoto(image, LOCAL_PHOTO_RETRY_TEMPERATURE);
      parsed = readPhotoReply(raw);

      // Last resort before giving up: one text-only call that is asked to correct the broken reply
      // (no photo, so the projector stays unloaded), read by the same parser and schema check. It
      // only ever runs after both photo attempts failed, so a good run never pays for it.
      const broken = [raw, firstRaw].find((text) => text.trim() !== '');
      if (parsed.kind !== 'ok' && broken) {
        const repaired = await repairStructuredWithModel<unknown>(
          config,
          'estimateNutritionFromPhoto',
          broken,
          LOCAL_FOOD_IDENTIFY_SCHEMA
        );
        if (repaired?.kind === 'ok') {
          parsed = repaired;
        }
      }
    }

    if (parsed.kind !== 'ok') {
      // A reply no attempt could read is not the same as a photo with no food in it.
      reportAiEvent('ai-structured-reply-unusable', {
        provider: 'on-device',
        operation: 'estimateNutritionFromPhoto',
        engine: config.engine,
      });

      return [];
    }

    return parseIdentifiedFoods(parsed.value);
  };

  // From High up the photo is read more than once, one reading after another (the phone has one
  // engine), and a food stays only when at least half the readings name it.
  const readings = extractionSamples(await thinkingLevelFor(config));
  const identifyPhoto = async (image: MealImage): Promise<IdentifiedFood[]> =>
    readings <= 1
      ? identifyFoods(image)
      : voteIdentifiedFoods(
          await runSamples(
            config,
            readings,
            async (index) => {
              const found = await identifyFoods(
                image,
                index === 0 ? undefined : LOCAL_PHOTO_RETRY_TEMPERATURE
              );
              return found.length > 0 ? found : null;
            },
            { onDroppedFailure: (error) => reportAiError(error, 'coachAI.onDevicePhotoReading') }
          )
        );

  // Each photo is read on its own, one after another (the phone has one engine), and the lists are
  // merged in code: a food in several photos is one food, at its largest estimated portion. A photo
  // that fails is left out; only when none was readable does the estimate fail (a cancel stops all).
  const perPhoto: IdentifiedFood[][] = [];
  const failures: unknown[] = [];
  for (const [index, image] of images.entries()) {
    if (images.length > 1) {
      reportMealProgress(onProgress, {
        step: 'identifying',
        index: index + 1,
        count: images.length,
      });
    }

    try {
      perPhoto.push(await identifyPhoto(image));
    } catch (error) {
      if (error instanceof AiCancelledError || images.length === 1) {
        throw error;
      }

      failures.push(error);
    }
  }

  // Failures that were swallowed are reported here; when every photo failed the first one is
  // rethrown and the caller reports it, so none is reported twice.
  if (perPhoto.length === 0 && failures.length > 0) {
    throw failures[0];
  }

  for (const error of failures) {
    reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
  }

  const foods = mergeFoodsAcrossPhotos(perPhoto);
  if (foods.length === 0) {
    return null;
  }

  // The same steps every meal estimate takes: foods the phone has are matched by name (the person's
  // own wording is kept), the rest is estimated by name, then the numbers are checked.
  const mealName = photoMealName(foods.map((food) => food.name)) ?? '';
  const completed = await completeMealIngredients(
    config,
    mealName,
    foods.map(({ name, grams, englishName }) => ({ name, grams, englishName })),
    onProgress
  );
  const checked = await recheckImplausibleIngredients(
    config,
    mealName,
    completed.ingredients,
    onProgress
  );

  return {
    meals: [
      {
        mealType: mealTypeForHour(new Date().getHours()),
        ...(mealName ? { mealName } : {}),
        ingredients: checked.ingredients,
      },
    ],
  };
}
