import { kgToDisplay } from '@/utils/unitConversion';
import { calculateAverage1RM, calculateWeightForTargetRIR } from '@/utils/workoutCalculator';

import {
  calculateRpeTarget,
  CHART_REPS,
  CHART_RPES,
  percentOfOneRepMax,
  rpeChartRows,
  validateRpeCalculator,
} from '../rpeChartModel';

const valid = {
  units: 'metric' as const,
  weightText: '100',
  repsText: '5',
  rpe: 8,
  targetRepsText: '3',
  targetRpe: 9,
};

describe('RPE chart', () => {
  it('reads one rep at RPE 10 as about the whole weight', () => {
    expect(Math.abs(percentOfOneRepMax(1, 10) - 100)).toBeLessThanOrEqual(2);
  });

  it('lists every rep row against every RPE column', () => {
    const rows = rpeChartRows();
    expect(rows.map((row) => row.reps)).toEqual([...CHART_REPS]);
    for (const row of rows) {
      expect(row.cells.map((cell) => cell.rpe)).toEqual([...CHART_RPES]);
    }
  });

  it('falls as reps rise at a given RPE', () => {
    for (const rpe of CHART_RPES) {
      for (let reps = 2; reps <= 10; reps++) {
        expect(percentOfOneRepMax(reps, rpe)).toBeLessThan(percentOfOneRepMax(reps - 1, rpe));
      }
    }
  });

  it('falls as RPE falls at a given rep count (more reps left, lighter load)', () => {
    for (const reps of CHART_REPS) {
      for (let index = 1; index < CHART_RPES.length; index++) {
        expect(percentOfOneRepMax(reps, CHART_RPES[index])).toBeLessThan(
          percentOfOneRepMax(reps, CHART_RPES[index - 1])
        );
      }
    }
  });

  it('uses the app averaged formula', () => {
    expect(percentOfOneRepMax(5, 8)).toBe(Math.round(100 / calculateAverage1RM(1, 5, 2)));
  });
});

describe('validateRpeCalculator', () => {
  it('waits silently while a field is empty', () => {
    expect(validateRpeCalculator({ ...valid, weightText: '' })).toEqual({
      ok: false,
      problem: null,
    });
    expect(validateRpeCalculator({ ...valid, targetRepsText: '' })).toEqual({
      ok: false,
      problem: null,
    });
  });

  it.each([
    [{ weightText: '0' }, 'weight'],
    [{ weightText: 'x' }, 'weight'],
    [{ repsText: '0' }, 'reps'],
    [{ repsText: '11' }, 'reps'],
    [{ repsText: '2.5' }, 'reps'],
    [{ targetRepsText: '11' }, 'targetReps'],
    [{ targetRepsText: '0' }, 'targetReps'],
  ])('refuses %o as a %s problem', (override, problem) => {
    expect(validateRpeCalculator({ ...valid, ...override })).toEqual({ ok: false, problem });
  });

  it('converts typed pounds to kilograms', () => {
    const result = validateRpeCalculator({ ...valid, units: 'imperial', weightText: '220' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.weightKg).toBeCloseTo(99.79, 1);
    }
  });
});

describe('calculateRpeTarget', () => {
  it('gives the plan example: 100 kg x 5 at RPE 8 becomes 3 reps at RPE 9', () => {
    const result = validateRpeCalculator(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const { targetKg, oneRepMaxKg } = calculateRpeTarget(result.input);
    expect(oneRepMaxKg).toBe(calculateAverage1RM(100, 5, 2));
    expect(targetKg).toBe(calculateWeightForTargetRIR(calculateAverage1RM(100, 5, 2), 3, 1));
  });

  it('rounds to a bar with standard plates in metric (2.5 kg steps)', () => {
    const result = validateRpeCalculator(valid);
    if (!result.ok) {
      throw new Error('expected a valid input');
    }

    const { roundedTargetKg } = calculateRpeTarget(result.input);
    const step = kgToDisplay(roundedTargetKg, 'metric') / 2.5;
    expect(Math.abs(step - Math.round(step))).toBeLessThan(1e-9);
  });

  it('rounds in pounds in 5 lb steps for an imperial user', () => {
    const result = validateRpeCalculator({ ...valid, units: 'imperial', weightText: '225' });
    if (!result.ok) {
      throw new Error('expected a valid input');
    }

    const { roundedTargetKg } = calculateRpeTarget(result.input);
    const pounds = kgToDisplay(roundedTargetKg, 'imperial');
    expect(Math.abs(pounds / 5 - Math.round(pounds / 5))).toBeLessThan(1e-9);
  });
});
