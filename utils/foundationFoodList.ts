/**
 * The foundation foods a meal estimate offers the model, and the way back from what it answers.
 *
 * The model is shown every foundation food as one short line, `reference|name` (`12|Broccoli, raw`):
 * no UUID (36 characters a line that no model needs) and no macros (a matched food's numbers come
 * from the database, scaled to the grams, in `NutritionService.normalizeAiMealIngredients`). It
 * answers with the reference number, and `resolveFoundationRefs` turns that back into the real food
 * id BEFORE anything looks the id up. The reference-to-id map is built from the very lines sent, in
 * the same call, so a request can never read an answer against a different list than the one the
 * model saw.
 *
 * The list is sorted (name, then id) so the prompt is identical from one request to the next and a
 * provider's prompt cache can hit; nothing in it is random.
 *
 * Pure: the database read lives in `FoodService`, the instruction text in `utils/prompts.ts`.
 */

/**
 * The most foods ever offered. About 530 foundation foods are seeded; the cap is a safety net so a
 * future import cannot grow every request without anyone noticing.
 */
export const FOUNDATION_FOODS_PROMPT_CAP = 1000;

export type FoundationFoodSource = { id: string; name: string };

export type FoundationFoodList = {
  /** One `reference|name` line per food, in the order sent. */
  listing: string;
  /** What each reference stands for (reference as sent -> real food id), built from `listing`. */
  idByRef: ReadonlyMap<string, string>;
  count: number;
};

/** Whatever carries the map: a list, or the prompt block a caller holds. */
export type FoundationRefs = { idByRef: ReadonlyMap<string, string> };

/** A name on one line: a stray newline would end the food's line and make a second one. */
function singleLine(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Code-unit order, not locale order: the same list on every device and every runtime. */
function compare(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/**
 * The list for these foods, or null when there is nothing to offer. A food without a name or an id
 * is left out (a line with no name tells the model nothing, and an id-less one could never be
 * resolved).
 */
export function buildFoundationFoodList(
  foods: readonly FoundationFoodSource[],
  cap: number = FOUNDATION_FOODS_PROMPT_CAP
): FoundationFoodList | null {
  const usable = foods
    .map((food) => ({ id: food.id, name: singleLine(food.name ?? '') }))
    .filter((food) => food.id && food.name)
    .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id))
    .slice(0, Math.max(0, cap));
  if (usable.length === 0) {
    return null;
  }

  const idByRef = new Map<string, string>();
  const lines = usable.map((food, index) => {
    const reference = String(index + 1);
    idByRef.set(reference, food.id);

    return `${reference}|${food.name}`;
  });

  return { listing: lines.join('\n'), idByRef, count: usable.length };
}

/**
 * The food id a model's reference stands for, or null for one that names nothing: not a number,
 * a number past the list, or no list at all. Whitespace and leading zeros are tolerated; anything
 * else ("12|Broccoli", "#12", "abc", null) is malformed and reads as an invented id.
 */
export function foundationFoodIdFor(
  reference: unknown,
  refs: FoundationRefs | null
): string | null {
  if (!refs) {
    return null;
  }

  let text = '';
  if (typeof reference === 'number' && Number.isInteger(reference)) {
    text = String(reference);
  } else if (typeof reference === 'string') {
    text = reference.trim();
  }

  if (!/^\d{1,6}$/.test(text)) {
    return null;
  }

  return refs.idByRef.get(String(Number.parseInt(text, 10))) ?? null;
}

/**
 * The ingredients with each `foodId` reference turned into the real food id. A reference that names
 * nothing is dropped from the ingredient, which is exactly how an invented id has always ended: the
 * ingredient reads as unmatched and gets estimated. With no list nothing was offered, so the
 * ingredients are returned as they are (an id then cannot be one of ours, and the database lookup
 * drops it like any other unknown id).
 */
export function resolveFoundationRefs<T extends { foodId?: string }>(
  ingredients: readonly T[],
  refs: FoundationRefs | null
): T[] {
  if (!refs) {
    return [...ingredients];
  }

  return ingredients.map((ingredient) => {
    if (!('foodId' in ingredient)) {
      return ingredient;
    }

    const { foodId, ...rest } = ingredient;
    const id = foundationFoodIdFor(foodId, refs);

    return (id ? { ...rest, foodId: id } : rest) as T;
  });
}

/** A reply whose meals each carry ingredients (recipe, one-request estimate, meal plan). */
export type MealsWithIngredients<I extends { foodId?: string }> = {
  meals?: ({ ingredients?: I[] } | null | undefined)[] | null;
};

/** `resolveFoundationRefs` over every meal of a reply; the reply is returned as it is when nothing was offered. */
export function resolveFoundationRefsInMeals<R extends MealsWithIngredients<{ foodId?: string }>>(
  response: R,
  refs: FoundationRefs | null
): R {
  if (!refs || !Array.isArray(response.meals)) {
    return response;
  }

  return {
    ...response,
    meals: response.meals.map((meal) =>
      meal && Array.isArray(meal.ingredients)
        ? { ...meal, ingredients: resolveFoundationRefs(meal.ingredients, refs) }
        : meal
    ),
  };
}
