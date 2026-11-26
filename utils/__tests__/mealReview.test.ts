import { applyMealReview } from '../mealReview';

const meal = {
  mealType: 'lunch' as const,
  mealName: 'Rice',
  ingredients: [
    { name: 'Rice', grams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
  ],
};

describe('applyMealReview', () => {
  it('carries the English name of a missing ingredient, trimmed, and none when it gave none', () => {
    const { added } = applyMealReview(meal, {
      missingIngredients: [
        { name: 'Azeite', englishName: '  olive oil ', grams: 10 },
        { name: 'Sal', englishName: '   ', grams: 1 },
        { name: 'Pimenta', grams: 1 },
      ],
      corrections: [],
    });

    expect(added).toEqual([
      { name: 'Azeite', englishName: 'olive oil', grams: 10 },
      { name: 'Sal', grams: 1 },
      { name: 'Pimenta', grams: 1 },
    ]);
  });

  it('scales a corrected ingredient by the gram ratio', () => {
    const { meal: out, added } = applyMealReview(meal, {
      corrections: [{ name: 'rice', grams: 200 }],
      missingIngredients: [],
    });
    expect(added).toEqual([]);
    expect(out.ingredients[0]).toMatchObject({ grams: 200, kcal: 260, protein: 5.4, fiber: 0.8 });
  });

  it('ignores unknown names and non-positive or non-finite grams', () => {
    const { meal: out, added } = applyMealReview(meal, {
      corrections: [
        { name: 'Beans', grams: 50 },
        { name: 'Rice', grams: 0 },
        { name: 'Rice', grams: Number.NaN },
        { name: 'Rice', grams: -5 },
      ],
      missingIngredients: [{ name: 'Oil', grams: 0 }],
    });
    expect(out).toEqual(meal);
    expect(added).toEqual([]);
  });

  it('returns missing ingredients without duplicating listed ones', () => {
    const { added } = applyMealReview(meal, {
      missingIngredients: [
        { name: 'Olive oil', grams: 10 },
        { name: 'olive oil', grams: 5 },
        { name: 'RICE', grams: 20 },
      ],
    });
    expect(added).toEqual([{ name: 'Olive oil', grams: 10 }]);
  });

  it('handles a null review', () => {
    expect(applyMealReview(meal, null)).toEqual({ meal, added: [] });
  });
});
