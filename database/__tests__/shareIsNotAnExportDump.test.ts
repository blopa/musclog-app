import { validateExportDump } from '@/database/schemaToZod';
import {
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  type MealShareEnvelope,
} from '@/utils/share/shareEnvelope';

describe('share/export safety boundary', () => {
  it('cannot be accepted as a database export by an older receiver', () => {
    const share: MealShareEnvelope = {
      _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
      createdAtMs: 1,
      kind: 'meal',
      kindVersion: 1,
      records: {
        meal_foods: [{ amount: 1, food_id: 'food-1', id: 'mf-1', meal_id: 'meal-1' }],
        meals: [{ id: 'meal-1', name: 'Meal' }],
      },
      rootId: 'meal-1',
      rootTable: 'meals',
      summary: {
        hasImage: false,
        ingredients: [{ amount: 1, calories: 1, name: 'Food', unit: 'g' }],
        name: 'Meal',
        nutritionBasis: 'per_recipe',
        totals: { calories: 1, carbs: 0, fat: 0, fiber: 0, protein: 0 },
      },
    };
    const parsed = JSON.parse(JSON.stringify(share));

    // If this ever passes, an old build can wipe a user's database before restoring only a meal.
    expect(Object.hasOwn(parsed, '_exportVersion')).toBe(false);
    expect(validateExportDump(parsed).success).toBe(false);
  });
});
