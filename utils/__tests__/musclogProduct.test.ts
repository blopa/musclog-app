import {
  getMusclogDisplayQuality,
  getMusclogNutritionPer100g,
  getMusclogQualityScores,
} from '@/utils/musclogProduct';

describe('musclogProduct', () => {
  describe('getMusclogQualityScores', () => {
    it('lowercases the Nutri-Score grade and parses the NOVA group into a number', () => {
      expect(getMusclogQualityScores({ nutriscore: 'B', novagroup: '3' })).toMatchObject({
        nutriscore: 'b',
        novaGroup: 3,
      });
    });

    it('treats null and empty-string grades as absent', () => {
      expect(getMusclogQualityScores({ nutriscore: '', novagroup: '' })).toEqual({
        nutriscore: undefined,
        novaGroup: undefined,
        labels: undefined,
      });
      expect(getMusclogQualityScores({ nutriscore: null, novagroup: null })).toMatchObject({
        nutriscore: undefined,
        novaGroup: undefined,
      });
    });

    it('rejects a NOVA group outside the valid 1-4 range or that does not parse', () => {
      expect(getMusclogQualityScores({ novagroup: '0' }).novaGroup).toBeUndefined();
      expect(getMusclogQualityScores({ novagroup: '5' }).novaGroup).toBeUndefined();
      expect(getMusclogQualityScores({ novagroup: 'unknown' }).novaGroup).toBeUndefined();
    });

    it('keeps an explicit false label, but omits labels the product never reported', () => {
      // `false` is real information ("confirmed not vegan") and must survive the != null check.
      const labels = getMusclogQualityScores({ vegan: false, organic: true }).labels;
      expect(labels).toEqual({ organic: true, vegan: false });
      expect(labels).not.toHaveProperty('vegetarian');
    });

    it('returns undefined labels when no label field is present at all', () => {
      expect(getMusclogQualityScores({}).labels).toBeUndefined();
    });
  });

  describe('getMusclogDisplayQuality', () => {
    it('normalises the Musclog field names into the shared display shape', () => {
      expect(
        getMusclogDisplayQuality({
          nutriscore: 'A',
          novagroup: '1',
          vegetarian: true,
        })
      ).toEqual({
        nutriScore: 'a',
        novaGroup: 1,
        labels: { vegetarian: true },
      });
    });

    it('omits absent badges rather than emitting explicit undefined keys', () => {
      const quality = getMusclogDisplayQuality({ nutriscore: 'c' });
      expect(quality).toEqual({ nutriScore: 'c' });
      expect(Object.keys(quality ?? {})).toEqual(['nutriScore']);
    });

    it('never reports an Eco-Score — the Musclog API carries no environmental grade', () => {
      expect(getMusclogDisplayQuality({ nutriscore: 'a', novagroup: '2' })).not.toHaveProperty(
        'ecoScore'
      );
    });

    it('returns undefined when the product has no quality data, so callers can skip the section', () => {
      expect(getMusclogDisplayQuality({})).toBeUndefined();
      expect(getMusclogDisplayQuality({ name: 'Bread', carbs: 40 })).toBeUndefined();
    });
  });

  describe('getMusclogNutritionPer100g', () => {
    it('adds fiber to carbs — the Dutch "Koolhydraten" label is EU net carbs', () => {
      // Musclog scrapes EU supermarkets, so carbs exclude fiber; canonical total = 22 + 3.
      const nutrition = getMusclogNutritionPer100g({ carbs: 22, fiber: 3 });
      expect(nutrition.carbs).toBe(25);
      expect(nutrition.fiber).toBe(3);
    });

    it('normalises carbs even when the scraper returned numeric strings', () => {
      expect(getMusclogNutritionPer100g({ carbs: '22.5', fiber: '3.5' }).carbs).toBe(26);
    });

    it('treats a missing or unparseable fiber as 0 so carbs are left alone', () => {
      expect(getMusclogNutritionPer100g({ carbs: 22 }).carbs).toBe(22);
      expect(getMusclogNutritionPer100g({ carbs: 22, fiber: 'n/a' }).carbs).toBe(22);
    });

    it('prefers kcal over calories for the energy value', () => {
      expect(getMusclogNutritionPer100g({ kcal: 180, calories: 999 }).calories).toBe(180);
      expect(getMusclogNutritionPer100g({ calories: 120 }).calories).toBe(120);
    });

    it('prefers the nested other_nutrients block over the flat micro fields', () => {
      const nutrition = getMusclogNutritionPer100g({
        other_nutrients: { sugar: 11, saturated_fat: 2, sodium: 0.4 },
        sugar: 99,
        saturatedFat: 99,
        sodium: 99,
      });

      expect(nutrition).toMatchObject({ sugar: 11, saturatedFat: 2, sodium: 0.4 });
    });

    it('falls back to the flat micro fields when other_nutrients is absent', () => {
      expect(
        getMusclogNutritionPer100g({ sugar: 5, saturatedFat: 1, sodium: 0.2 })
      ).toMatchObject({ sugar: 5, saturatedFat: 1, sodium: 0.2 });
    });

    it('coerces every missing field to 0 rather than NaN', () => {
      expect(getMusclogNutritionPer100g({})).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
      });
    });
  });
});
