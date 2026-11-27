import type { MealType } from '@/database/models/NutritionLog';
import i18n, { AVAILABLE_LANGUAGES } from '@/lang/lang';

/**
 * Words that name a meal rather than a food. A small voice model sometimes puts a meal name in the
 * food slot ("search for the food 'breakfast'"); the caller uses this to open the copy review
 * instead. The words are the app's own meal names in every bundled language, since a person may
 * speak a language other than the one a food was named in.
 */

type NamedMeal = Exclude<MealType, 'other'>;

const MEAL_LABEL_KEYS: Record<NamedMeal, readonly string[]> = {
  breakfast: ['food.meals.breakfast'],
  lunch: ['food.meals.lunch'],
  dinner: ['food.meals.dinner'],
  snack: ['food.meals.snack', 'food.meals.snacks'],
};

/** Everyday words people say that the app never shows as a meal's name. */
const SPOKEN_ONLY_WORDS: Record<NamedMeal, readonly string[]> = {
  breakfast: ['pequeno almoço'],
  lunch: [],
  dinner: ['supper', 'avondeten', 'abendbrot'],
  snack: ['tussendoortje', 'goûter', 'merenda'],
};

function normalizeMealText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim()
    .replace(/^[.,;:!?¡¿"']+|[.,;:!?¡¿"']+$/g, '')
    .trim();
}

let mealByWord: Map<string, MealType> | null = null;

function buildMealByWord(): Map<string, MealType> {
  const words = new Map<string, MealType>();
  const translators = AVAILABLE_LANGUAGES.map((language) => i18n.getFixedT(language));
  for (const meal of Object.keys(MEAL_LABEL_KEYS) as NamedMeal[]) {
    const labels = MEAL_LABEL_KEYS[meal].flatMap((key) => translators.map((t) => String(t(key))));
    for (const word of [...labels, ...SPOKEN_ONLY_WORDS[meal]]) {
      words.set(normalizeMealText(word), meal);
    }
  }

  return words;
}

/** The meal a whole text names, or null when it names none (or names a food as well). */
export function mealOfWord(text: string): MealType | null {
  mealByWord ??= buildMealByWord();

  return mealByWord.get(normalizeMealText(text)) ?? null;
}
