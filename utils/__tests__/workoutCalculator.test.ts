import {
  calculateCaloriesBurnedBySteps,
  calculateWorkoutVolume,
  calculateAverage1RM,
  type ExerciseWithSets,
} from '@/utils/workoutCalculator';

describe('calculateWorkoutVolume', () => {
  it('returns 0 for an empty array of exercises', () => {
    expect(calculateWorkoutVolume([])).toBe(0);
  });

  it('returns 0 when exercises have no sets', () => {
    const exercises: ExerciseWithSets[] = [
      { exercise: { equipmentType: 'barbell' }, sets: [] },
      { exercise: { equipmentType: 'dumbbell' }, sets: [] },
    ];
    expect(calculateWorkoutVolume(exercises)).toBe(0);
  });

  it('calculates the volume correctly for standard exercises without body weight', () => {
    const exercises: ExerciseWithSets[] = [
      {
        exercise: { equipmentType: 'barbell' },
        sets: [
          { weight: 100, reps: 5, repsInReserve: 0 },
          { weight: 100, reps: 5, repsInReserve: 1 },
        ],
      },
    ];

    const expected1RMSet1 = calculateAverage1RM(100, 5, 0);
    const expected1RMSet2 = calculateAverage1RM(100, 5, 1);
    // Since roundToDecimalPlaces is applied internally we expect it roughly
    // calculateWorkoutVolume uses roundToDecimalPlaces on the total

    const result = calculateWorkoutVolume(exercises);
    expect(result).toBeCloseTo(expected1RMSet1 + expected1RMSet2, 2);
  });

  it('adds body weight to sets when equipment type is bodyweight', () => {
    const bodyWeightKg = 80;
    const exercises: ExerciseWithSets[] = [
      {
        exercise: { equipmentType: 'bodyweight' },
        sets: [
          { weight: 10, reps: 10, repsInReserve: 0 }, // weighted pullup with 10kg + 80kg BW
        ],
      },
    ];

    const expected1RM = calculateAverage1RM(10 + bodyWeightKg, 10, 0);

    const result = calculateWorkoutVolume(exercises, bodyWeightKg);
    expect(result).toBeCloseTo(expected1RM, 2);
  });

  it('safely falls back if bodyWeightKg is not provided but equipment is bodyweight', () => {
    const exercises: ExerciseWithSets[] = [
      {
        exercise: { equipmentType: 'bodyweight' },
        sets: [
          { weight: 20, reps: 8, repsInReserve: 0 },
        ],
      },
    ];

    // Added weight is 0 if bodyWeightKg is not provided
    const expected1RM = calculateAverage1RM(20, 8, 0);

    // We omit bodyWeightKg, it should default to 0
    const result = calculateWorkoutVolume(exercises);
    expect(result).toBeCloseTo(expected1RM, 2);
  });

  it('calculates correctly for mixed exercises', () => {
    const bodyWeightKg = 75;
    const exercises: ExerciseWithSets[] = [
      {
        exercise: { equipmentType: 'bodyweight' },
        sets: [{ weight: 0, reps: 15, repsInReserve: 0 }],
      },
      {
        exercise: { equipmentType: 'machine' },
        sets: [{ weight: 50, reps: 10, repsInReserve: 2 }],
      },
    ];

    const expected1RMBodyweight = calculateAverage1RM(75, 15, 0); // 0 + 75
    const expected1RMMachine = calculateAverage1RM(50, 10, 2); // 50

    const result = calculateWorkoutVolume(exercises, bodyWeightKg);
    expect(result).toBeCloseTo(expected1RMBodyweight + expected1RMMachine, 2);
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
