import { FoodPortionService } from '@/database/services/FoodPortionService';
import { syncMealPortionFromForm } from '@/database/services/syncMealPortionFromForm';

jest.mock('@/database/services/FoodPortionService', () => ({
  FoodPortionService: {
    addPortionToMeal: jest.fn(async () => undefined),
    clearMealPortions: jest.fn(async () => undefined),
    createFoodPortion: jest.fn(async () => ({ id: 'mass-portion' })),
    createPrivateNamedPortion: jest.fn(async () => ({ id: 'named-portion' })),
  },
}));

const base = {
  defaultPortionName: '',
  fallbackPortionName: 'Serving',
  mealName: 'Meal',
  servingGrams: 0,
} as const;

describe('syncMealPortionFromForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only clears portions for per-recipe meals', async () => {
    await syncMealPortionFromForm('meal-1', { ...base, nutritionBasis: 'per_recipe' });

    expect(FoodPortionService.clearMealPortions).toHaveBeenCalledWith('meal-1');
    expect(FoodPortionService.addPortionToMeal).not.toHaveBeenCalled();
  });

  it('creates a private named default for per-serving meals', async () => {
    await syncMealPortionFromForm('meal-1', {
      ...base,
      defaultPortionName: ' Bowl ',
      nutritionBasis: 'per_serving',
    });

    expect(FoodPortionService.createPrivateNamedPortion).toHaveBeenCalledWith(
      'Bowl',
      'meal',
      'meal-1'
    );
    expect(FoodPortionService.addPortionToMeal).toHaveBeenCalledWith(
      'meal-1',
      'named-portion',
      true
    );
  });

  it('creates a private mass default for per-gram meals', async () => {
    await syncMealPortionFromForm('meal-1', { ...base, nutritionBasis: 'per_gram' });

    expect(FoodPortionService.createFoodPortion).toHaveBeenCalledWith(
      'Meal',
      1,
      undefined,
      'custom',
      {
        dedupe: false,
        kind: 'mass',
        ownerId: 'meal-1',
        ownerType: 'meal',
        scope: 'private',
      }
    );
    expect(FoodPortionService.addPortionToMeal).toHaveBeenCalledWith(
      'meal-1',
      'mass-portion',
      true
    );
  });
});
