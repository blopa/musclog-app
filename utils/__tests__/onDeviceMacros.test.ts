import {
  clampNonNegative,
  fromLabelPer100g,
  isFiberTracked,
  withLabelFiber,
} from '../onDeviceMacros';

describe('onDeviceMacros', () => {
  it('clamps negative and non-finite numbers to 0', () => {
    expect(clampNonNegative(-3)).toBe(0);
    expect(clampNonNegative(Number.NaN)).toBe(0);
    expect(clampNonNegative(Infinity)).toBe(0);
    expect(clampNonNegative('4')).toBe(0);
    expect(clampNonNegative(2.5)).toBe(2.5);
  });

  it('tracks fiber unless index 3 is exactly 0', () => {
    expect(isFiberTracked('11111')).toBe(true);
    expect(isFiberTracked('11011')).toBe(true);
    expect(isFiberTracked('11101')).toBe(false);
    expect(isFiberTracked('')).toBe(true);
  });

  describe('fromLabelPer100g', () => {
    it('scales by grams and splits the model energy by its macro ratios', () => {
      const out = fromLabelPer100g({ name: 'x', kcal: 250, protein: 20, carbs: 0, fat: 15 }, 250);
      expect(out.kcal).toBe(625);
      expect(4 * out.protein + 4 * out.carbs + 9 * out.fat).toBeGreaterThan(620);
      expect(4 * out.protein + 4 * out.carbs + 9 * out.fat).toBeLessThan(630);
      expect(out.fiber).toBe(0);
      expect(out.grams).toBe(250);
    });

    it('computes kcal from the macros when the model gave none', () => {
      expect(
        fromLabelPer100g({ name: 'x', kcal: 0, protein: 10, carbs: 10, fat: 5 }, 100)
      ).toMatchObject({ kcal: 125, protein: 10, carbs: 10, fat: 5 });
    });

    it('is all zero when everything is zero or unusable', () => {
      expect(
        fromLabelPer100g({ name: 'x', kcal: -1, protein: Number.NaN, carbs: 0, fat: 0 }, 50)
      ).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    });

    it('keeps a kcal figure with no macros', () => {
      expect(
        fromLabelPer100g({ name: 'x', kcal: 100, protein: 0, carbs: 0, fat: 0 }, 50)
      ).toMatchObject({ kcal: 50, protein: 0 });
    });
  });

  describe('withLabelFiber', () => {
    const base = fromLabelPer100g(
      { name: 'almonds', kcal: 550, protein: 20, carbs: 5, fat: 50 },
      10
    );

    it('scales fiber, takes it out of the carbs and recomputes kcal', () => {
      expect(withLabelFiber(base, 4)).toMatchObject({ fiber: 0.4, carbs: 0.1, kcal: 54 });
    });

    it('caps fiber at the carbs', () => {
      expect(withLabelFiber(base, 90)).toMatchObject({ fiber: 0.5, carbs: 0, kcal: 54 });
    });

    it('ignores negative fiber', () => {
      expect(withLabelFiber(base, -2)).toMatchObject({ fiber: 0, carbs: 0.5, kcal: 55 });
    });
  });
});
