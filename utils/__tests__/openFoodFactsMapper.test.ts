import i18n from '@/lang/lang';
import {
  extractLabelsFromOFFProduct,
  getNutrimentsWithFallback,
  getNutrimentValue,
  getOffDisplayQuality,
  getProductName,
  mapOpenFoodFactsProduct,
  parseOpenFoodFactsNutritionPer100g,
  resolveOpenFoodFactsFiberPer100g,
} from '@/utils/openFoodFactsMapper';

/**
 * Co-macros shared by the carbs-normalisation cases below: protein 5g, fat 3g, fiber 6g.
 * base energy (everything except digestible carbs) = 4*5 + 9*3 + 2*6 = 59 kcal/100g.
 * The two interpretations of `carbohydrates: 30` therefore differ by exactly 4 * fiber = 24 kcal:
 *   - "already total"  -> 59 + 4*(30-6) = 155 kcal
 *   - "net, add fiber" -> 59 + 4*30     = 179 kcal
 */
const carbsCase = (extra: Record<string, unknown>) => ({
  nutriments: {
    proteins_100g: 5,
    carbohydrates_100g: 30,
    fat_100g: 3,
    fiber_100g: 6,
    ...extra,
  },
});

describe('openFoodFactsMapper', () => {
  describe('getNutrimentValue', () => {
    it('prefers _100g over _serving, the bare key and _value', () => {
      const nutriments = {
        proteins_100g: 10,
        proteins_serving: 4,
        proteins: 99,
        proteins_value: 77,
      };
      expect(getNutrimentValue(nutriments, 'proteins')).toBe(10);
      expect(getNutrimentValue({ proteins_serving: 4, proteins: 99 }, 'proteins')).toBe(4);
      expect(getNutrimentValue({ proteins: 99, proteins_value: 77 }, 'proteins')).toBe(99);
      expect(getNutrimentValue({ proteins_value: 77 }, 'proteins')).toBe(77);
    });

    it('parses comma decimal separators, as OFF stores EU-formatted strings', () => {
      expect(getNutrimentValue({ fat_100g: '12,5' }, 'fat')).toBe(12.5);
    });

    it('returns undefined for a missing or unparseable nutriment', () => {
      expect(getNutrimentValue({}, 'fat')).toBeUndefined();
      expect(getNutrimentValue({ fat_100g: 'n/a' }, 'fat')).toBeUndefined();
      expect(getNutrimentValue({ fat_100g: null }, 'fat')).toBeUndefined();
    });
  });

  describe('resolveOpenFoodFactsFiberPer100g', () => {
    it('prefers the direct fiber nutriment', () => {
      expect(
        resolveOpenFoodFactsFiberPer100g({
          fiber_100g: 4,
          'carbohydrates-total_100g': 30,
          carbohydrates_100g: 20,
        })
      ).toBe(4);
    });

    it('derives fiber from carbohydrates-total minus carbohydrates when no direct fiber exists', () => {
      expect(
        resolveOpenFoodFactsFiberPer100g({
          'carbohydrates-total_100g': 30,
          carbohydrates_100g: 22,
        })
      ).toBe(8);
    });

    it('clamps a negative derived fiber to 0 rather than propagating bad data', () => {
      expect(
        resolveOpenFoodFactsFiberPer100g({
          'carbohydrates-total_100g': 10,
          carbohydrates_100g: 25,
        })
      ).toBe(0);
    });

    it('falls back to 0 when neither path is available', () => {
      expect(resolveOpenFoodFactsFiberPer100g({})).toBe(0);
    });
  });

  describe('parseOpenFoodFactsNutritionPer100g — off-mixed carbs normalisation', () => {
    it('step 1: prefers the explicit carbohydrates-total nutriment and never adds fiber on top', () => {
      // A US product where OFF recorded a normalized total. Fiber must not be double-counted.
      const { nutrition } = parseOpenFoodFactsNutritionPer100g(
        carbsCase({ 'carbohydrates-total_100g': 34, 'energy-kcal_100g': 179 }) as any
      );
      expect(nutrition.carbs).toBe(34);
    });

    it('step 2: keeps carbs as-is when the stated label energy clearly fits the total interpretation', () => {
      const { nutrition } = parseOpenFoodFactsNutritionPer100g(
        carbsCase({ 'energy-kcal_100g': 155 }) as any
      );
      expect(nutrition.carbs).toBe(30);
    });

    it('step 2: adds fiber when the stated label energy clearly fits the net interpretation', () => {
      const { nutrition } = parseOpenFoodFactsNutritionPer100g(
        carbsCase({ 'energy-kcal_100g': 179 }) as any
      );
      expect(nutrition.carbs).toBe(36);
    });

    it('step 3: falls back to the EU/net default when the stated energy is ambiguous', () => {
      // 167 sits exactly between the two interpretations (155 / 179), so neither wins by more
      // than the tolerance -> keep the conservative net default.
      const { nutrition } = parseOpenFoodFactsNutritionPer100g(
        carbsCase({ 'energy-kcal_100g': 167 }) as any
      );
      expect(nutrition.carbs).toBe(36);
    });

    it('step 3: falls back to net when the product states no energy at all', () => {
      // The reconciliation must use the STATED label energy only. Inferring an energy from the
      // very macros under test would be circular, so a missing energy means "no evidence".
      const { nutrition } = parseOpenFoodFactsNutritionPer100g(carbsCase({}) as any);
      expect(nutrition.carbs).toBe(36);
    });

    it('leaves carbs untouched when there is no fiber (the interpretations coincide)', () => {
      const { nutrition } = parseOpenFoodFactsNutritionPer100g({
        nutriments: { carbohydrates_100g: 30, fiber_100g: 0, 'energy-kcal_100g': 120 },
      } as any);
      expect(nutrition.carbs).toBe(30);
      expect(nutrition.fiber).toBe(0);
    });

    it('normalises carbs before inferring display calories when energy is missing', () => {
      // carbs normalise to 36 total; inferred kcal = 4*5 + 4*(36-6) + 9*3 + 2*6 = 179.
      const parsed = parseOpenFoodFactsNutritionPer100g(carbsCase({}) as any);
      expect(parsed.roundedCaloriesForDisplay).toBe(179);
      expect(parsed.nutrition.calories).toBe(0);
      expect(parsed.availability.calories).toBe(false);
    });
  });

  describe('parseOpenFoodFactsNutritionPer100g — availability and empty products', () => {
    it('reports which core macros the product actually carried', () => {
      const { availability } = parseOpenFoodFactsNutritionPer100g({
        nutriments: { 'energy-kcal_100g': 120, proteins_100g: 5 },
      } as any);
      expect(availability).toEqual({ calories: true, protein: true, carbs: false, fat: false });
    });

    it('returns all-zero nutrition and no availability for a product without nutriments', () => {
      const parsed = parseOpenFoodFactsNutritionPer100g({} as any);
      expect(parsed.nutrition.carbs).toBe(0);
      expect(parsed.nutrition.calories).toBe(0);
      expect(parsed.availability).toEqual({
        calories: false,
        protein: false,
        carbs: false,
        fat: false,
      });
      expect(parsed.allNutriments).toEqual({});
      expect(parsed.roundedCaloriesForDisplay).toBe(0);
    });

    it('clamps negative core macros to 0', () => {
      const { nutrition } = parseOpenFoodFactsNutritionPer100g({
        nutriments: { proteins_100g: -5, carbohydrates_100g: -10, fat_100g: -2, fiber_100g: 0 },
      } as any);
      expect(nutrition.protein).toBe(0);
      expect(nutrition.carbs).toBe(0);
      expect(nutrition.fat).toBe(0);
    });

    it('falls back to salt when sodium is absent', () => {
      const { nutrition } = parseOpenFoodFactsNutritionPer100g({
        nutriments: { salt_100g: 1.2 },
      } as any);
      expect(nutrition.sodium).toBe(1.2);
      expect(nutrition.salt).toBe(1.2);
    });
  });

  describe('getNutrimentsWithFallback', () => {
    it('uses nutriments_estimated when the product has no measured nutriments, flagging isEstimated', () => {
      const result = getNutrimentsWithFallback({
        nutriments_estimated: { carbohydrates_100g: 12 },
      } as any);
      expect(result).toMatchObject({ carbohydrates_100g: 12, isEstimated: true });
    });

    it('does not flag isEstimated when measured nutriments are present', () => {
      const result = getNutrimentsWithFallback({
        nutriments: { carbohydrates_100g: 20 },
      } as any);
      expect(result).toMatchObject({ carbohydrates_100g: 20, isEstimated: false });
    });

    it('returns null when the product carries no nutrient data in any shape', () => {
      expect(getNutrimentsWithFallback({} as any)).toBeNull();
    });
  });

  describe('extractLabelsFromOFFProduct', () => {
    it('reads vegan / vegetarian / palm-oil as three-state values from the analysis tags', () => {
      expect(
        extractLabelsFromOFFProduct({
          ingredients_analysis_tags: ['en:vegan', 'en:non-vegetarian', 'en:palm-oil'],
        })
      ).toEqual({ vegan: true, vegetarian: false, palmOilFree: false });
    });

    it('leaves an unknown three-state label out entirely rather than defaulting it to false', () => {
      const labels = extractLabelsFromOFFProduct({ labels_tags: ['en:organic'] });
      expect(labels).toEqual({ organic: true });
      expect(labels).not.toHaveProperty('vegan');
    });

    it('treats organic / fair-trade as true-or-absent, accepting both tag spellings', () => {
      expect(
        extractLabelsFromOFFProduct({ labels_tags: ['en:eu-organic', 'en:fairtrade'] })
      ).toEqual({ organic: true, fairTrade: true });
    });

    it('returns undefined when the product carries no tags, or only irrelevant ones', () => {
      expect(extractLabelsFromOFFProduct({})).toBeUndefined();
      expect(extractLabelsFromOFFProduct({ labels_tags: ['en:no-gluten'] })).toBeUndefined();
    });
  });

  describe('getOffDisplayQuality', () => {
    it('normalises OFF field names and lowercases the mixed-case letter grades', () => {
      expect(
        getOffDisplayQuality({
          nutriscore_grade: 'B',
          ecoscore_grade: 'C',
          nova_group: 4,
          ingredients_analysis_tags: ['en:vegan'],
        })
      ).toEqual({
        nutriScore: 'b',
        ecoScore: 'c',
        novaGroup: 4,
        labels: { vegan: true },
      });
    });

    it('ignores non-string grades, non-numeric nova groups and empty strings', () => {
      expect(
        getOffDisplayQuality({ nutriscore_grade: '', ecoscore_grade: 3, nova_group: '4' })
      ).toBeUndefined();
    });

    it('returns undefined for a missing product or one with no quality data', () => {
      expect(getOffDisplayQuality(null)).toBeUndefined();
      expect(getOffDisplayQuality(undefined)).toBeUndefined();
      expect(getOffDisplayQuality({})).toBeUndefined();
    });

    it('still returns a quality object when only one badge is present', () => {
      expect(getOffDisplayQuality({ nova_group: 1 })).toEqual({
        nutriScore: undefined,
        ecoScore: undefined,
        novaGroup: 1,
        labels: undefined,
      });
    });
  });

  describe('mapOpenFoodFactsProduct', () => {
    it('carries the normalised quality badges onto the unified result under the OFF source', () => {
      const result = mapOpenFoodFactsProduct({
        code: '1234',
        product_name: 'Test bar',
        nutriscore_grade: 'A',
        ecoscore_grade: 'B',
        nova_group: 2,
        labels_tags: ['en:organic'],
        nutriments: { 'energy-kcal_100g': 150 },
      } as any);

      expect(result.source).toBe('openfood');
      expect(result.nutriscore).toBe('a');
      expect(result.ecoscore).toBe('b');
      expect(result.novaGroup).toBe(2);
      expect(result.labels).toEqual({ organic: true });
    });

    it('leaves the badge fields undefined for a product with no quality data', () => {
      const result = mapOpenFoodFactsProduct({
        code: '999',
        product_name: 'Plain',
        nutriments: { 'energy-kcal_100g': 100 },
      } as any);

      expect(result.nutriscore).toBeUndefined();
      expect(result.ecoscore).toBeUndefined();
      expect(result.novaGroup).toBeUndefined();
      expect(result.labels).toBeUndefined();
    });

    it('normalises the displayed carbs through the off-mixed rule', () => {
      const result = mapOpenFoodFactsProduct(carbsCase({ 'energy-kcal_100g': 179 }) as any);
      expect(result.carbs).toBe(36);
      expect(result.fiber).toBe(6);
    });
  });

  describe('getProductName (string wrapper)', () => {
    it('returns the resolved name for an OFF product', () => {
      expect(getProductName({ product_name: 'Granola' } as any)).toBe('Granola');
    });

    it('falls back to the localized unknown-food label', () => {
      expect(getProductName(null)).toBe(i18n.t('food.unknownFood'));
    });
  });
});
