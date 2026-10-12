import {
  calculateCaloriesBurnedBySteps,
  calculateExerciseVolume,
} from '@/utils/workoutCalculator';

describe('calculateExerciseVolume', () => {
  it('returns 0 for empty sets', () => {
    const exercise = { equipmentType: 'barbell' };
    expect(calculateExerciseVolume([], exercise, 80)).toBe(0);
  });

  it('calculates volume for non-bodyweight exercise without adding bodyweight', () => {
    const exercise = { equipmentType: 'barbell' };
    const sets = [
      { weight: 100, reps: 10, repsInReserve: 0 },
      { weight: 100, reps: 10, repsInReserve: 1 },
    ];
    // Volume calculation is based on average 1RM. We expect a consistent value.
    expect(calculateExerciseVolume(sets, exercise, 80)).toBeGreaterThan(200);
    // Ensuring bodyweight is NOT added. If it was, the value would be much higher.
    const withZeroBw = calculateExerciseVolume(sets, exercise, 0);
    expect(calculateExerciseVolume(sets, exercise, 80)).toBe(withZeroBw);
  });

  it('calculates volume for bodyweight exercise including bodyweight', () => {
    const exercise = { equipmentType: 'bodyweight' };
    const sets = [
      { weight: 20, reps: 10, repsInReserve: 0 },
    ];
    // If bodyweight is 80, effective weight is 100.
    const volumeWithBw = calculateExerciseVolume(sets, exercise, 80);
    const volumeWithoutBw = calculateExerciseVolume(sets, exercise, 0);
    expect(volumeWithBw).toBeGreaterThan(volumeWithoutBw);

    // Volume with 20kg + 80kg bodyweight should equal volume of 100kg without bodyweight
    const equivalentSets = [{ weight: 100, reps: 10, repsInReserve: 0 }];
    const equivalentExercise = { equipmentType: 'barbell' };
    expect(volumeWithBw).toBe(calculateExerciseVolume(equivalentSets, equivalentExercise, 0));
  });

  it('handles missing repsInReserve by defaulting to 0', () => {
    const exercise = { equipmentType: 'dumbbell' };
    const setsWithoutRir = [{ weight: 50, reps: 5 }];
    const setsWithZeroRir = [{ weight: 50, reps: 5, repsInReserve: 0 }];
    expect(calculateExerciseVolume(setsWithoutRir, exercise, 80)).toBe(
      calculateExerciseVolume(setsWithZeroRir, exercise, 80)
    );
  });
});

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
