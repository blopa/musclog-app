import { type MealGroup, mealGroupShareTarget } from '@/components/nutrition/foodTypes';
import type NutritionLog from '@/database/models/NutritionLog';

describe('mealGroupShareTarget', () => {
  it('shares only the selected group under the name shown on its diary card', () => {
    const first = { id: 'log-1' } as NutritionLog;
    const second = { id: 'log-2' } as NutritionLog;
    const group = {
      entries: [{ log: first }, { log: second }],
      groupId: 'group-1',
      mealName: 'Studocou Lunch',
      totalNutrients: { calories: 892, carbs: 76, fat: 28, protein: 78 },
    } as MealGroup;

    expect(mealGroupShareTarget(group)).toEqual({
      kind: 'loggedMeal',
      logs: [first, second],
      name: 'Studocou Lunch',
    });
  });
});
