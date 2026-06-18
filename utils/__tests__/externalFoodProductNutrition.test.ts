import {
  areCoreMacrosEffectivelyZero,
  EMPTY_PRODUCT_NUTRITION,
  microsFromNutrition,
  parseCoreMacrosFromAlternateSource,
  parseProductNutritionPer100g,
} from '@/utils/externalFoodProduct';

describe('externalFoodProduct nutrition parsing', () => {
  describe('parseProductNutritionPer100g — usda', () => {
    it('reads raw foodNutrients per 100g and converts minerals from mg to g', () => {
      const product = {
        dataType: 'Foundation',
        foodNutrients: [
          { nutrientNumber: '1008', value: 250 },
          { nutrientNumber: '1003', value: 12 },
          { nutrientNumber: '1005', value: 30 },
          { nutrientNumber: '1004', value: 8 },
          { nutrientNumber: '1079', value: 4 },
          { nutrientNumber: '1093', value: 500 }, // sodium in mg -> 0.5 g
        ],
      };

      const result = parseProductNutritionPer100g('usda', product);
      expect(result.calories).toBe(250);
      expect(result.protein).toBe(12);
      expect(result.carbs).toBe(30);
      expect(result.fat).toBe(8);
      expect(result.fiber).toBe(4);
      expect(result.sodium).toBeCloseTo(0.5, 6);
    });

    it('normalizes Branded per-serving values to per 100g', () => {
      const product = {
        dataType: 'Branded',
        servingSize: 50,
        foodNutrients: [{ nutrientNumber: '1008', value: 100 }],
      };

      // 100 kcal per 50g serving -> 200 kcal per 100g.
      expect(parseProductNutritionPer100g('usda', product).calories).toBe(200);
    });

    it('falls back across legacy nutrient numbers', () => {
      const product = {
        foodNutrients: [{ number: '208', value: 90 }],
      };
      expect(parseProductNutritionPer100g('usda', product).calories).toBe(90);
    });
  });

  describe('parseProductNutritionPer100g — musclog', () => {
    it('maps musclog macros and zeroes the untracked trace micros', () => {
      const product = {
        kcal: 180,
        protein: 9,
        carbs: 22,
        fat: 6,
        fiber: 3,
        other_nutrients: { sugar: 11, saturated_fat: 2, sodium: 0.4 },
      };

      const result = parseProductNutritionPer100g('musclog', product);
      expect(result).toMatchObject({
        calories: 180,
        protein: 9,
        carbs: 22,
        fat: 6,
        fiber: 3,
        sugar: 11,
        saturatedFat: 2,
        sodium: 0.4,
        alcohol: 0,
        potassium: 0,
        magnesium: 0,
        zinc: 0,
      });
    });
  });

  describe('parseProductNutritionPer100g — openfood', () => {
    it('reads _100g nutriments and direct fiber', () => {
      const product = {
        nutriments: {
          'energy-kcal_100g': 200,
          proteins_100g: 10,
          carbohydrates_100g: 20,
          fat_100g: 5,
          fiber_100g: 2,
          sugars_100g: 8,
          'saturated-fat_100g': 1,
          sodium_100g: 0.3,
        },
      };

      const result = parseProductNutritionPer100g('openfood', product);
      expect(result.calories).toBe(200);
      expect(result.fiber).toBe(2);
      expect(result.sugar).toBe(8);
      expect(result.sodium).toBeCloseTo(0.3, 6);
    });

    it('derives fiber from total-minus-net carbs when no direct fiber is present', () => {
      const product = {
        nutriments: {
          'carbohydrates-total_100g': 25,
          carbohydrates_100g: 20,
        },
      };
      expect(parseProductNutritionPer100g('openfood', product).fiber).toBe(5);
    });

    it('returns all-zero nutrition when no nutriments are available', () => {
      expect(parseProductNutritionPer100g('openfood', {})).toEqual(EMPTY_PRODUCT_NUTRITION);
    });
  });

  describe('microsFromNutrition', () => {
    it('always keeps sugar / saturatedFat / sodium and drops zero/non-finite trace micros', () => {
      expect(
        microsFromNutrition({
          sugar: 8,
          saturatedFat: 0,
          sodium: 0.3,
          alcohol: 0,
          potassium: 2,
          magnesium: Number.NaN,
          zinc: 0.5,
        })
      ).toEqual({
        sugar: 8,
        saturatedFat: 0,
        sodium: 0.3,
        potassium: 2,
        zinc: 0.5,
      });
    });
  });

  describe('parseCoreMacrosFromAlternateSource', () => {
    it('returns the core macros for a successful product state', () => {
      const state = {
        status: 'success' as const,
        product: {
          product_name: 'Test',
          nutriments: {
            'energy-kcal_100g': 150,
            proteins_100g: 7,
            carbohydrates_100g: 18,
            fat_100g: 4,
            fiber_100g: 1,
          },
        },
      };

      expect(parseCoreMacrosFromAlternateSource(state as any)).toEqual({
        calories: 150,
        protein: 7,
        carbs: 18,
        fat: 4,
        fiber: 1,
      });
    });

    it('returns null for error / null states', () => {
      expect(parseCoreMacrosFromAlternateSource(null)).toBeNull();
      expect(
        parseCoreMacrosFromAlternateSource({ status: 'error', error: { message: 'x' } })
      ).toBeNull();
    });
  });

  describe('areCoreMacrosEffectivelyZero', () => {
    it('is true when every core macro is effectively zero', () => {
      expect(
        areCoreMacrosEffectivelyZero({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
      ).toBe(true);
    });

    it('is false when any core macro is non-zero', () => {
      expect(
        areCoreMacrosEffectivelyZero({ calories: 0, protein: 3, carbs: 0, fat: 0, fiber: 0 })
      ).toBe(false);
    });
  });
});
