import { foodEatenFromPer100g } from '../nutritionLogTemplateModel';

const base = { kcalText: '', proteinText: '12', carbsText: '60', fatText: '7', gramsText: '150' };

describe('foodEatenFromPer100g', () => {
  it('scales each per 100 g figure by the grams eaten over 100', () => {
    const result = foodEatenFromPer100g({ ...base, kcalText: '370' });
    expect(result).toEqual({
      ok: true,
      result: { grams: 150, kcal: 555, protein: 18, carbs: 90, fat: 10.5, kcalEstimated: false },
    });
  });

  it('estimates calories from the macros when the label calories are empty', () => {
    const result = foodEatenFromPer100g(base);
    // 12 x 4 + 60 x 4 + 7 x 9 = 351 kcal per 100 g, so 526.5 for 150 g.
    expect(result).toMatchObject({ ok: true, result: { kcalEstimated: true } });
    expect(result.ok && result.result.kcal).toBeCloseTo(526.5);
  });

  it('accepts a decimal comma', () => {
    const result = foodEatenFromPer100g({ ...base, proteinText: '12,5', gramsText: '200' });
    expect(result.ok && result.result.protein).toBeCloseTo(25);
  });

  it('waits for the macros and the grams without calling it an error', () => {
    expect(foodEatenFromPer100g({ ...base, gramsText: '' })).toEqual({ ok: false, problem: null });
    expect(foodEatenFromPer100g({ ...base, fatText: ' ' })).toEqual({ ok: false, problem: null });
  });

  it.each([
    [{ proteinText: 'abc' }, 'protein'],
    [{ carbsText: '101' }, 'carbs'],
    [{ fatText: '-1' }, 'fat'],
    [{ gramsText: '5001' }, 'grams'],
    [{ kcalText: '901' }, 'kcal'],
    [{ proteinText: '50', carbsText: '50', fatText: '50' }, 'macrosTooHigh'],
  ] as const)('names the field that is wrong: %j', (patch, problem) => {
    expect(foodEatenFromPer100g({ ...base, ...patch })).toEqual({ ok: false, problem });
  });

  it('allows label rounding to push the macros a hair past 100 g', () => {
    const result = foodEatenFromPer100g({
      ...base,
      proteinText: '33.4',
      carbsText: '33.4',
      fatText: '33.5',
    });
    expect(result.ok).toBe(true);
  });
});
