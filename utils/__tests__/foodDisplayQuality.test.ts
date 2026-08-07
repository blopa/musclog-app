import {
  applyDisplayQualityToFoodRecord,
  type FoodQualityRecord,
  foodRecordDisplayQuality,
} from '@/utils/foodDisplayQuality';
import { getMusclogDisplayQuality } from '@/utils/musclogProduct';
import { getOffDisplayQuality } from '@/utils/openFoodFactsMapper';

describe('foodDisplayQuality', () => {
  describe('foodRecordDisplayQuality', () => {
    it('renames the stored column names to the display shape', () => {
      expect(
        foodRecordDisplayQuality({
          nutriscore: 'b',
          ecoscore: 'c',
          novaGroup: 3,
          labels: { organic: true },
        })
      ).toEqual({
        nutriScore: 'b',
        ecoScore: 'c',
        novaGroup: 3,
        labels: { organic: true },
      });
    });

    it('returns undefined for a food with no quality data so the section is skipped entirely', () => {
      expect(foodRecordDisplayQuality(null)).toBeUndefined();
      expect(foodRecordDisplayQuality(undefined)).toBeUndefined();
      expect(foodRecordDisplayQuality({})).toBeUndefined();
    });

    it('treats empty-string grades as no data rather than rendering a blank badge', () => {
      expect(foodRecordDisplayQuality({ nutriscore: '', ecoscore: '' })).toBeUndefined();
    });

    it('still returns a quality object when only one badge survives', () => {
      expect(foodRecordDisplayQuality({ nutriscore: '', novaGroup: 1 })).toMatchObject({
        nutriScore: undefined,
        novaGroup: 1,
      });
    });
  });

  describe('applyDisplayQualityToFoodRecord', () => {
    it('writes the display badges back onto the record columns', () => {
      const record: FoodQualityRecord = {};
      applyDisplayQualityToFoodRecord(record, {
        nutriScore: 'a',
        ecoScore: 'b',
        novaGroup: 1,
        labels: { vegan: true },
      });

      expect(record).toEqual({
        nutriscore: 'a',
        ecoscore: 'b',
        novaGroup: 1,
        labels: { vegan: true },
      });
    });

    it('leaves badges an earlier save recorded untouched when the new source carries fewer', () => {
      // Documented invariant: re-saving from a source with fewer badges must never wipe data.
      const record: FoodQualityRecord = {
        nutriscore: 'a',
        ecoscore: 'b',
        novaGroup: 1,
        labels: { organic: true },
      };

      applyDisplayQualityToFoodRecord(record, { novaGroup: 4 });

      expect(record).toEqual({
        nutriscore: 'a',
        ecoscore: 'b',
        novaGroup: 4,
        labels: { organic: true },
      });
    });

    it('is a no-op when the source produced no quality at all', () => {
      const record: FoodQualityRecord = { nutriscore: 'a' };
      applyDisplayQualityToFoodRecord(record, undefined);
      expect(record).toEqual({ nutriscore: 'a' });
    });
  });

  describe('round trips between the source mappers and the stored record', () => {
    it('survives Open Food Facts -> save -> read back unchanged', () => {
      const quality = getOffDisplayQuality({
        nutriscore_grade: 'C',
        ecoscore_grade: 'B',
        nova_group: 3,
        labels_tags: ['en:organic'],
      });

      const record: FoodQualityRecord = {};
      applyDisplayQualityToFoodRecord(record, quality);

      expect(foodRecordDisplayQuality(record)).toEqual(quality);
    });

    it('survives Musclog -> save -> read back, with the absent Eco-Score staying absent', () => {
      const quality = getMusclogDisplayQuality({ nutriscore: 'A', novagroup: '2' });

      const record: FoodQualityRecord = {};
      applyDisplayQualityToFoodRecord(record, quality);

      expect(record.ecoscore).toBeUndefined();
      expect(foodRecordDisplayQuality(record)).toMatchObject({
        nutriScore: 'a',
        novaGroup: 2,
        ecoScore: undefined,
      });
    });

    it('stores nothing for a source with no quality data (USDA)', () => {
      const record: FoodQualityRecord = {};
      applyDisplayQualityToFoodRecord(record, undefined);
      expect(foodRecordDisplayQuality(record)).toBeUndefined();
    });
  });
});
