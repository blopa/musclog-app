import { loadStepFor } from '@/utils/loadIncrement';
import { computeStartTarget } from '@/utils/setProgression';
import { displayToKg } from '@/utils/unitConversion';

import {
  MAX_OVERLOAD_REPS,
  type OverloadInput,
  planOverload,
  validateOverloadInput,
} from '../progressiveOverloadModel';

const fields = {
  weight: '100',
  reps: '8',
  plannedReps: '8',
  reserve: '2',
  complete: true,
  twoInARow: false,
};

const input = (overrides: Partial<OverloadInput> = {}): OverloadInput => ({
  weight: 100,
  reps: 8,
  plannedReps: 8,
  repsInReserve: 2,
  complete: true,
  twoInARow: false,
  ...overrides,
});

const options = (overrides = {}) => ({
  units: 'metric' as const,
  equipment: 'barbell' as const,
  mode: 'weight_first' as const,
  gym: null,
  ...overrides,
});

describe('validateOverloadInput', () => {
  it('waits silently while a required field is empty', () => {
    expect(validateOverloadInput({ ...fields, weight: '' }, 'metric')).toEqual({
      ok: false,
      problem: null,
    });
    expect(validateOverloadInput({ ...fields, plannedReps: ' ' }, 'metric').ok).toBe(false);
  });

  it('reads a comma decimal and treats an empty reserve as "not rated"', () => {
    expect(validateOverloadInput({ ...fields, weight: '62,5', reserve: '' }, 'metric')).toEqual({
      ok: true,
      input: input({ weight: 62.5, repsInReserve: null }),
    });
  });

  it.each([
    [{ weight: '0' }, 'weight'],
    [{ weight: '1001' }, 'weight'],
    [{ reps: '2.5' }, 'reps'],
    [{ reps: String(MAX_OVERLOAD_REPS + 1) }, 'reps'],
    [{ plannedReps: '0' }, 'plannedReps'],
    [{ reserve: '10' }, 'reserve'],
    [{ reserve: 'abc' }, 'reserve'],
  ])('flags %j as a %s problem', (override, problem) => {
    expect(validateOverloadInput({ ...fields, ...override }, 'metric')).toEqual({
      ok: false,
      problem,
    });
  });

  it('allows a heavier weight in pounds', () => {
    expect(validateOverloadInput({ ...fields, weight: '1500' }, 'imperial').ok).toBe(true);
    expect(validateOverloadInput({ ...fields, weight: '1500' }, 'metric')).toEqual({
      ok: false,
      problem: 'weight',
    });
  });
});

describe('planOverload', () => {
  it("is the app's own start target for the same last session", () => {
    const { incrementKg, roundLoad } = loadStepFor('barbell', null, 'metric');
    const expected = computeStartTarget({
      last: {
        weightKg: 100,
        reps: 8,
        lowestReps: 8,
        complete: true,
        averageRepsInReserve: 2,
        rirRecorded: true,
      },
      planReps: 8,
      progressionMode: 'weight_first',
      isCompound: true,
      incrementKg,
      roundLoad,
    });
    const plan = planOverload(input(), options());
    expect(plan.weightKg).toBe(expected.weightKg);
    expect(plan.reps).toBe(expected.reps);
    expect(plan.kind).toBe(expected.kind);
  });

  it('adds one step of weight when the session went well and the mode is weight first', () => {
    const plan = planOverload(input(), options());
    expect(plan).toMatchObject({
      kind: 'progression',
      reason: 'addWeight',
      weight: 102.5,
      reps: 8,
      change: 2.5,
      changePercent: 2.5,
      step: 2.5,
    });
  });

  it('adds a rep first in reps-first mode, then the weight at the top of the range', () => {
    const climb = planOverload(input(), options({ mode: 'reps_first' }));
    expect(climb).toMatchObject({ kind: 'progression', reason: 'addReps', weight: 100, reps: 9 });

    const top = planOverload(input({ reps: 10 }), options({ mode: 'reps_first' }));
    expect(top).toMatchObject({ reason: 'addWeight', weight: 102.5, reps: 8 });
  });

  it('keeps climbing reps when one step is too big a share of a light dumbbell', () => {
    const plan = planOverload(input({ weight: 6 }), options({ equipment: 'dumbbell' }));
    expect(plan).toMatchObject({
      kind: 'progression',
      reason: 'stepTooCoarse',
      weight: 6,
      reps: 9,
    });
  });

  it('repeats a session that left less than the success reserve', () => {
    expect(planOverload(input({ repsInReserve: 1 }), options())).toMatchObject({
      kind: 'repeat',
      reason: 'tooHard',
      weight: 100,
      change: 0,
    });
  });

  it('repeats when the planned reps were missed once, and deloads on the second miss', () => {
    expect(planOverload(input({ reps: 6, repsInReserve: 1 }), options())).toMatchObject({
      kind: 'repeat',
      reason: 'missedPlan',
    });

    const deload = planOverload(input({ reps: 6, repsInReserve: 1, twoInARow: true }), options());
    expect(deload).toMatchObject({ kind: 'deload', reason: 'deload' });
    expect(deload.weightKg).toBeLessThan(100);
    expect(deload.change).toBeLessThan(0);
  });

  it('never counts an unfinished session as a success', () => {
    expect(planOverload(input({ complete: false }), options())).toMatchObject({
      kind: 'repeat',
      reason: 'unfinished',
    });
  });

  it('judges an unrated session by its reps alone', () => {
    expect(planOverload(input({ repsInReserve: null }), options())).toMatchObject({
      kind: 'progression',
    });
    expect(planOverload(input({ repsInReserve: null, reps: 6 }), options())).toMatchObject({
      kind: 'repeat',
      reason: 'missedPlan',
    });
  });

  it('works in pounds, with whole-pound loads and the 5 lb step', () => {
    const plan = planOverload(input({ weight: 225 }), options({ units: 'imperial' }));
    expect(plan.weight).toBeCloseTo(230, 1);
    expect(plan.step).toBeCloseTo(5, 1);
    expect(plan.weightKg).toBeCloseTo(displayToKg(230, 'imperial'), 1);
  });

  it('lists the plates for a barbell and none for other equipment', () => {
    const barbell = planOverload(input(), options());
    expect(barbell.perSide).not.toBeNull();
    expect(barbell.perSide!.length).toBeGreaterThan(0);
    expect(planOverload(input(), options({ equipment: 'machine' })).perSide).toBeNull();
  });
});
