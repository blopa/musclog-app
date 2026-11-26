import { searchTermsFor } from '../localFoodPhoto';

const mockSearchFoodsByTerms = jest.fn();
const mockReportAiError = jest.fn();

jest.mock('@/database/services/FoodService', () => ({
  FoodService: {
    searchFoodsByTerms: (...args: unknown[]) => mockSearchFoodsByTerms(...args),
  },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { normalizeAiMealIngredients: jest.fn() },
}));
jest.mock('../coachAI', () => ({
  reportAiError: (...args: unknown[]) => mockReportAiError(...args),
}));

import { matchIngredientsToOwnFoods } from '../coachMealFoods';

describe('matchIngredientsToOwnFoods candidate search', () => {
  beforeEach(() => {
    mockSearchFoodsByTerms.mockReset();
    mockSearchFoodsByTerms.mockResolvedValue([]);
    mockReportAiError.mockReset();
  });

  it('queries only the first (longest) term of each ingredient, with no limit', async () => {
    await matchIngredientsToOwnFoods([
      { name: 'olive oil', grams: 10 },
      { name: 'smoked salmon fillet', grams: 120 },
    ]);

    expect(mockSearchFoodsByTerms).toHaveBeenCalledTimes(1);
    const [terms, options] = mockSearchFoodsByTerms.mock.calls[0];
    expect([...terms].sort()).toEqual(['olive', searchTermsFor('smoked salmon fillet')[0]].sort());
    expect(terms).not.toContain('oil');
    expect(options).toEqual({ includeDescription: true });
    expect(options).not.toHaveProperty('limit');
  });

  it('an ingredient named "olive oil" queries only "olive"', async () => {
    expect(searchTermsFor('olive oil')[0]).toBe('olive');

    await matchIngredientsToOwnFoods([{ name: 'olive oil', grams: 10 }]);

    expect(mockSearchFoodsByTerms.mock.calls[0][0]).toEqual(['olive']);
  });

  it('finds a stored accented name when the ingredient carries the same accents', async () => {
    const foods = [
      {
        id: 'acai-1',
        name: 'Açaí bowl',
        nutritionBasis: 'per_100g',
        calories: 90,
        protein: 2,
        carbs: 12,
        fat: 4,
        fiber: 3,
      },
    ];
    // SQL LIKE: case-insensitive for ASCII only, no accent folding.
    mockSearchFoodsByTerms.mockImplementation(async (terms: string[]) =>
      foods.filter((food) =>
        terms.some((term) => food.name.toLowerCase().includes(term.toLowerCase()))
      )
    );
    const { NutritionService } = jest.requireMock('@/database/services/NutritionService');
    NutritionService.normalizeAiMealIngredients.mockImplementation(
      async (stubs: { foodId?: string }[]) => stubs
    );

    const result = await matchIngredientsToOwnFoods([{ name: 'Açaí bowl', grams: 200 }]);

    expect(result.matched.map((item) => item.foodId)).toEqual(['acai-1']);
  });
});
