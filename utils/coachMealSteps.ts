import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { DEFAULT_LANG } from '@/lang/lang';

import { AiCancelledError } from './aiErrors';
import { runSamples } from './aiPasses';
import { extractionSamples } from './aiThinkingLevel';
import {
  type CoachAIConfig,
  foundationFoodsFor,
  generateStructured,
  generateWithImagesStructured,
  mealSchemaDialect,
  type MissingIngredientMacrosResponse,
  type RecipeExtractionResponse,
  type RecipeIngredient,
  reportAiError,
  schemaOfFunction,
  thinkingLevelFor,
  type TrackedMeal,
  type TrackMealIngredient,
  type TrackMealResponse,
} from './coachAI';
import { matchIngredientsToOwnFoods } from './coachMealFoods';
import { alignEstimates } from './foodName';
import { resolveFoundationRefs, resolveFoundationRefsInMeals } from './foundationFoodList';
import type { MealEstimateProgressListener } from './mealEstimateProgress';
import type { MealImage } from './mealImages';
import {
  formatMealObservation,
  type MealObservation,
  parseMealObservation,
} from './mealObservation';
import { ingredientMacroProblems, reconcileIngredientMacros } from './mealPlausibility';
import { applyMealReview, type MealReview } from './mealReview';
import {
  fromLabelPer100g,
  isFiberTracked,
  medianLabel,
  type OnDeviceEstimatedIngredient,
  type OnDeviceLabel,
  withLabelFiber,
} from './onDeviceMacros';
import {
  type FoundationFoodsPrompt,
  getEstimateMissingIngredientsFunctions,
  getMealObservationFunctions,
  getMealObservationPrompt,
  getMealReviewFunctions,
  getMealReviewPrompt,
  getMissingIngredientsMacrosPrompt,
  getOnDeviceFiberFunctions,
  getOnDeviceFiberPrompt,
  getOnDeviceLabelFunctions,
  getOnDeviceLabelPrompt,
  getOnDeviceLabelUserMessage,
  getRecipeExtractionFunctions,
  getRecipeExtractionPrompt,
  withCustomPrompts,
} from './prompts';

// The building blocks of a meal estimate: reading a recipe, a first look, estimating what is left,
// checking the numbers, reviewing. `coachMealSampling` composes them per thinking level and
// `coachMealEstimate` is the entry point; nothing here knows about thinking levels.

export async function extractRecipe(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = [],
  observation?: MealObservation
): Promise<RecipeExtractionResponse | null> {
  const lang = config.language ?? DEFAULT_LANG;
  const foundation = await foundationFoodsFor(config, 'recipe');
  const systemPrompt = await withCustomPrompts(await getRecipeExtractionPrompt(foundation, lang));
  const fns = getRecipeExtractionFunctions(foundation !== null, mealSchemaDialect(config));
  const schema = schemaOfFunction(fns);
  // A first look is notes for the request, never a replacement for the photo or description. They
  // are code-written, so they ride as a follow-up instead of through the user-message sanitizer.
  const followUp = observation ? { instruction: formatMealObservation(observation) } : undefined;

  if (images.length > 0) {
    const fromPhoto = await generateWithImagesStructured<RecipeExtractionResponse>(
      config,
      systemPrompt,
      images,
      schema,
      'extractRecipe',
      userMessage,
      'extraction',
      { prepared: true, followUp }
    );

    // A reference number the model returned becomes the real food id here, against the list it saw.
    return fromPhoto ? resolveFoundationRefsInMeals(fromPhoto, foundation) : null;
  }

  const fromText = await generateStructured<RecipeExtractionResponse>(
    config,
    systemPrompt,
    userMessage,
    schema,
    'extractRecipe',
    'extraction',
    { followUp }
  );

  return fromText ? resolveFoundationRefsInMeals(fromText, foundation) : null;
}

/**
 * One structured "first look" at a meal (Tokenmaxxing): what is there, how big it looks, what fat,
 * sauce or drink is visible or likely, and what is unsure. No grams and no macros, so seeing stays
 * apart from estimating. A reply that cannot be read is no look (null), never a failed estimate.
 */
export async function observeMeal(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = []
): Promise<MealObservation | null> {
  const systemPrompt = getMealObservationPrompt(config.language ?? DEFAULT_LANG);
  const schema = schemaOfFunction(getMealObservationFunctions());

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

export async function estimateMissingIngredients(
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
  const schema = schemaOfFunction(fns);

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
      schemaOfFunction(labelFns),
      'estimateMissingIngredients'
    );
  // From High up each label is asked for more than once and every figure is the median.
  const readings = extractionSamples(await thinkingLevelFor(config));
  const replies =
    readings <= 1
      ? [await askForLabels()].filter((reply) => reply != null)
      : await runSamples(config, readings, askForLabels, {
          onDroppedFailure: (error) => reportAiError(error, 'coachAI.onDeviceLabelReading'),
        });
  if (replies.length === 0) {
    return null;
  }

  const answers = replies.map((reply) => alignEstimates(newIngredients, reply.foods ?? []));
  const computed = newIngredients.flatMap((target, index) => {
    const label = medianLabel(answers.flatMap((reply) => reply[index] ?? []));

    return label ? [fromLabelPer100g({ ...label, name: target.name }, target.grams)] : [];
  });
  if (computed.length === 0) {
    return { ingredients: [] };
  }

  const withFiber = isFiberTracked(await SettingsService.getNutritionDisplay())
    ? await bestEffort(
        'coachAI.estimateOnDeviceFiber',
        () => addOnDeviceFiber(config, computed),
        () => computed
      )
    : computed;

  return { ingredients: withFiber };
}

/** One more request for the fiber per 100 g of what was computed (only when fiber is tracked). */
async function addOnDeviceFiber(
  config: CoachAIConfig,
  computed: OnDeviceEstimatedIngredient[]
): Promise<OnDeviceEstimatedIngredient[]> {
  const fiberFns = getOnDeviceFiberFunctions();
  const reply = await generateStructured<{ foods: { name: string; fiber: number }[] }>(
    config,
    getOnDeviceFiberPrompt(computed.map(({ name }) => name)),
    getOnDeviceLabelUserMessage(),
    schemaOfFunction(fiberFns),
    'estimateFiber'
  );
  const answers = alignEstimates(computed, reply?.foods ?? []);

  return computed.map((ingredient, index) => {
    const answer = answers[index];

    return answer ? withLabelFiber(ingredient, answer.fiber) : ingredient;
  });
}

/** Progress is a courtesy to the screen: a listener that throws must never fail an estimate. */
export function reportMealProgress(
  listener: MealEstimateProgressListener | undefined,
  progress: Parameters<MealEstimateProgressListener>[0]
): void {
  try {
    listener?.(progress);
  } catch {
    // Ignored on purpose.
  }
}

/**
 * Runs a step that may improve an answer but must never fail it: a failure is reported and
 * `fallback()` stands in for the result. Only a cancel propagates.
 */
export async function bestEffort<T>(
  context: string,
  run: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, context);

    return fallback();
  }
}

/** An ingredient the model only named: its name and grams, and no numbers yet. */
function numberless(ingredient: { name: string; grams: number }): TrackMealIngredient {
  return {
    name: ingredient.name,
    grams: ingredient.grams,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  };
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
 * One request that estimates the numbers of `asked`, in the order asked. An ingredient the model
 * left out comes back as null; `known` are the foods already settled, shown for context.
 */
async function estimateIngredients(
  config: CoachAIConfig,
  mealName: string,
  asked: { name: string; grams: number }[],
  known: TrackMealIngredient[]
): Promise<(TrackMealIngredient | null)[]> {
  const estimates =
    (await estimateMissingIngredients(config, asked, known, mealName))?.ingredients ?? [];

  return alignEstimates(asked, estimates).map((found, index) =>
    found ? withEstimatedMacros(numberless(asked[index]), found) : null
  );
}

/**
 * Asks for the numbers of `subset` (ingredients of `ingredients`) and lets `merge` decide what each
 * one becomes, given its estimate or null when there is none; the rest pass through. Best effort:
 * a failed request is reported and every merge gets no estimate.
 */
async function reestimateSubset(
  config: CoachAIConfig,
  mealName: string,
  ingredients: TrackMealIngredient[],
  subset: TrackMealIngredient[],
  context: string,
  merge: (
    ingredient: TrackMealIngredient,
    estimate: TrackMealIngredient | null
  ) => TrackMealIngredient
): Promise<TrackMealIngredient[]> {
  const estimates = await bestEffort(
    context,
    () =>
      estimateIngredients(
        config,
        mealName,
        subset.map(({ name, grams }) => ({ name, grams })),
        ingredients.filter((ingredient) => ingredient.foodId)
      ),
    () => subset.map(() => null)
  );

  return ingredients.map((ingredient) => {
    const index = subset.indexOf(ingredient);

    return index < 0 ? ingredient : merge(ingredient, estimates[index]);
  });
}

type RecheckedIngredients = {
  ingredients: TrackMealIngredient[];
  /** The recheck had ingredients to re-estimate, a sign the first reading was unsure. */
  rechecked: boolean;
};

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
export async function recheckImplausibleIngredients(
  config: CoachAIConfig,
  mealName: string,
  ingredients: TrackMealIngredient[],
  onProgress?: MealEstimateProgressListener
): Promise<RecheckedIngredients> {
  const suspects = ingredients.filter(
    (ingredient) => !ingredient.foodId && ingredientMacroProblems(ingredient).length > 0
  );
  if (suspects.length === 0) {
    return { ingredients, rechecked: false };
  }

  reportMealProgress(onProgress, { step: 'rechecking', count: suspects.length });

  return {
    rechecked: true,
    ingredients: await reestimateSubset(
      config,
      mealName,
      ingredients,
      suspects,
      'coachAI.recheckImplausibleIngredients',
      (ingredient, estimate) => {
        const better = estimate ? withEstimatedMacros(ingredient, estimate) : ingredient;

        return reconcileIngredientMacros(
          ingredientMacroProblems(better).length < ingredientMacroProblems(ingredient).length
            ? better
            : ingredient
        );
      }
    ),
  };
}

async function fillUnnumberedClaimedIngredients(
  config: CoachAIConfig,
  mealName: string,
  ingredients: TrackMealIngredient[],
  claimedFoodId: readonly boolean[],
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealIngredient[]> {
  const unnumbered = ingredients.filter(
    (ingredient, index) => claimedFoodId[index] && !ingredient.foodId && hasNoNumbers(ingredient)
  );
  if (unnumbered.length === 0) {
    return ingredients;
  }

  reportMealProgress(onProgress, {
    step: 'estimating',
    count: unnumbered.length,
    matched: ingredients.filter((ingredient) => ingredient.foodId).length,
  });

  return reestimateSubset(
    config,
    mealName,
    ingredients,
    unnumbered,
    'coachAI.refineTrackedMeals',
    (ingredient, estimate) => (estimate ? withEstimatedMacros(ingredient, estimate) : ingredient)
  );
}

/**
 * Post-estimate normalization of a one-request or reviewed meal: resolves food ids against the
 * database, optionally estimates claimed-id items whose id was dropped with zero macros
 * (`claimedFoodId[i]`: ingredient `i` named a food id), then rechecks any remaining implausible
 * numbers. The verified path does not come through here: `completeMealIngredients` already looked
 * its foods up.
 */
export async function finalizeMealIngredients(
  config: CoachAIConfig,
  mealName: string,
  rawIngredients: TrackMealIngredient[],
  onProgress?: MealEstimateProgressListener,
  claimedFoodId?: readonly boolean[]
): Promise<TrackMealIngredient[]> {
  // Deliberately unguarded: a failed lookup must reject, never leave every id looking unmatched.
  let ingredients = await NutritionService.normalizeAiMealIngredients(rawIngredients);

  if (claimedFoodId) {
    ingredients = await fillUnnumberedClaimedIngredients(
      config,
      mealName,
      ingredients,
      claimedFoodId,
      onProgress
    );
  }

  return (await recheckImplausibleIngredients(config, mealName, ingredients, onProgress))
    .ingredients;
}

/**
 * What the model's one-request estimate gets before it is shown or logged. The model may name a
 * food id this database does not have (it invents ids, or sends the string "null"); the lookup then
 * drops the id and keeps the model's numbers, which for a foundation-food match are zeros, so the
 * ingredient would be logged at 0 kcal. Those ingredients are estimated in a follow-up request, the
 * same step the verified path makes; then every ingredient that is not the person's own food gets
 * the plausibility check. With nothing to fix it makes no request.
 */
export async function refineTrackedMeals(
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

    meals.push({
      ...meal,
      ingredients: await finalizeMealIngredients(
        config,
        meal.mealName ?? meal.mealType,
        resolveFoundationRefs(original, foundation),
        onProgress,
        claimedFoodId
      ),
    });
  }

  return { ...response, meals };
}

/**
 * Turns the ingredients of one meal that the model only named into numbers: a food id counts only
 * once the database confirms it (the model sometimes sends the string "null" or an invented id), what
 * is left without one is looked up BY NAME in the person's own foods (so a food they already have is
 * never re-estimated), and only the rest is estimated. Every ingredient asked for comes back, with the
 * grams asked for: one the estimate left out is asked for once more on its own (`rechecked`: a sign
 * the first reading was unsure) and, if that fails too, stays without numbers rather than
 * disappearing from the meal. The foods it returns are final: they were looked up here.
 */
export async function completeMealIngredients(
  config: CoachAIConfig,
  mealName: string,
  ingredients: readonly RecipeIngredient[],
  onProgress?: MealEstimateProgressListener
): Promise<RecheckedIngredients> {
  const claimedSource = ingredients.filter((ingredient) => ingredient.foodId);
  const claimedStubs: TrackMealIngredient[] = claimedSource.map((ingredient) => ({
    ...numberless(ingredient),
    foodId: ingredient.foodId,
  }));
  const normalizedClaimed = await NutritionService.normalizeAiMealIngredients(claimedStubs);
  const claimed = normalizedClaimed.filter((ingredient) => ingredient.foodId);
  // The lookup keeps its input order, so an unconfirmed claim is found by position and keeps the
  // English name the model gave it.
  const unconfirmed = claimedSource.filter((_, index) => !normalizedClaimed[index]?.foodId);
  const byName = await matchIngredientsToOwnFoods([
    ...ingredients.filter((ingredient) => !ingredient.foodId),
    ...unconfirmed,
  ]);
  const matched = [...claimed, ...byName.matched];
  if (byName.unmatched.length === 0) {
    return { ingredients: matched, rechecked: false };
  }

  reportMealProgress(onProgress, {
    step: 'estimating',
    count: byName.unmatched.length,
    matched: matched.length,
  });
  const targets = byName.unmatched;
  const estimates = await estimateIngredients(config, mealName, targets, matched);
  const missing = estimates.flatMap((estimate, index) => (estimate ? [] : [index]));
  if (missing.length > 0) {
    reportMealProgress(onProgress, { step: 'rechecking', count: missing.length });
    const again = await bestEffort(
      'coachAI.completeMealIngredients',
      () =>
        estimateIngredients(
          config,
          mealName,
          missing.map((index) => targets[index]),
          matched
        ),
      () => missing.map(() => null)
    );
    missing.forEach((index, position) => {
      estimates[index] = again[position];
    });
  }

  return {
    ingredients: [
      ...matched,
      ...estimates.map((estimate, index) => estimate ?? numberless(targets[index])),
    ],
    rechecked: missing.length > 0,
  };
}

/** A meal estimated by the verified path, and whether any of it needed a second look. */
export type VerifiedMeal = { response: TrackMealResponse; rechecked: boolean };

/**
 * The verified meal estimate, used from the Medium thinking level up: it separates what the model can
 * read (the recipe: meals, ingredients, grams, the foods of the person it recognises) from what it
 * must work out (the numbers of what is left), checking each claimed food id against the database
 * in between. Slower than one request, with more of the work done by code and less left to chance.
 */
export async function trackMealVerified(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener,
  observation?: MealObservation
): Promise<VerifiedMeal | null> {
  const recipeResponse = await extractRecipe(config, userMessage, images, observation);
  if (!recipeResponse?.meals?.length) {
    return null;
  }

  let rechecked = false;
  const meals: TrackedMeal[] = [];
  for (const meal of recipeResponse.meals) {
    const completed = await completeMealIngredients(
      config,
      meal.mealName,
      meal.ingredients,
      onProgress
    );
    const checked = await recheckImplausibleIngredients(
      config,
      meal.mealName ?? meal.mealType,
      completed.ingredients,
      onProgress
    );

    rechecked ||= completed.rechecked || checked.rechecked;
    meals.push({
      mealType: meal.mealType,
      mealName: meal.mealName,
      ingredients: checked.ingredients,
    });
  }

  return { response: { meals }, rechecked };
}

export function countMealProblems(response: TrackMealResponse): number {
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
  const schema = schemaOfFunction(getMealReviewFunctions(mealSchemaDialect(config)));

  if (images.length > 0) {
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

export async function reviewTrackedMeal(
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
  const { matched: fromOwnFoods, unmatched: toEstimate } = await matchIngredientsToOwnFoods(added);
  const estimated =
    toEstimate.length > 0
      ? await estimateIngredients(config, mealName, toEstimate, [
          ...corrected.ingredients.filter((ingredient) => ingredient.foodId),
          ...fromOwnFoods,
        ])
      : [];
  const additions = [
    ...fromOwnFoods,
    ...estimated.flatMap((estimate) => (estimate ? [estimate] : [])),
  ];
  if (additions.length === 0) {
    return corrected;
  }

  return {
    ...corrected,
    ingredients: await finalizeMealIngredients(
      config,
      mealName,
      [...corrected.ingredients, ...additions],
      onProgress
    ),
  };
}
