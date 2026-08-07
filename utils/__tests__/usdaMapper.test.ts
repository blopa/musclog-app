import { foodRecordDisplayQuality } from '@/utils/foodDisplayQuality';
import { mapUSDAFoodToUnified, mapUSDANutritient } from '@/utils/usdaMapper';

const nutrients = (entries: Record<string, number>) =>
  Object.entries(entries).map(([nutrientNumber, value]) => ({ nutrientNumber, value }));

describe('usdaMapper', () => {
  describe('mapUSDANutritient', () => {
    it('matches on any of the three nutrient-number shapes the FDC API returns', () => {
      expect(mapUSDANutritient([{ nutrientNumber: '1008', value: 250 }], '1008')).toBe(250);
      expect(mapUSDANutritient([{ number: 1008, value: 250 }], '1008')).toBe(250);
      expect(mapUSDANutritient([{ nutrient: { number: '1008' }, value: 250 }], '1008')).toBe(250);
    });

    it('falls back from value to amount', () => {
      expect(mapUSDANutritient([{ nutrientNumber: '1003', amount: 12 }], '1003')).toBe(12);
    });

    it('returns undefined for a missing nutrient or a missing/invalid list', () => {
      expect(mapUSDANutritient([{ nutrientNumber: '1008', value: 1 }], '1005')).toBeUndefined();
      expect(mapUSDANutritient(undefined, '1005')).toBeUndefined();
      expect(mapUSDANutritient({} as any, '1005')).toBeUndefined();
    });
  });

  describe('mapUSDAFoodToUnified', () => {
    it('keeps "Carbohydrate, by difference" as-is because it already includes fiber', () => {
      // Nutrient 1005 = 100 - (water + protein + fat + ash + alcohol), i.e. the canonical total.
      // Adding fiber here would double-count it against the fiber macro. See AGENTS.md.
      const result = mapUSDAFoodToUnified({
        fdcId: 1,
        description: 'Oats',
        foodNutrients: nutrients({ 1008: 380, 1003: 13, 1005: 67, 1004: 7, 1079: 10 }),
      } as any);

      expect(result.carbs).toBe(67);
      expect(result.fiber).toBe(10);
      expect(result.source).toBe('usda');
    });

    it('reads the legacy nutrient numbers when the modern ones are absent', () => {
      const result = mapUSDAFoodToUnified({
        fdcId: 2,
        description: 'Legacy food',
        foodNutrients: nutrients({ 208: 90, 203: 4, 205: 15, 204: 1, 291: 3 }),
      } as any);

      expect(result).toMatchObject({ calories: 90, protein: 4, carbs: 15, fat: 1, fiber: 3 });
    });

    it('infers display calories from the macros when USDA reports no energy', () => {
      // 4*10 + 4*(30 - 4 fiber) + 9*5 + 2*4 = 40 + 104 + 45 + 8 = 197 kcal/100g.
      const result = mapUSDAFoodToUnified({
        fdcId: 3,
        description: 'No energy',
        foodNutrients: nutrients({ 1003: 10, 1005: 30, 1004: 5, 1079: 4 }),
      } as any);

      expect(result.calories).toBe(197);
    });

    it('leaves calories undefined when there is nothing to infer from', () => {
      const result = mapUSDAFoodToUnified({
        fdcId: 4,
        description: 'Empty',
        foodNutrients: [],
      } as any);

      expect(result.calories).toBeUndefined();
      expect(result.carbs).toBeUndefined();
      expect(result.description).toContain('N/A');
    });

    it('clamps negative macros to 0', () => {
      const result = mapUSDAFoodToUnified({
        fdcId: 5,
        description: 'Bad data',
        foodNutrients: nutrients({ 1003: -3, 1005: -8, 1004: -1, 1079: -2 }),
      } as any);

      expect(result).toMatchObject({ protein: 0, carbs: 0, fat: 0, fiber: 0 });
    });

    it('formats the serving size from servingSize + unit, defaulting to 100g', () => {
      const withServing = mapUSDAFoodToUnified({
        fdcId: 6,
        description: 'Branded',
        servingSize: 45,
        servingSizeUnit: 'ml',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);
      expect(withServing.serving_size).toBe('45ml');

      const withoutServing = mapUSDAFoodToUnified({
        fdcId: 7,
        description: 'No serving',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);
      expect(withoutServing.serving_size).toBe('100g');
    });

    it('prefers brandOwner, falling back to brandName then dataType', () => {
      const owner = mapUSDAFoodToUnified({
        fdcId: 8,
        description: 'X',
        brandOwner: 'Owner Inc',
        brandName: 'Brand',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);
      expect(owner.brand).toBe('Owner Inc');

      const brandOnly = mapUSDAFoodToUnified({
        fdcId: 9,
        description: 'X',
        brandName: 'Brand',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);
      expect(brandOnly.brand).toBe('Brand');

      const neither = mapUSDAFoodToUnified({
        fdcId: 10,
        description: 'X',
        dataType: 'Foundation',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);
      expect(neither.brand).toBeUndefined();
      expect(neither.description).toContain('Foundation');
    });

    it('converts the gram serving in the description to oz for imperial users', () => {
      const result = mapUSDAFoodToUnified(
        {
          fdcId: 11,
          description: 'Imperial',
          brandOwner: 'Acme',
          servingSize: 100,
          servingSizeUnit: 'g',
          foodNutrients: nutrients({ 1008: 250 }),
        } as any,
        'imperial'
      );

      // 100 g ≈ 3.53 oz -> rounded to 4 for the description line.
      expect(result.description).toBe('Acme • 250 kcal per 4 oz');
    });

    it('carries no quality badges at all — USDA has no Nutri-Score / Eco-Score / NOVA data', () => {
      // The invariant: USDA must resolve to undefined quality rather than being sniffed with
      // another provider's field names. See AGENTS.md "Food quality badges".
      const result = mapUSDAFoodToUnified({
        fdcId: 12,
        description: 'Plain',
        foodNutrients: nutrients({ 1008: 100 }),
      } as any);

      expect(result.nutriscore).toBeUndefined();
      expect(result.ecoscore).toBeUndefined();
      expect(result.novaGroup).toBeUndefined();
      expect(result.labels).toBeUndefined();
      expect(foodRecordDisplayQuality(result)).toBeUndefined();
    });
  });
});
