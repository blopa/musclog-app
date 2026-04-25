import { calculateCaloriesBurnedBySteps } from '@/utils/workoutCalculator';

describe('calculateCaloriesBurnedBySteps', () => {
  it('estimates calories for a typical adult walking day', () => {
    expect(calculateCaloriesBurnedBySteps(10000, 'male', 30, 80, 180)).toBeCloseTo(432.13, 2);
  });

  it('returns 0 for invalid or empty input', () => {
    expect(calculateCaloriesBurnedBySteps(0, 'male', 30, 80, 180)).toBe(0);
    expect(calculateCaloriesBurnedBySteps(5000, 'male', 0, 80, 180)).toBe(0);
    expect(calculateCaloriesBurnedBySteps(5000, 'male', 30, 0, 180)).toBe(0);
    expect(calculateCaloriesBurnedBySteps(5000, 'male', 30, 80, 0)).toBe(0);
  });

  it('uses gender-specific stride length', () => {
    const male = calculateCaloriesBurnedBySteps(10000, 'male', 30, 80, 180);
    const female = calculateCaloriesBurnedBySteps(10000, 'female', 30, 80, 180);
    const other = calculateCaloriesBurnedBySteps(10000, 'other', 30, 80, 180);

    expect(male).toBeGreaterThan(female);
    expect(other).toBeLessThan(male);
    expect(other).toBeGreaterThan(female);
  });

  it('estimates slightly more calories for older adults due to lower default cadence', () => {
    const younger = calculateCaloriesBurnedBySteps(10000, 'male', 30, 80, 180);
    const older = calculateCaloriesBurnedBySteps(10000, 'male', 70, 80, 180);

    expect(older).toBeGreaterThan(younger);
  });
});
