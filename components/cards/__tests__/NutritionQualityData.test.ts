import {
  hasNutritionQualityData,
  isHighFiberFood,
  isHighProteinFood,
  normalizeNutritionQualityScore,
  resolveNutritionLabels,
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
    expect(hasNutritionQualityData({ labels: { highProtein: true } as any })).toBe(true);
    expect(hasNutritionQualityData({ labels: { highFiber: true } as any })).toBe(true);
  });

  it('returns false when only unknown score values are present', () => {
    expect(hasNutritionQualityData({ nutriScore: 'unknown' })).toBe(false);
    expect(hasNutritionQualityData({ ecoScore: 'UNKNO' })).toBe(false);
    expect(hasNutritionQualityData({ nutriScore: 'unknown', ecoScore: 'UNKNO' })).toBe(false);
  });

  it('marks food as high protein when protein is at least 10% of calories', () => {
    expect(isHighProteinFood(20, 200)).toBe(true);
    expect(isHighProteinFood(20, 201)).toBe(false);
    expect(isHighProteinFood(0, 200)).toBe(false);
  });

  it('marks food as high fiber using the shared fiber helper', () => {
    expect(isHighFiberFood(20, 10, 100)).toBe(true);
    expect(isHighFiberFood(20, 10, 400)).toBe(false);
    expect(isHighFiberFood(20, 0, 100)).toBe(false);
  });

  it('resolves computed labels using one consistent nutrition basis', () => {
    expect(
      resolveNutritionLabels({
        protein: 0.018,
        carbs: 0.228,
        fiber: 0.012,
        calories: 0.9,
      })
    ).toBeUndefined();

    expect(
      resolveNutritionLabels({
        protein: 25,
        carbs: 10,
        fiber: 6,
        calories: 200,
      })
    ).toEqual({
      highProtein: true,
      highFiber: true,
    });
  });
});
