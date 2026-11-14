import { STRENGTH_GRADED_EXERCISE_IDS } from '@/utils/strengthGradedLifts';
import { calculateAverage1RM } from '@/utils/workoutCalculator';
import { gradeStrength } from '@/utils/strengthLevel';
import { RS_ADVANCED, RS_INTERMEDIATE } from '@/utils/relativeStrength';

import {
  checkStrength,
  gradeEstimate,
  type StrengthLift,
  strengthLifts,
  strengthTable,
  validateStrengthCheck,
} from '../strengthLevelModel';

const lifts = strengthLifts((slug) => slug.replace(/_/g, ' '));
const squat = lifts.find((lift) => lift.slug === 'Barbell_Squat')!;
const dumbbellCurl = lifts.find((lift) => lift.slug === 'Dumbbell_Bicep_Curl')!;

const base = {
  units: 'metric' as const,
  gender: 'male' as const,
  lift: squat,
  bodyWeightText: '80',
  weightText: '120',
  repsText: '5',
  reserveText: '',
};

describe('strengthLifts', () => {
  it('lists every graded lift once, each resolving to a catalogue entry with a load benchmark', () => {
    expect(lifts).toHaveLength(STRENGTH_GRADED_EXERCISE_IDS.size);
    for (const lift of lifts) {
      expect(STRENGTH_GRADED_EXERCISE_IDS.has(lift.id)).toBe(true);
      expect(lift.loadMultiplier).toBeGreaterThan(0);
      expect(lift.muscleGroup).toBeTruthy();
    }
  });

  it('marks dumbbell lifts as per hand and barbell lifts as not', () => {
    expect(dumbbellCurl.perHand).toBe(true);
    expect(squat.perHand).toBe(false);
  });
});

describe('validateStrengthCheck', () => {
  it('waits silently while body weight, weight or reps are empty, or no lift is picked', () => {
    expect(validateStrengthCheck({ ...base, bodyWeightText: '' })).toEqual({
      ok: false,
      problem: null,
    });
    expect(validateStrengthCheck({ ...base, weightText: ' ' })).toEqual({
      ok: false,
      problem: null,
    });
    expect(validateStrengthCheck({ ...base, repsText: '' })).toEqual({ ok: false, problem: null });
    expect(validateStrengthCheck({ ...base, lift: null })).toEqual({ ok: false, problem: null });
  });

  it('converts typed pounds to kilograms once and reads a comma decimal', () => {
    const result = validateStrengthCheck({
      ...base,
      units: 'imperial',
      bodyWeightText: '176,4',
      weightText: '220',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.bodyWeightKg).toBeCloseTo(80, 0);
      expect(result.input.weightKg).toBeCloseTo(99.79, 1);
      expect(result.input.repsInReserve).toBe(0);
    }
  });

  it('refuses reps above 10 the way the one-rep-max tool does', () => {
    expect(validateStrengthCheck({ ...base, repsText: '11' })).toEqual({
      ok: false,
      problem: 'repsTooHigh',
    });
  });

  it.each([
    [{ bodyWeightText: '0' }, 'bodyWeight'],
    [{ bodyWeightText: 'abc' }, 'bodyWeight'],
    [{ weightText: '0' }, 'weight'],
    [{ repsText: '0' }, 'reps'],
    [{ repsText: '2.5' }, 'reps'],
    [{ reserveText: '10' }, 'reserve'],
    [{ reserveText: '-1' }, 'reserve'],
  ])('flags %o as a %s problem', (override, problem) => {
    expect(validateStrengthCheck({ ...base, ...override })).toEqual({ ok: false, problem });
  });
});

describe('checkStrength', () => {
  it('grades a male squat exactly as the app does', () => {
    const result = checkStrength({
      bodyWeightKg: 80,
      weightKg: 120,
      reps: 5,
      repsInReserve: 0,
      gender: 'male',
      lift: squat,
    });
    expect(result).not.toBeNull();
    expect(result!.estimated1RmKg).toBe(calculateAverage1RM(120, 5, 0));
    expect(result!.grade).toEqual(
      gradeStrength({
        estimated1RmKg: calculateAverage1RM(120, 5, 0),
        bodyWeightKg: 80,
        loadMultiplier: squat.loadMultiplier,
        gender: 'male',
        muscleGroup: squat.muscleGroup,
      })
    );
  });

  it('grades a female lift on the women scale for its body region', () => {
    const result = checkStrength({
      bodyWeightKg: 60,
      weightKg: 60,
      reps: 5,
      repsInReserve: 1,
      gender: 'female',
      lift: squat,
    });
    expect(result!.grade).toEqual(
      gradeStrength({
        estimated1RmKg: calculateAverage1RM(60, 5, 1),
        bodyWeightKg: 60,
        loadMultiplier: squat.loadMultiplier,
        gender: 'female',
        muscleGroup: squat.muscleGroup,
      })
    );
    expect(result!.grade.upperLevel).toBeNull();
  });

  it('gives a range for sex other when the two scales grade differently', () => {
    const grade = checkStrength({
      bodyWeightKg: 70,
      weightKg: 100,
      reps: 5,
      repsInReserve: 0,
      gender: 'other',
      lift: squat,
    })!.grade;
    const male = gradeEstimate({
      estimated1RmKg: calculateAverage1RM(100, 5, 0),
      bodyWeightKg: 70,
      gender: 'male',
      lift: squat,
    })!;
    const female = gradeEstimate({
      estimated1RmKg: calculateAverage1RM(100, 5, 0),
      bodyWeightKg: 70,
      gender: 'female',
      lift: squat,
    })!;

    expect(grade.level).toBe(male.level);
    expect(grade.upperLevel).toBe(female.level === male.level ? null : female.level);
  });

  it('puts an estimate exactly on a boundary in the higher level', () => {
    const onBoundary = strengthTable(80, squat).find((row) => row.level === 'intermediate')!;
    const justBelow = onBoundary.maleKg * (1 - 1e-6);

    expect(
      gradeEstimate({
        estimated1RmKg: onBoundary.maleKg,
        bodyWeightKg: 80,
        gender: 'male',
        lift: squat,
      })!.level
    ).toBe('intermediate');
    expect(
      gradeEstimate({ estimated1RmKg: justBelow, bodyWeightKg: 80, gender: 'male', lift: squat })!
        .level
    ).toBe('novice');
  });

  it('reports the 1RM needed for the next level in kilograms', () => {
    const result = checkStrength({
      bodyWeightKg: 80,
      weightKg: 100,
      reps: 5,
      repsInReserve: 0,
      gender: 'male',
      lift: squat,
    })!;
    expect(result.grade.level).toBe('intermediate');
    expect(result.grade.nextLevel).toBe('advanced');
    expect(result.grade.nextLevelKg).toBeCloseTo(RS_ADVANCED * 80 * squat.loadMultiplier, 6);
  });

  it('builds the table from the same boundaries, one row per level above beginner', () => {
    const table = strengthTable(80, squat);
    expect(table.map((row) => row.level)).toEqual(['novice', 'intermediate', 'advanced', 'elite']);
    expect(table[1].maleKg).toBeCloseTo(RS_INTERMEDIATE * 80 * squat.loadMultiplier, 6);
    expect(table[0].femaleKg).toBeLessThan(table[0].maleKg);
  });

  it('returns nothing when the lift cannot be graded', () => {
    const noBenchmark: StrengthLift = { ...squat, loadMultiplier: 0 };
    expect(
      checkStrength({
        bodyWeightKg: 80,
        weightKg: 100,
        reps: 5,
        repsInReserve: 0,
        gender: 'male',
        lift: noBenchmark,
      })
    ).toBeNull();
  });
});
