import { MAX_E1RM_REPS } from '@/utils/relativeStrength';
import { calculateAverage1RM } from '@/utils/workoutCalculator';

import {
  estimateOneRepMax,
  MAX_REPS_IN_RESERVE,
  ONE_REP_MAX_PERCENTAGES,
  validateOneRepMaxInput,
} from '../oneRepMaxModel';

describe('validateOneRepMaxInput', () => {
  it('waits silently while the weight or reps are empty', () => {
    expect(validateOneRepMaxInput('', '', '')).toEqual({ ok: false, problem: null });
    expect(validateOneRepMaxInput('100', '', '')).toEqual({ ok: false, problem: null });
  });

  it('reads a comma decimal and treats an empty reserve as 0', () => {
    expect(validateOneRepMaxInput('62,5', '5', '')).toEqual({
      ok: true,
      input: { weight: 62.5, reps: 5, repsInReserve: 0 },
    });
  });

  it('refuses sets above the 10 reps the app also ignores', () => {
    expect(validateOneRepMaxInput('60', '11', '0')).toEqual({ ok: false, problem: 'repsTooHigh' });
    expect(validateOneRepMaxInput('60', '10', '0').ok).toBe(true);
  });

  it.each([
    ['0', '5', '0', 'weight'],
    ['abc', '5', '0', 'weight'],
    ['100', '0', '0', 'reps'],
    ['100', '2.5', '0', 'reps'],
    ['100', '5', '-1', 'reserve'],
    ['100', '5', String(MAX_REPS_IN_RESERVE + 1), 'reserve'],
  ])('flags %s x %s with reserve %s as a %s problem', (weight, reps, reserve, problem) => {
    expect(validateOneRepMaxInput(weight, reps, reserve)).toEqual({ ok: false, problem });
  });
});

describe('estimateOneRepMax', () => {
  it("is the app's own averaged estimate", () => {
    const estimate = estimateOneRepMax({ weight: 100, reps: 5, repsInReserve: 0 });
    expect(estimate.oneRepMax).toBe(calculateAverage1RM(100, 5, 0));
  });

  it('counts reps in reserve as reps still in the tank', () => {
    const failure = estimateOneRepMax({ weight: 100, reps: 5, repsInReserve: 0 });
    const reserve = estimateOneRepMax({ weight: 100, reps: 5, repsInReserve: 2 });
    expect(reserve.oneRepMax).toBeGreaterThan(failure.oneRepMax);
    expect(reserve.oneRepMax).toBe(calculateAverage1RM(100, 5, 2));
  });

  it('a single rep to failure is close to the weight itself (the averaged formulas run about 2% high)', () => {
    const estimate = estimateOneRepMax({ weight: 140, reps: 1, repsInReserve: 0 });
    expect(estimate.oneRepMax).toBeGreaterThan(139);
    expect(estimate.oneRepMax).toBeLessThan(145);
  });

  it('reports the spread between the highest and lowest formula', () => {
    const estimate = estimateOneRepMax({ weight: 100, reps: 8, repsInReserve: 0 });
    expect(estimate.formulas).toHaveLength(7);
    expect(estimate.low).toBeLessThanOrEqual(estimate.oneRepMax);
    expect(estimate.high).toBeGreaterThanOrEqual(estimate.oneRepMax);
    expect(estimate.high).toBeGreaterThan(estimate.low);
  });

  it('lists every percentage, heaviest first, with rising reps', () => {
    const { rows, oneRepMax } = estimateOneRepMax({ weight: 100, reps: 5, repsInReserve: 0 });
    expect(rows.map((row) => row.percent)).toEqual([...ONE_REP_MAX_PERCENTAGES]);
    expect(rows[0].weight).toBeCloseTo(oneRepMax, 6);
    expect(rows[0].reps).toBe(1);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].weight).toBeLessThan(rows[index - 1].weight);
      expect(rows[index].reps).toBeGreaterThanOrEqual(rows[index - 1].reps);
    }
  });

  it('marks the rows whose reps pass the trusted limit as extrapolated, and no others', () => {
    const { rows } = estimateOneRepMax({ weight: 100, reps: 5, repsInReserve: 0 });
    expect(rows.some((row) => row.extrapolated)).toBe(true);
    expect(rows.some((row) => !row.extrapolated)).toBe(true);

    for (const row of rows) {
      expect(row.extrapolated).toBe(row.reps > MAX_E1RM_REPS);
    }
  });
});
