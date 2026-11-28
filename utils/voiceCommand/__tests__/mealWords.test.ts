import { AVAILABLE_LANGUAGES, default as i18n } from '@/lang/lang';
import { mealOfWord } from '@/utils/voiceCommand/mealWords';

describe('mealOfWord', () => {
  it.each([
    ['breakfast', 'breakfast'],
    ['desayuno', 'breakfast'],
    ['ontbijt', 'breakfast'],
    ['café da manhã', 'breakfast'],
    ['завтрак', 'breakfast'],
    ['Frühstück.', 'breakfast'],
    ['lunch', 'lunch'],
    ['almoço', 'lunch'],
    ['Mittagessen', 'lunch'],
    ['öğle yemeği', 'lunch'],
    ['cena', 'dinner'],
    ['Ужин', 'dinner'],
    ['Abendbrot', 'dinner'],
    ['akşam yemeği', 'dinner'],
    ['snack', 'snack'],
    ['merienda', 'snack'],
    ['tussendoortje', 'snack'],
    ['przekąska', 'snack'],
    ['PETIT DÉJEUNER', 'breakfast'],
    ['café-da-manhã', 'breakfast'],
    ['  Lunch!  ', 'lunch'],
    ['"dinner"', 'dinner'],
    ['¿supper?', 'dinner'],
    ['petit-déjeuner', 'breakfast'],
  ])('"%s" names %s', (text, meal) => {
    expect(mealOfWord(text)).toBe(meal);
  });

  it.each(['banana', 'chicken lunch box', 'lunch box', '', 'gisteren', 'comida'])(
    '"%s" names no meal',
    (text) => {
      expect(mealOfWord(text)).toBeNull();
    }
  );

  it.each(AVAILABLE_LANGUAGES)('knows the meal names the app shows in %s', (language) => {
    const t = i18n.getFixedT(language);

    expect(mealOfWord(String(t('food.meals.breakfast')))).toBe('breakfast');
    expect(mealOfWord(String(t('food.meals.lunch')))).toBe('lunch');
    expect(mealOfWord(String(t('food.meals.dinner')))).toBe('dinner');
    expect(mealOfWord(String(t('food.meals.snacks')))).toBe('snack');
  });
});
