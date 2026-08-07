import {
  isDynamicNutritionGoalValid,
  normalizeNutritionGoalTargetWeight,
} from '@/utils/nutritionGoalHelpers';

describe('normalizeNutritionGoalTargetWeight', () => {
  it('keeps a positive target weight', () => {
    expect(normalizeNutritionGoalTargetWeight(82.5)).toBe(82.5);
  });

  // 0 is what an empty numeric input parses to; treating it as "no target" is what stops a
  // dynamic goal from projecting towards a 0 kg bodyweight.
  it.each([
    ['zero', 0],
    ['a negative weight', -5],
    ['null', null],
    ['undefined', undefined],
  ])('normalizes %s to null', (_label, value) => {
    expect(normalizeNutritionGoalTargetWeight(value as number | null | undefined)).toBeNull();
  });

  it('normalizes a non-numeric value to null', () => {
    expect(normalizeNutritionGoalTargetWeight('80' as unknown as number)).toBeNull();
    expect(normalizeNutritionGoalTargetWeight(Number.NaN)).toBeNull();
  });
});

describe('isDynamicNutritionGoalValid', () => {
  it('treats a missing goal as valid (nothing to validate)', () => {
    expect(isDynamicNutritionGoalValid(null)).toBe(true);
    expect(isDynamicNutritionGoalValid(undefined)).toBe(true);
  });

  // A static goal has fixed macros, so target weight/date are irrelevant and must not block save.
  it('treats a non-dynamic goal as valid even with no target weight or date', () => {
    expect(isDynamicNutritionGoalValid({ isDynamic: false })).toBe(true);
    expect(isDynamicNutritionGoalValid({})).toBe(true);
    expect(
      isDynamicNutritionGoalValid({ isDynamic: null, targetWeight: 0, targetDate: null })
    ).toBe(true);
  });

  it('accepts a dynamic goal that has both a positive target weight and a target date', () => {
    expect(
      isDynamicNutritionGoalValid({ isDynamic: true, targetWeight: 80, targetDate: 1_700_000_000 })
    ).toBe(true);
  });

  // A dynamic goal interpolates macros between today and the target, so it is unsatisfiable
  // without both endpoints — the modal's save button is gated on exactly this.
  it.each([
    ['no target date', { isDynamic: true, targetWeight: 80, targetDate: null }],
    ['no target weight', { isDynamic: true, targetWeight: null, targetDate: 1_700_000_000 }],
    ['a zero target weight', { isDynamic: true, targetWeight: 0, targetDate: 1_700_000_000 }],
    ['a negative target weight', { isDynamic: true, targetWeight: -1, targetDate: 1_700_000_000 }],
    ['neither', { isDynamic: true }],
  ])('rejects a dynamic goal with %s', (_label, goal) => {
    expect(isDynamicNutritionGoalValid(goal)).toBe(false);
  });

  // A target date of 0 is a real epoch value, not "unset" — the guard is `!= null`, so it passes.
  it('accepts a dynamic goal whose target date is epoch 0', () => {
    expect(isDynamicNutritionGoalValid({ isDynamic: true, targetWeight: 80, targetDate: 0 })).toBe(
      true
    );
  });
});
