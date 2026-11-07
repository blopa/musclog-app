import {
  chickenBreastsOf,
  macroMassInUnits,
  massFractionDigits,
  PROTEIN_PER_CHICKEN_BREAST_G,
  proteinComparison,
} from '@/utils/yearInReview/foodFigures';

describe('proteinComparison', () => {
  it('picks the heaviest object that still makes about two', () => {
    expect(proteinComparison(75_000)).toEqual({ id: 'barbell', count: 4 });
    expect(proteinComparison(45_000)).toEqual({ id: 'barbell', count: 2 });
    expect(proteinComparison(30_000)).toEqual({ id: 'bowlingBall', count: 4 });
    expect(proteinComparison(12_000)).toEqual({ id: 'cat', count: 3 });
    expect(proteinComparison(3_200)).toEqual({ id: 'wheyBag', count: 4 });
  });

  it('does not call one and a half barbells "about two"', () => {
    expect(proteinComparison(30_000)?.id).toBe('bowlingBall');
  });

  it('compares 3.9 lb of protein (1.77 kg) with two bags of whey', () => {
    expect(proteinComparison(1_770)).toEqual({ id: 'wheyBag', count: 2 });
  });

  it('makes no comparison below two of the lightest object', () => {
    expect(proteinComparison(1_300)).toBeNull();
    expect(proteinComparison(0)).toBeNull();
  });

  it('measures grams of protein, so the answer is the same in every unit system', () => {
    // 45 kg of protein is 99.2 lb; either way it is two barbells' worth.
    expect(proteinComparison(45_000)?.count).toBe(2);
  });
});

describe('chickenBreastsOf', () => {
  it('divides the protein by what one breast holds', () => {
    expect(chickenBreastsOf(PROTEIN_PER_CHICKEN_BREAST_G * 1000)).toBe(1000);
    expect(chickenBreastsOf(45_000)).toBe(1125);
  });

  it('is zero for less than half a breast', () => {
    expect(chickenBreastsOf(10)).toBe(0);
  });
});

describe('macroMassInUnits', () => {
  it('shows grams of macros as kilograms for a metric account', () => {
    expect(macroMassInUnits(45_000, 'metric')).toBe(45);
  });

  it('shows them as pounds for an imperial account', () => {
    expect(macroMassInUnits(45_000, 'imperial')).toBeCloseTo(99.21, 1);
  });
});

describe('massFractionDigits', () => {
  it('keeps one decimal under 100 and none from 100', () => {
    expect(massFractionDigits(45.2)).toBe(1);
    expect(massFractionDigits(99.9)).toBe(1);
    expect(massFractionDigits(100)).toBe(0);
    expect(massFractionDigits(1234)).toBe(0);
  });
});
