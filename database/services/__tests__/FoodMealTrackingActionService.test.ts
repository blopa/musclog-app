import { FoodMealTrackingActionService } from '../FoodMealTrackingActionService';
import { NutritionService } from '../NutritionService';

jest.mock('@/database/database-instance', () => ({ database: {} }));
jest.mock('../FoodService', () => ({ FoodService: {} }));
jest.mock('../MealService', () => ({ MealService: {} }));
jest.mock('../NutritionService', () => ({ NutritionService: { updateNutritionLog: jest.fn() } }));
jest.mock('@/utils/externalFoodProduct', () => ({ resolveExternalFoodSource: jest.fn() }));
jest.mock('@/utils/openFoodFactsMapper', () => ({ extractLabelsFromOFFProduct: jest.fn() }));
jest.mock('@/utils/productName', () => ({ getProductName: jest.fn() }));

describe('FoodMealTrackingActionService existing log edits', () => {
  it('passes typed identity and tracking fields through the nutrition mutation service', async () => {
    const day = new Date(2026, 6, 14);
    const time = new Date(2026, 6, 14, 12, 30);

    const result = await FoodMealTrackingActionService.trackFoodOrMeal({
      target: { kind: 'foodLog', foodLog: { id: 'log-1', timezone: '+02:00', portionId: 'old' } },
      selection: {
        selectedDate: day,
        selectedTime: time,
        selectedMeal: 'dinner',
        servingSize: 250,
        isFavorite: false,
        mealScaleFactor: 1,
        resolvedFoodServingMode: false,
      },
      nutrition: {
        nutritionalData: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          saturatedFat: 0,
          sodium: 0,
        },
        effectiveMicrosPer100g: {},
        editedOverrides: null,
      },
    });

    expect(result).toEqual({ kind: 'foodLogUpdated' });
    expect(NutritionService.updateNutritionLog).toHaveBeenCalledWith('log-1', {
      amount: 250,
      date: Date.UTC(2026, 6, 14, 10, 30),
      mealType: 'dinner',
      portionId: null,
      timezone: '+02:00',
    });
  });
});
