import { NutritionService } from '../NutritionService';
import { database } from '@/database';
import Food from '@/database/models/Food';
import NutritionLog from '@/database/models/NutritionLog';
import { Q } from '@nozbe/watermelondb';
import { writeNutritionLogToHealthConnect } from '@/services/healthConnectNutrition';

jest.mock('@/database', () => {
  const mockCreate = jest.fn((callback) => {
    const record = { id: 'test-log-id' };
    callback(record);
    return Promise.resolve(record);
  });
  const mockFind = jest.fn((id) => Promise.resolve({
    id,
    name: 'Test Food',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiber: 2,
    micros: '{}',
    resolvedNutritionBasis: 'per_100g'
  }));
  const mockWhere = jest.fn().mockReturnValue('where-clause');
  const mockOneOf = jest.fn().mockReturnValue('oneOf-clause');
  return {
    database: {
      get: jest.fn((tableName) => {
        if (tableName === 'foods') {
          return {
            find: mockFind,
            create: mockCreate,
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue([
                { id: 'food-1', name: 'Food 1', resolvedNutritionBasis: 'per_100g' },
                { id: 'food-2', name: 'Food 2', resolvedNutritionBasis: 'per_100g' }
              ])
            })
          };
        } else if (tableName === 'nutrition_logs') {
          return {
            create: mockCreate,
          };
        }
      }),
      write: jest.fn((callback) => callback()),
    }
  };
});

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn().mockReturnValue('where-clause'),
    oneOf: jest.fn().mockReturnValue('oneOf-clause'),
    eq: jest.fn(),
  }
}));

jest.mock('@/database/encryptionHelpers', () => ({
  encryptNutritionLogSnapshot: jest.fn().mockResolvedValue({
    loggedFoodName: 'encrypted-name',
    loggedCalories: 'encrypted-cals',
    loggedProtein: 'encrypted-prot',
    loggedCarbs: 'encrypted-carbs',
    loggedFat: 'encrypted-fat',
    loggedFiber: 'encrypted-fiber',
    loggedMicrosJson: 'encrypted-micros',
  }),
}));

jest.mock('@/utils/calendarDate', () => ({
  consumedDateTimeOnDay: jest.fn().mockReturnValue({ timestamp: 1234567890, timezone: 'UTC' }),
}));

jest.mock('@/utils/carbsConvention', () => ({
  aiIngredientMacrosPer100g: jest.fn().mockReturnValue({
    kcal: 100, protein: 10, carbs: 10, fat: 5, fiber: 2
  }),
}));

jest.mock('@/services/healthConnectNutrition', () => ({
  writeNutritionLogToHealthConnect: jest.fn(),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));


describe('Performance: logCustomMealsBatch', () => {
  it('measures time for large batch', async () => {
    const ingredients = Array.from({ length: 50 }).map((_, i) => ({
      name: `Ingredient ${i}`,
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
      grams: 150,
      foodId: `food-${i}`
    }));

    const start = performance.now();
    await NutritionService.logCustomMealsBatch(ingredients, new Date(), 'breakfast' as any);
    const end = performance.now();
    console.log(`logCustomMealsBatch took ${end - start} ms`);
    expect(end - start).toBeLessThan(10000);
  });
});
