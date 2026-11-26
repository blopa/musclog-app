import { FoodService } from '@/database/services/FoodService';
import { NutritionService } from '@/database/services/NutritionService';
import { reportAiError } from '@/utils/coachAI';
import { matchIngredientsToOwnFoods } from '@/utils/coachMealFoods';

jest.mock('@/database/services/FoodService', () => ({
  FoodService: {
    searchFoods: jest.fn(),
    searchFoodsByTerms: jest.fn(),
  },
}));

jest.mock('@/utils/coachAI', () => ({ reportAiError: jest.fn() }));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: jest.fn(async (ingredients: unknown[]) => ingredients),
  },
}));

const mockSearchFoodsByTerms = FoodService.searchFoodsByTerms as jest.Mock;
const mockNormalize = NutritionService.normalizeAiMealIngredients as jest.Mock;

describe('coachMealFoods batched lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('batches all ingredients in matchIngredientsToOwnFoods into a single query with one deduplicated term each', async () => {
    mockSearchFoodsByTerms.mockResolvedValue([
      {
        id: 'f-chicken',
        name: 'Chicken breast',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0,
        nutritionBasis: 'per_100g',
      },
      {
        id: 'f-oil',
        name: 'Olive oil',
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        fiber: 0,
        nutritionBasis: 'per_100g',
      },
    ]);
    mockNormalize.mockImplementation(async (stubs: { foodId: string }[]) =>
      stubs.map((stub) => ({ ...stub, kcal: 100 }))
    );

    const res = await matchIngredientsToOwnFoods([
      { name: 'Chicken breast', grams: 150 },
      { name: 'Chicken thigh', grams: 100 },
      { name: 'Olive oil', grams: 10 },
    ]);

    expect(mockSearchFoodsByTerms).toHaveBeenCalledTimes(1);
    // One word per ingredient, the longest (every match carries it), deduplicated, and no limit:
    // a cut in name order could hide the right food or one of two tied foods.
    expect(mockSearchFoodsByTerms).toHaveBeenCalledWith(['chicken', 'olive'], {
      includeDescription: true,
    });
    expect(res.matched.map((item) => item.foodId)).toEqual(['f-chicken', 'f-oil']);
    expect(res.unmatched).toEqual([{ name: 'Chicken thigh', grams: 100 }]);
    expect(reportAiError).not.toHaveBeenCalled();
  });
});
