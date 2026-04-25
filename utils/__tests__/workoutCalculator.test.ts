import { calculateCaloriesBurnedBySteps } from '@/utils/workoutCalculator';

describe('calculateCaloriesBurnedBySteps', () => {
  it('estimates calories for a typical adult walking day', () => {
    expect(calculateCaloriesBurnedBySteps(10000, 'male', 80, 180)).toBeCloseTo(298.8, 2);
  });

  it('returns 0 for invalid or empty input', () => {
    expect(calculateCaloriesBurnedBySteps(0, 'male', 80, 180)).toBe(0);
    expect(calculateCaloriesBurnedBySteps(5000, 'male', 0, 180)).toBe(0);
    expect(calculateCaloriesBurnedBySteps(5000, 'male', 80, 0)).toBe(0);
  });

  it('uses gender-specific stride length', () => {
    const male = calculateCaloriesBurnedBySteps(10000, 'male', 80, 180);
    const female = calculateCaloriesBurnedBySteps(10000, 'female', 80, 180);
    const other = calculateCaloriesBurnedBySteps(10000, 'other', 80, 180);

    expect(male).toBeGreaterThan(female);
    expect(other).toBeLessThan(male);
    expect(other).toBeGreaterThan(female);
  });

  it('scales proportionally with body weight', () => {
    const lighter = calculateCaloriesBurnedBySteps(10000, 'male', 60, 180);
    const heavier = calculateCaloriesBurnedBySteps(10000, 'male', 90, 180);

    expect(heavier).toBeGreaterThan(lighter);
  });
});
