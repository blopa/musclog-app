import { hasNutritionQualityData } from '@/components/cards/nutritionQuality';

describe('hasNutritionQualityData', () => {
  it('returns false for an empty quality payload', () => {
    expect(hasNutritionQualityData({})).toBe(false);
  });

  it('returns true when any score or label data exists', () => {
    expect(hasNutritionQualityData({ nutriScore: 'a' })).toBe(true);
    expect(hasNutritionQualityData({ novaGroup: 4 })).toBe(true);
    expect(hasNutritionQualityData({ labels: { vegan: true } as any })).toBe(true);
  });
});
