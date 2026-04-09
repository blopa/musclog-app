import {
  calculateExerciseKcal,
  calculateWorkoutKcal,
  type MWEMInput,
} from '@/utils/workoutEnergyCalculator';

// Reference values computed from the master equation:
// kcal = ((weight + bodyMass) × 9.80665 × distance × reps) / (4184 × 0.22) × anaerobic × loadMultiplier × genderFactor

const BASE_USER = { weightKg: 80, heightCm: 180, gender: 'male' as const };

// ---------------------------------------------------------------------------
// calculateExerciseKcal
// ---------------------------------------------------------------------------

describe('calculateExerciseKcal', () => {
  it('compound barbell squat (legs) — male, 100kg × 5 reps', () => {
    const input: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'compound',
        muscleGroup: 'quads',
        equipmentType: 'barbell',
        loadMultiplier: 1,
      },
      sets: [{ weight: 100, reps: 5 }],
    };
    // distance = 1.80 × 0.45 = 0.81 m
    // bodyMass = 0.88 × 80 = 70.4 kg
    // totalMass = 100 + 70.4 = 170.4 kg
    // workJoules = 170.4 × 9.80665 × 0.81 × 5 ≈ 6773.6 J
    // kcal_raw = 6773.6 / (4184 × 0.22) ≈ 7.36 kcal
    // × 1.5 (compound) × 1 (loadMultiplier) × 1.0 (male) ≈ 11.04 kcal
    const result = calculateExerciseKcal(input);
    expect(result).toBeGreaterThan(10);
    expect(result).toBeLessThan(13);
  });

  it('isolation curl (biceps) — displacement factor 0.25', () => {
    const input: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'isolation',
        muscleGroup: 'biceps',
        equipmentType: 'dumbbell',
        loadMultiplier: 1,
      },
      sets: [{ weight: 20, reps: 10 }],
    };
    // distance = 1.80 × 0.25 = 0.45 m
    // bodyMass = 0.05 × 80 = 4 kg
    // totalMass = 24 kg
    // workJoules = 24 × 9.80665 × 0.45 × 10 ≈ 1058.1 J
    // kcal_raw = 1058.1 / (4184 × 0.22) ≈ 1.15 kcal
    // × 1.1 (isolation) × 1 × 1.0 ≈ 1.26 kcal
    const result = calculateExerciseKcal(input);
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThan(1.6);
  });

  it('bodyweight pushup — uses full bodyweight, anaerobic 1.5', () => {
    const input: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'compound',
        muscleGroup: 'chest',
        equipmentType: 'bodyweight',
        loadMultiplier: 1,
      },
      sets: [{ weight: 0, reps: 15 }],
    };
    // distance = 1.80 × 0.35 = 0.63 m
    // bodyMass = 1.0 × 80 = 80 kg  (bodyweight type)
    // totalMass = 0 + 80 = 80 kg
    // workJoules = 80 × 9.80665 × 0.63 × 15 ≈ 7418.2 J
    // kcal_raw = 7418.2 / 920.48 ≈ 8.06 kcal
    // × 1.5 × 1 × 1.0 ≈ 12.09 kcal
    const result = calculateExerciseKcal(input);
    expect(result).toBeGreaterThan(10);
    expect(result).toBeLessThan(15);
  });

  it('female gender factor reduces result by 10%', () => {
    const exerciseBase = {
      mechanicType: 'compound' as const,
      muscleGroup: 'chest' as const,
      equipmentType: 'barbell' as const,
      loadMultiplier: 1,
    };
    const sets = [{ weight: 60, reps: 8 }];

    const male = calculateExerciseKcal({ user: BASE_USER, exercise: exerciseBase, sets });
    const female = calculateExerciseKcal({
      user: { ...BASE_USER, gender: 'female' },
      exercise: exerciseBase,
      sets,
    });

    expect(female).toBeCloseTo(male * 0.9, 5);
  });

  it('skips sets with zero weight on non-bodyweight exercises', () => {
    const input: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'compound',
        muscleGroup: 'back',
        equipmentType: 'barbell',
        loadMultiplier: 1,
      },
      sets: [
        { weight: 0, reps: 5 }, // should be skipped
        { weight: 80, reps: 5 },
      ],
    };
    const withSkip = calculateExerciseKcal(input);
    const withoutSkip = calculateExerciseKcal({
      ...input,
      sets: [{ weight: 80, reps: 5 }],
    });
    expect(withSkip).toBeCloseTo(withoutSkip, 5);
  });

  it('skips sets with zero reps', () => {
    const input: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'isolation',
        muscleGroup: 'triceps',
        equipmentType: 'cable',
        loadMultiplier: 1,
      },
      sets: [{ weight: 30, reps: 0 }],
    };
    expect(calculateExerciseKcal(input)).toBe(0);
  });

  it('loadMultiplier scales the result proportionally', () => {
    const base: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'compound',
        muscleGroup: 'shoulders',
        equipmentType: 'barbell',
        loadMultiplier: 1,
      },
      sets: [{ weight: 50, reps: 6 }],
    };
    const doubled = { ...base, exercise: { ...base.exercise, loadMultiplier: 2 } };
    expect(calculateExerciseKcal(doubled)).toBeCloseTo(calculateExerciseKcal(base) * 2, 5);
  });
});

// ---------------------------------------------------------------------------
// calculateWorkoutKcal
// ---------------------------------------------------------------------------

describe('calculateWorkoutKcal', () => {
  it('sums across multiple exercises', () => {
    const squat: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'compound',
        muscleGroup: 'quads',
        equipmentType: 'barbell',
        loadMultiplier: 1,
      },
      sets: [{ weight: 100, reps: 5 }],
    };
    const curl: MWEMInput = {
      user: BASE_USER,
      exercise: {
        mechanicType: 'isolation',
        muscleGroup: 'biceps',
        equipmentType: 'dumbbell',
        loadMultiplier: 1,
      },
      sets: [{ weight: 20, reps: 10 }],
    };
    const total = calculateWorkoutKcal([squat, curl]);
    expect(total).toBeCloseTo(calculateExerciseKcal(squat) + calculateExerciseKcal(curl), 5);
  });

  it('returns 0 for empty input', () => {
    expect(calculateWorkoutKcal([])).toBe(0);
  });
});
