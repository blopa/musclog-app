import { effectiveNutritionDayCount } from '@/utils/effectiveNutritionDays';

describe('effectiveNutritionDayCount', () => {
  it('counts only logged days when there are no fasted days', () => {
    expect(effectiveNutritionDayCount([1, 2, 3], [])).toBe(3);
  });

  it('adds fasted days that are distinct from logged days', () => {
    // Days 1 and 3 logged, day 2 fasted → 3 effective days (the user example: ÷3 → 1333 kcal).
    expect(effectiveNutritionDayCount([1, 3], [2])).toBe(3);
  });

  it('does not double-count a day that is both logged and fasted', () => {
    // A day can be flagged fasted and still have a log; the union counts it once.
    expect(effectiveNutritionDayCount([1, 2], [2])).toBe(2);
  });

  it('returns 0 when both inputs are empty', () => {
    expect(effectiveNutritionDayCount([], [])).toBe(0);
  });

  it('counts fasted-only days when nothing was logged', () => {
    expect(effectiveNutritionDayCount([], [5, 6])).toBe(2);
  });
});
