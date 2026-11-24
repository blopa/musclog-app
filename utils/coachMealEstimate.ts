import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { DEFAULT_LANG } from '@/lang/lang';

import { notifyUserFacingAiError } from './aiErrorNotice';
import { AiCancelledError, OnDeviceUnavailableError } from './aiErrors';
import { runSamples } from './aiPasses';
import { extractionSamples, THINKING_PIPELINE, type ThinkingLevel } from './aiThinkingLevel';
import type {
  CoachAIConfig,
  MealEstimatorTransport,
  MissingIngredientMacrosResponse,
  RecipeExtractionResponse,
  RecipeIngredient,
  TrackedMeal,
  TrackMealIngredient,
  TrackMealResponse,
} from './coachAI';
import { matchIngredientsToOwnFoods as matchMealFoods } from './coachMealFoods';
import { trackMealThinking as runMealThinking } from './coachMealSampling';
import { resolveFoundationRefs, resolveFoundationRefsInMeals } from './foundationFoodList';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import { MAX_MEAL_IMAGES, type MealImage, toMealImage, toMealImages } from './mealImages';
import {
  formatMealObservation,
  type MealObservation,
  parseMealObservation,
} from './mealObservation';
import { formatMealPhotoContext, type MealPhotoContext } from './mealPhotoContext';
import { ingredientMacroProblems, reconcileIngredientMacros } from './mealPlausibility';
import { applyMealReview, type MealReview } from './mealReview';
import {
  fromLabelPer100g,
  isFiberTracked,
  medianLabel,
  type OnDeviceLabel,
  withLabelFiber,
} from './onDeviceMacros';
import {
  type FoundationFoodsPrompt,
  getActiveCustomPrompts,
  getEstimateMissingIngredientsFunctions,
  getMealAnalysisPrompt,
  getMealObservationFunctions,
  getMealObservationPrompt,
  getMealReviewFunctions,
  getMealReviewPrompt,
  getMissingIngredientsMacrosPrompt,
  getMultiPhotoMealNote,
  getOnDeviceFiberFunctions,
  getOnDeviceFiberPrompt,
  getOnDeviceLabelFunctions,
  getOnDeviceLabelPrompt,
  getOnDeviceLabelUserMessage,
  getRecipeExtractionFunctions,
  getRecipeExtractionPrompt,
  getTrackMealFunctions,
} from './prompts';

export function createMealEstimator(deps: MealEstimatorTransport) {
  const {
    foundationFoodsFor,
    mealSchemaDialect,
    getSchemaFromFunctionDeclaration,
    generateStructured,
    generateWithImagesStructured,
    prepareMealImages,
    thinkingLevelFor,
    estimateMealFromPhotoOnDevice,
    reportAiError,
  } = deps;
  function matchIngredientsToOwnFoods(
    ingredients: readonly { name: string; grams: number; englishName?: string }[]
  ) {
    return matchMealFoods(reportAiError, ingredients);
  }

  async function extractRecipe(
    config: CoachAIConfig,
    userMessage: string,
    images: readonly MealImage[] = [],
    observation?: MealObservation
  ): Promise<RecipeExtractionResponse | null> {
    const lang = config.language ?? DEFAULT_LANG;
    const foundation = await foundationFoodsFor(config, 'recipe');
    const systemPrompt = await getRecipeExtractionPrompt(foundation, lang);
    const fns = getRecipeExtractionFunctions(foundation !== null, mealSchemaDialect(config));
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    // A first look is notes for the request, never a replacement for the photo or description.
    const message = observation
      ? `${userMessage}\n\n${formatMealObservation(observation)}`
      : userMessage;

    if (images.length > 0) {
      if (config.provider === 'on-device') {
        // Downloaded models identify photos through estimateNutritionFromPhoto.
        return null;
      }

      const fromPhoto = await generateWithImagesStructured<RecipeExtractionResponse>(
        config,
        systemPrompt,
        images,
        schema,
        'extractRecipe',
        message,
        'extraction',
        { prepared: true }
      );

      // A reference number the model returned becomes the real food id here, against the list it saw.
      return fromPhoto ? resolveFoundationRefsInMeals(fromPhoto, foundation) : null;
    }

    const fromText = await generateStructured<RecipeExtractionResponse>(
      config,
      systemPrompt,
      message,
      schema,
      'extractRecipe'
    );

    return fromText ? resolveFoundationRefsInMeals(fromText, foundation) : null;
  }

  /**
   * One structured "first look" at a meal (Tokenmaxxing): what is there, how big it looks, what fat,
   * sauce or drink is visible or likely, and what is unsure. No grams and no macros, so seeing stays
   * apart from estimating. A reply that cannot be read is no look (null), never a failed estimate.
   */
  async function observeMeal(
    config: CoachAIConfig,
    userMessage: string,
    images: readonly MealImage[] = []
  ): Promise<MealObservation | null> {
    const systemPrompt = getMealObservationPrompt(config.language ?? DEFAULT_LANG);
    const schema = getSchemaFromFunctionDeclaration((getMealObservationFunctions() as any)[0]);

    if (images.length > 0) {
      const raw = await generateWithImagesStructured<unknown>(
        config,
        systemPrompt,
        images,
        schema,
        'observeMeal',
        userMessage,
        'extraction',
        { prepared: true }
      );

      return parseMealObservation(raw);
    }

    return parseMealObservation(
      await generateStructured<unknown>(config, systemPrompt, userMessage, schema, 'observeMeal')
    );
  }

  async function estimateMissingIngredients(
    config: CoachAIConfig,
    newIngredients: RecipeIngredient[],
    knownIngredients: TrackMealIngredient[],
    mealName: string
  ): Promise<MissingIngredientMacrosResponse | null> {
    if (config.provider === 'on-device') {
      return estimateMissingIngredientsOnDevice(config, newIngredients);
    }

    const systemPrompt = getMissingIngredientsMacrosPrompt(
      mealName,
      knownIngredients,
      newIngredients
    );
    const fns = getEstimateMissingIngredientsFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    return generateStructured<MissingIngredientMacrosResponse>(
      config,
      systemPrompt,
      `Estimate macros for the missing ingredients in "${mealName}".`,
      schema,
      'estimateMissingIngredients'
    );
  }

  /**
   * The on-device model is asked for a label per 100 g by name (one request); the figures are scaled
   * and made consistent in code. With fiber tracked, one more request asks for fiber per 100 g
   * (never failing the estimate).
   */
  async function estimateMissingIngredientsOnDevice(
    config: CoachAIConfig,
    newIngredients: RecipeIngredient[]
  ): Promise<MissingIngredientMacrosResponse | null> {
    const names = newIngredients.map(({ name }) => name);
    const labelFns = getOnDeviceLabelFunctions();

    const askForLabels = () =>
      generateStructured<{ foods: OnDeviceLabel[] }>(
        config,
        getOnDeviceLabelPrompt(names),
        getOnDeviceLabelUserMessage(),
        getSchemaFromFunctionDeclaration((labelFns as any)[0]),
        'estimateMissingIngredients'
      );
    // From High up each label is asked for more than once and every figure is the median.
    const readings = extractionSamples(await thinkingLevelFor(config));
    const replies =
      readings <= 1
        ? [await askForLabels()].filter((reply) => reply != null)
        : await runSamples(config, readings, askForLabels);
    if (replies.length === 0) {
      return null;
    }

    let computed = newIngredients.flatMap((target, index) => {
      const label = medianLabel(
        replies.flatMap((reply) => {
          const found = estimateFor(target, index, newIngredients.length, reply.foods ?? []);
          return found ? [found] : [];
        })
      );

      return label ? [fromLabelPer100g({ ...label, name: target.name }, target.grams)] : [];
    });
    if (computed.length === 0) {
      return { ingredients: [] };
    }

    if (isFiberTracked(await SettingsService.getNutritionDisplay())) {
      try {
        const fiberFns = getOnDeviceFiberFunctions();
        const fiberReply = await generateStructured<{ foods: { name: string; fiber: number }[] }>(
          config,
          getOnDeviceFiberPrompt(computed.map(({ name }) => name)),
          getOnDeviceLabelUserMessage(),
          getSchemaFromFunctionDeclaration((fiberFns as any)[0]),
          'estimateFiber'
        );
        const replies = fiberReply?.foods ?? [];
        computed = computed.map((ingredient, index) => {
          const reply = estimateFor(ingredient, index, computed.length, replies);

          return reply ? withLabelFiber(ingredient, reply.fiber) : ingredient;
        });
      } catch (error) {
        if (error instanceof AiCancelledError) {
          throw error;
        }

        reportAiError(error, 'coachAI.estimateOnDeviceFiber');
      }
    }

    return { ingredients: computed };
  }

  /** Progress is a courtesy to the screen: a listener that throws must never fail an estimate. */
  function reportMealProgress(
    listener: MealEstimateProgressListener | undefined,
    progress: Parameters<MealEstimateProgressListener>[0]
  ): void {
    try {
      listener?.(progress);
    } catch {
      // Ignored on purpose.
    }
  }

  /** An ingredient with no numbers at all: the model named it but gave no energy or macros. */
  function hasNoNumbers(ingredient: TrackMealIngredient): boolean {
    return !(
      ingredient.kcal > 0 ||
      ingredient.protein > 0 ||
      ingredient.carbs > 0 ||
      ingredient.fat > 0
    );
  }

  /** The estimate for `target`: the one with its name, else the one in its place when counts agree. */
  function estimateFor<T extends { name: string }>(
    target: { name: string },
    index: number,
    count: number,
    estimates: T[]
  ): T | undefined {
    const key = target.name.trim().toLowerCase();
    return (
      estimates.find((estimate) => estimate.name.trim().toLowerCase() === key) ??
      (estimates.length === count ? estimates[index] : undefined)
    );
  }

  function withEstimatedMacros(
    target: TrackMealIngredient,
    estimate: TrackMealIngredient
  ): TrackMealIngredient {
    return {
      ...target,
      kcal: estimate.kcal,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      fiber: estimate.fiber,
    };
  }

  /**
   * What a verified sample tells its caller beyond the meal itself: it set `rechecked` when the
   * plausibility recheck had ingredients to re-estimate, which is a sign the first reading was unsure.
   */
  type MealUncertaintySignals = { rechecked: boolean };

  /**
   * Re-estimates the ingredients of a meal whose numbers cannot all be true (`mealPlausibility`):
   * energy that the macros do not add up to, macros that weigh more than the ingredient, and so on.
   * Only ingredients without a match in the person's own foods are checked, since a match's numbers
   * come from the database. It is one extra request, made only when something is off, and an
   * estimate replaces the original only when it has fewer problems. Whatever is still implausible
   * afterwards (the retry was as bad, found nothing or failed) goes through
   * `reconcileIngredientMacros`, so the figures shown never contradict each other; a failed
   * re-estimate is never a reason to fail the estimate.
   */
  async function recheckImplausibleIngredients(
    config: CoachAIConfig,
    mealName: string,
    ingredients: TrackMealIngredient[],
    onProgress?: MealEstimateProgressListener,
    signals?: MealUncertaintySignals
  ): Promise<TrackMealIngredient[]> {
    const suspects = ingredients.filter(
      (ingredient) => !ingredient.foodId && ingredientMacroProblems(ingredient).length > 0
    );
    if (suspects.length === 0) {
      return ingredients;
    }

    if (signals) {
      signals.rechecked = true;
    }

    reportMealProgress(onProgress, { step: 'rechecking', count: suspects.length });

    try {
      const estimated = await estimateMissingIngredients(
        config,
        suspects.map(({ name, grams }) => ({ name, grams })),
        ingredients.filter((ingredient) => ingredient.foodId),
        mealName
      );
      const estimates = estimated?.ingredients ?? [];

      return ingredients.map((ingredient) => {
        const suspectIndex = suspects.indexOf(ingredient);
        if (suspectIndex < 0) {
          return ingredient;
        }

        const estimate = estimateFor(ingredient, suspectIndex, suspects.length, estimates);
        if (!estimate) {
          return reconcileIngredientMacros(ingredient);
        }

        const better = withEstimatedMacros(ingredient, estimate);
        return reconcileIngredientMacros(
          ingredientMacroProblems(better).length < ingredientMacroProblems(ingredient).length
            ? better
            : ingredient
        );
      });
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      reportAiError(error, 'coachAI.recheckImplausibleIngredients');
      return ingredients.map((ingredient) =>
        suspects.includes(ingredient) ? reconcileIngredientMacros(ingredient) : ingredient
      );
    }
  }

  /**
   * What a one-request estimate gets before it is shown or logged. The model may name a food id
   * this database does not have (it invents ids, or sends the string "null"); the lookup then drops
   * the id and keeps the model's numbers, which for a foundation-food match are zeros, so the
   * ingredient would be logged at 0 kcal. Those ingredients are estimated in a follow-up request, the
   * same step the verified path makes; then every ingredient that is not the person's own food gets
   * the plausibility check. With nothing to fix it makes no request.
   */
  async function refineTrackedMeals(
    config: CoachAIConfig,
    response: TrackMealResponse,
    onProgress?: MealEstimateProgressListener,
    foundation: FoundationFoodsPrompt | null = null
  ): Promise<TrackMealResponse> {
    const meals: TrackedMeal[] = [];

    for (const meal of response.meals ?? []) {
      const original = meal.ingredients ?? [];
      // Who named a food is read from the model's own answer, before its reference numbers become ids:
      // a reference that names nothing is an invented id, and an invented id with no numbers is estimated.
      const claimedFoodId = original.map((ingredient) => Boolean(ingredient.foodId));
      // Deliberately unguarded: a failed lookup must reject, never leave every id looking unmatched.
      let ingredients = await NutritionService.normalizeAiMealIngredients(
        resolveFoundationRefs(original, foundation)
      );

      const unnumbered = ingredients.filter(
        (ingredient, index) =>
          claimedFoodId[index] && !ingredient.foodId && hasNoNumbers(ingredient)
      );
      if (unnumbered.length > 0) {
        const matched = ingredients.filter((ingredient) => ingredient.foodId);
        reportMealProgress(onProgress, {
          step: 'estimating',
          count: unnumbered.length,
          matched: matched.length,
        });

        try {
          const estimated = await estimateMissingIngredients(
            config,
            unnumbered.map(({ name, grams }) => ({ name, grams })),
            matched,
            meal.mealName ?? meal.mealType
          );
          const estimates = estimated?.ingredients ?? [];
          ingredients = ingredients.map((ingredient) => {
            const index = unnumbered.indexOf(ingredient);
            const estimate =
              index < 0 ? undefined : estimateFor(ingredient, index, unnumbered.length, estimates);
            return estimate ? withEstimatedMacros(ingredient, estimate) : ingredient;
          });
        } catch (error) {
          if (error instanceof AiCancelledError) {
            throw error;
          }

          reportAiError(error, 'coachAI.refineTrackedMeals');
        }
      }

      meals.push({
        ...meal,
        ingredients: await recheckImplausibleIngredients(
          config,
          meal.mealName ?? meal.mealType,
          ingredients,
          onProgress
        ),
      });
    }

    return { ...response, meals };
  }

  /**
   * The verified meal estimate, used from the Medium thinking level up: it separates what the model can
   * read (the recipe: meals, ingredients, grams, the foods of the person it recognises) from what it
   * must work out (the numbers of what is left), checking each claimed food id against the database
   * in between. Slower than one request, with more of the work done by code and less left to chance.
   */
  async function trackMealVerified(
    config: CoachAIConfig,
    userMessage: string,
    images: readonly MealImage[] = [],
    onProgress?: MealEstimateProgressListener,
    observation?: MealObservation,
    signals?: MealUncertaintySignals
  ): Promise<TrackMealResponse | null> {
    const recipeResponse = await extractRecipe(config, userMessage, images, observation);
    if (!recipeResponse?.meals?.length) {
      return null;
    }

    const resultMeals: TrackedMeal[] = [];

    for (const meal of recipeResponse.meals) {
      const claimedSource = meal.ingredients.filter((i) => i.foodId);
      const claimedStubs: TrackMealIngredient[] = claimedSource.map((i) => ({
        name: i.name,
        grams: i.grams,
        foodId: i.foodId,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      }));

      // A claimed foodId only counts once the database confirms it: the model sometimes
      // sends the string "null" or an invented id, and treating those as matches would
      // skip estimation and log the ingredient at 0 kcal.
      const normalizedClaimed = await NutritionService.normalizeAiMealIngredients(claimedStubs);
      const claimed = normalizedClaimed.filter((i) => i.foodId);
      // The lookup keeps its input order, so an unconfirmed claim is found by position and keeps the
      // English name the model gave it.
      const unconfirmed = claimedSource.filter((_, index) => !normalizedClaimed[index]?.foodId);
      // What the model named without a (confirmed) id is looked up by name in the person's own foods
      // before it is estimated, so a food they already have is never re-estimated.
      const byName = await matchIngredientsToOwnFoods([
        ...meal.ingredients.filter((i) => !i.foodId),
        ...unconfirmed,
      ]);
      const matched = [...claimed, ...byName.matched];
      const newIngredients = byName.unmatched;

      let fullIngredients: TrackMealIngredient[] = matched;

      if (newIngredients.length > 0) {
        reportMealProgress(onProgress, {
          step: 'estimating',
          count: newIngredients.length,
          matched: matched.length,
        });
        const estimated = await estimateMissingIngredients(
          config,
          newIngredients,
          matched,
          meal.mealName
        );

        fullIngredients = [
          ...matched,
          ...(estimated?.ingredients ??
            newIngredients.map((i) => ({
              name: i.name,
              grams: i.grams,
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
            }))),
        ];
      }

      resultMeals.push({
        mealType: meal.mealType,
        mealName: meal.mealName,
        ingredients: fullIngredients,
      });
    }

    for (const meal of resultMeals) {
      const normalized = await NutritionService.normalizeAiMealIngredients(meal.ingredients);
      meal.ingredients = await recheckImplausibleIngredients(
        config,
        meal.mealName ?? meal.mealType,
        normalized,
        onProgress,
        signals
      );
    }

    return { meals: resultMeals };
  }

  /**
   * The meal estimate of High and Tokenmaxxing. Samples of the verified path (Tokenmaxxing runs
   * several and code keeps what most of them agree on), then rounds of review: the model, shown the
   * estimate beside the description or photo, names what is missing or off, code applies it and
   * estimates what was added, and the result replaces the estimate only when it has no more
   * implausible figures than before. Medium is one sample and no review: the verified path itself.
   */

  function trackMealThinking(
    config: CoachAIConfig,
    level: ThinkingLevel,
    userMessage: string,
    images: readonly MealImage[] = [],
    onProgress?: MealEstimateProgressListener
  ): Promise<TrackMealResponse | null> {
    return runMealThinking(
      {
        observeMeal,
        trackMealVerified,
        reviewTrackedMeal,
        reportAiError,
        reportMealProgress,
        countMealProblems,
      },
      config,
      level,
      userMessage,
      images,
      onProgress
    );
  }

  function countMealProblems(response: TrackMealResponse): number {
    return response.meals.reduce(
      (total, meal) =>
        total +
        meal.ingredients
          .filter((ingredient) => !ingredient.foodId)
          .reduce((sum, ingredient) => sum + ingredientMacroProblems(ingredient).length, 0),
      0
    );
  }

  async function requestMealReview(
    config: CoachAIConfig,
    meal: TrackedMeal,
    userMessage: string,
    images: readonly MealImage[] = []
  ): Promise<MealReview | null> {
    const systemPrompt = getMealReviewPrompt(meal, config.language ?? DEFAULT_LANG);
    const schema = getSchemaFromFunctionDeclaration(
      (getMealReviewFunctions(mealSchemaDialect(config)) as any)[0]
    );

    if (images.length > 0 && config.provider !== 'on-device') {
      return generateWithImagesStructured<MealReview>(
        config,
        systemPrompt,
        images,
        schema,
        'reviewMealEstimate',
        userMessage,
        'extraction',
        { prepared: true }
      );
    }

    return generateStructured<MealReview>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'reviewMealEstimate'
    );
  }

  async function reviewTrackedMeal(
    config: CoachAIConfig,
    meal: TrackedMeal,
    userMessage: string,
    images: readonly MealImage[] = [],
    onProgress?: MealEstimateProgressListener
  ): Promise<TrackedMeal> {
    const review = await requestMealReview(config, meal, userMessage, images);
    const { meal: corrected, added } = applyMealReview(meal, review);
    if (added.length === 0) {
      return corrected;
    }

    const mealName = corrected.mealName ?? corrected.mealType;
    // An addition the person already has a food for is taken from it, not estimated.
    const { matched: addedFromOwnFoods, unmatched: addedToEstimate } =
      await matchIngredientsToOwnFoods(added);
    let estimates: MissingIngredientMacrosResponse['ingredients'] = [];
    if (addedToEstimate.length > 0) {
      const estimated = await estimateMissingIngredients(
        config,
        addedToEstimate,
        [...corrected.ingredients.filter((ingredient) => ingredient.foodId), ...addedFromOwnFoods],
        mealName
      );
      estimates = estimated?.ingredients ?? [];
    }

    const additions = [
      ...addedFromOwnFoods,
      ...addedToEstimate.flatMap((item, index) => {
        const estimate = estimateFor(item, index, addedToEstimate.length, estimates);

        return estimate
          ? [
              withEstimatedMacros(
                { name: item.name, grams: item.grams, kcal: 0, protein: 0, carbs: 0, fat: 0 },
                estimate
              ),
            ]
          : [];
      }),
    ];
    if (additions.length === 0) {
      return corrected;
    }

    const normalized = await NutritionService.normalizeAiMealIngredients([
      ...corrected.ingredients,
      ...additions,
    ]);

    return {
      ...corrected,
      ingredients: await recheckImplausibleIngredients(config, mealName, normalized, onProgress),
    };
  }

  /**
   * Track a meal from description or base64 image
   */
  async function trackMeal(
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

    try {
      reportMealProgress(onProgress, { step: 'reading', photo: Boolean(base64Image) });
      // One photo of the chat, prepared once for every request that follows.
      const images = base64Image ? await prepareMealImages(config, [toMealImage(base64Image)]) : [];
      const level = await thinkingLevelFor(config);
      if (THINKING_PIPELINE[level].verifiedMeal) {
        return await trackMealThinking(config, level, userMessage, images, onProgress);
      }

      const lang = config.language ?? DEFAULT_LANG;
      const foundation = await foundationFoodsFor(config, 'estimate');
      const systemPrompt = await getMealAnalysisPrompt(foundation, lang);
      const fns = getTrackMealFunctions(foundation !== null, mealSchemaDialect(config));
      const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

      if (images.length > 0) {
        const fromPhoto = await generateWithImagesStructured<TrackMealResponse>(
          config,
          systemPrompt,
          images,
          schema,
          'trackMeal',
          userMessage,
          'extraction',
          { prepared: true }
        );
        return fromPhoto
          ? await refineTrackedMeals(config, fromPhoto, onProgress, foundation)
          : null;
      }

      const parsed = await generateStructured<TrackMealResponse>(
        config,
        systemPrompt,
        userMessage,
        schema,
        'trackMeal'
      );
      return parsed ? await refineTrackedMeals(config, parsed, onProgress, foundation) : null;
    } catch (error) {
      notifyUserFacingAiError(error);
      reportAiError(error, 'coachAI.trackMeal');
      return null;
    }
  }

  /**
   * Estimate nutrition from a meal photo.
   * Returns a TrackMealResponse with ingredients breakdown, similar to trackMeal.
   */
  async function estimateNutritionFromPhoto(
    config: CoachAIConfig,
    photos: string | readonly string[],
    context?: MealPhotoContext | null,
    onProgress?: MealEstimateProgressListener
  ): Promise<TrackMealResponse | null> {
    // One photo or up to `MAX_MEAL_IMAGES` of the same meal, as data URLs or bare base64.
    const rawImages = toMealImages(photos).slice(0, MAX_MEAL_IMAGES);
    if (rawImages.length === 0) {
      return null;
    }

    const photoCount = rawImages.length;
    if (config.provider === 'on-device') {
      if (config.engine !== 'gguf') {
        throw new OnDeviceUnavailableError('photosUnsupported');
      }

      if (!config.vision) {
        throw new OnDeviceUnavailableError('photosNotInstalled');
      }

      try {
        return await estimateMealFromPhotoOnDevice(config, rawImages, context, onProgress);
      } catch (error) {
        reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
        throw error;
      }
    }

    try {
      reportMealProgress(onProgress, { step: 'reading', photo: true, photoCount });
      // Prepared once: every look, sample and review below reuses these, never re-encodes them.
      const images = await prepareMealImages(config, rawImages);
      const multiPhotoNote = getMultiPhotoMealNote(photoCount);
      const contextText = formatMealPhotoContext(context);
      const level = await thinkingLevelFor(config);
      if (THINKING_PIPELINE[level].verifiedMeal) {
        const thinkingUserMessage = [
          photoCount > 1 ? 'Analyze these meal photos.' : 'Analyze this meal photo.',
          multiPhotoNote,
          contextText,
        ]
          .filter(Boolean)
          .join('\n');

        return await trackMealThinking(config, level, thinkingUserMessage, images, onProgress);
      }

      const customPrompts = await getActiveCustomPrompts();
      const foundation = await foundationFoodsFor(config, 'estimate');

      const baseSystemPrompt = await getMealAnalysisPrompt(foundation);
      const systemPrompt = customPrompts
        ? `${baseSystemPrompt}\n\n${customPrompts}`
        : baseSystemPrompt;

      // Use getTrackMealFunctions to get an array of meals with ingredients breakdown
      const fns = getTrackMealFunctions(foundation !== null, mealSchemaDialect(config));
      const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

      const userMessageSuffix =
        [multiPhotoNote, contextText].filter(Boolean).join('\n') || undefined;

      const parsed = await generateWithImagesStructured<TrackMealResponse>(
        config,
        systemPrompt,
        images,
        schema,
        'trackMeal',
        userMessageSuffix,
        'extraction',
        { prepared: true }
      );

      // Foundation-food matches arrive with zero macros: the lookup fills the real values in, and an
      // id the database does not have is estimated in a follow-up request instead of logged at 0 kcal.
      return parsed?.meals
        ? await refineTrackedMeals(config, parsed, onProgress, foundation)
        : (parsed ?? null);
    } catch (error) {
      notifyUserFacingAiError(error);
      reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
      return null;
    }
  }

  return { trackMeal, estimateNutritionFromPhoto, refineTrackedMeals, reportMealProgress };
}
