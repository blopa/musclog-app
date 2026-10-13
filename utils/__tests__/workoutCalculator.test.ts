import { calculateCaloriesBurnedBySteps, calculateSessionVolumeFromSets, calculateSetVolume } from '@/utils/workoutCalculator';

describe('calculateSetVolume', () => {
  it('calculates volume correctly for normal weight with no equipment', () => {
    expect(calculateSetVolume(100, 10, 0, 'barbell', 80)).toBeCloseTo(128.26, 2);
  });

  it('calculates volume correctly taking into account reps in reserve (rir)', () => {
    expect(calculateSetVolume(100, 10, 2, 'barbell', 80)).toBeCloseTo(134.4, 2);
  });

  it('adds bodyweight for bodyweight equipment type', () => {
    expect(calculateSetVolume(0, 10, 0, 'bodyweight', 80)).toBeCloseTo(102.61, 2);
    expect(calculateSetVolume(20, 10, 0, 'bodyweight', 80)).toBeCloseTo(128.26, 2);
  });

  it('does not add bodyweight for other equipment types', () => {
    expect(calculateSetVolume(100, 10, 0, 'machine', 80)).toBeCloseTo(128.26, 2);
  });

  it('handles missing repsInReserve (defaults to 0)', () => {
    expect(calculateSetVolume(100, 10, undefined, 'barbell', 80)).toBeCloseTo(128.26, 2);
  });

  it('treats a zero bodyWeightKg as no added bodyweight', () => {
    expect(calculateSetVolume(100, 10, 0, 'bodyweight', 0)).toBeCloseTo(128.26, 2);
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

describe('calculateSessionVolumeFromSets and warm-ups', () => {
  const exercises = new Map([['bench', { equipmentType: 'barbell' }]]) as any;
  const working = {
    exerciseId: 'bench',
    weight: 100,
    reps: 5,
    completionStatus: 'performed' as const,
  };
  const warmup = { ...working, weight: 40, setType: 'warmup' };

  it('never counts a warm-up toward volume', () => {
    const withWarmup = calculateSessionVolumeFromSets([warmup, working], exercises, 80, {
      onlyCompletedSets: true,
    });
    const withoutWarmup = calculateSessionVolumeFromSets([working], exercises, 80, {
      onlyCompletedSets: true,
    });

    expect(withWarmup).toBe(withoutWarmup);
    expect(withWarmup).toBeGreaterThan(0);
  });

  it('also leaves warm-ups out of a preview of sets that are not done yet', () => {
    const planned = { ...working, completionStatus: 'planned' as const };
    const plannedWarmup = { ...warmup, completionStatus: 'planned' as const };

    expect(calculateSessionVolumeFromSets([plannedWarmup, planned], exercises, 80)).toBe(
      calculateSessionVolumeFromSets([planned], exercises, 80)
    );
  });

  it('still counts a normal set that merely has no type', () => {
    const untyped = {
      exerciseId: 'bench',
      weight: 100,
      reps: 5,
      completionStatus: 'performed' as const,
    };
    expect(calculateSessionVolumeFromSets([untyped], exercises, 80)).toBeGreaterThan(0);
  });
});
