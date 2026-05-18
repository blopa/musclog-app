import {
  hasNutritionQualityData,
  normalizeNutritionQualityScore,
} from '@/components/cards/nutritionQuality';

describe('nutritionQuality helpers', () => {
  it('normalizes only valid Nutri-Score and Eco-Score grades', () => {
    expect(normalizeNutritionQualityScore('A')).toBe('a');
    expect(normalizeNutritionQualityScore(' e ')).toBe('e');
    expect(normalizeNutritionQualityScore('unknown')).toBeUndefined();
    expect(normalizeNutritionQualityScore('UNKNO')).toBeUndefined();
  });

  it('returns false for an empty quality payload', () => {
    expect(hasNutritionQualityData({})).toBe(false);
  });

  it('returns true when any score or label data exists', () => {
    expect(hasNutritionQualityData({ nutriScore: 'a' })).toBe(true);
    expect(hasNutritionQualityData({ novaGroup: 4 })).toBe(true);
    expect(hasNutritionQualityData({ labels: { vegan: true } as any })).toBe(true);
  });

  it('returns false when only unknown score values are present', () => {
    expect(hasNutritionQualityData({ nutriScore: 'unknown' })).toBe(false);
    expect(hasNutritionQualityData({ ecoScore: 'UNKNO' })).toBe(false);
    expect(hasNutritionQualityData({ nutriScore: 'unknown', ecoScore: 'UNKNO' })).toBe(false);
  });
});
