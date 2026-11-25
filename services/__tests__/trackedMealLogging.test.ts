import { trackedMealTotals } from '@/utils/trackedMealTotals';

import { logTrackedMeal } from '../trackedMealLogging';

const mockLogCustomMeal = jest.fn();
const mockLogCustomMealsBatch = jest.fn();

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    logCustomMeal: (...args: unknown[]) => mockLogCustomMeal(...args),
    logCustomMealsBatch: (...args: unknown[]) => mockLogCustomMealsBatch(...args),
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'group-1' }));

const date = new Date(2026, 10, 25);
const consumedTime = new Date(2026, 10, 25, 13, 30);

const chicken = {
  name: 'Chicken',
  grams: 100,
  kcal: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
};
const rice = {
  name: 'Rice',
  grams: 100,
  kcal: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
  foodId: 'food-rice',
};

describe('logTrackedMeal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs a meal of several foods as separate foods that keep their ids and fiber', async () => {
    await logTrackedMeal({
      ingredients: [chicken, rice],
      date,
      mealType: 'lunch',
      portionGrams: 400,
      mealName: 'Chicken and rice',
      imageUrl: 'file:///meal.jpg',
      consumedTime,
    });

    expect(mockLogCustomMeal).not.toHaveBeenCalled();
    expect(mockLogCustomMealsBatch).toHaveBeenCalledTimes(1);
    const [foods, loggedDate, mealType, options] = mockLogCustomMealsBatch.mock.calls[0];
    // 200 g of food logged as 400 g: every food doubles.
    expect(foods).toEqual([
      expect.objectContaining({ name: 'Chicken', calories: 330, protein: 62, grams: 200 }),
      expect.objectContaining({
        name: 'Rice',
        calories: 260,
        fiber: 0.8,
        grams: 200,
        foodId: 'food-rice',
      }),
    ]);
    expect(loggedDate).toBe(date);
    expect(mealType).toBe('lunch');
    expect(options).toEqual({
      groupId: 'group-1',
      loggedMealName: 'Chicken and rice',
      imageUrl: 'file:///meal.jpg',
      consumedTime,
    });
  });

  it('logs a single food on its own, linked to its food when it has one', async () => {
    await logTrackedMeal({
      ingredients: [rice],
      date,
      mealType: 'dinner',
      portionGrams: 150,
      mealName: 'Rice',
      imageUrl: 'file:///meal.jpg',
      consumedTime,
    });

    expect(mockLogCustomMealsBatch).not.toHaveBeenCalled();
    const [food, , mealType, grams, options] = mockLogCustomMeal.mock.calls[0];
    expect(food).toEqual(
      expect.objectContaining({ name: 'Rice', foodId: 'food-rice', fiber: 0.6, calories: 195 })
    );
    // A matched food keeps its own picture, not the photo of the plate.
    expect(food.imageUrl).toBeUndefined();
    expect(mealType).toBe('dinner');
    expect(grams).toBe(150);
    expect(options).toEqual(expect.objectContaining({ consumedTime }));
  });
});

describe('trackedMealTotals', () => {
  it('adds the fiber of an estimated food to its net carbs, but not of a matched food', () => {
    const estimated = {
      name: 'Bar',
      grams: 50,
      kcal: 200,
      protein: 5,
      carbs: 20,
      fat: 8,
      fiber: 5,
    };
    const totals = trackedMealTotals([estimated, rice]);

    // Estimated carbs are NET (fiber excluded): 20 + 5. A matched food's carbs already include it.
    expect(totals.carbs).toBe(25 + 28);
    expect(totals.calories).toBe(330);
    expect(totals.protein).toBeCloseTo(7.7);
    expect(totals.fat).toBeCloseTo(8.3);
    expect(totals.grams).toBe(150);
  });
});
