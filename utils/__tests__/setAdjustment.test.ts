import {
  computeIntraSessionAdjustment,
  DEFAULT_TARGET_REPS_IN_RESERVE,
} from '@/utils/setAdjustment';

describe('computeIntraSessionAdjustment', () => {
  const base = {
    progressionMode: 'reps_first' as const,
    isBodyweight: false,
    bodyWeightKg: 70,
  };

  it('re-targets reps and carries the previous load over in reps_first mode', () => {
    // 12 kg x 11 @ 0 RIR averages out to a ~15.75 kg 1RM; holding 2 RIR at 12 kg lands on 9 reps.
    const result = computeIntraSessionAdjustment({
      ...base,
      previousSet: { weight: 12, reps: 11, repsInReserve: 0 },
      plannedSet: { weight: 18, reps: 14, repsInReserve: 2 },
    });

    expect(result.weight).toBe(12);
    expect(result.reps).toBe(9);
    expect(result.adjustment).toMatchObject({
      cause: 'target_rir',
      field: 'reps',
      from: 14,
      to: 9,
      targetRepsInReserve: 2,
    });
    expect(result.adjustment?.estimatedOneRepMaxKg).toBeCloseTo(15.75, 1);
  });

  it('re-targets weight in weight_first mode and reports the change against the plan', () => {
    const result = computeIntraSessionAdjustment({
      ...base,
      progressionMode: 'weight_first',
      previousSet: { weight: 60, reps: 10, repsInReserve: 0 },
      plannedSet: { weight: 60, reps: 5, repsInReserve: 0 },
    });

    expect(result.reps).toBe(5);
    expect(result.weight).toBeGreaterThan(60);
    expect(result.adjustment).toMatchObject({
      cause: 'target_rir',
      field: 'weight',
      from: 60,
      to: result.weight,
      targetRepsInReserve: 0,
    });
  });

  it('reports a bare carry-over when the target RIR needs no further change', () => {
    // The planned 18 kg gives way to the 12 kg actually lifted, and 12 kg is already the
    // weight that matches the previous set's 1RM at 11 reps / 0 RIR.
    const result = computeIntraSessionAdjustment({
      ...base,
      progressionMode: 'weight_first',
      previousSet: { weight: 12, reps: 11, repsInReserve: 0 },
      plannedSet: { weight: 18, reps: 11, repsInReserve: 0 },
    });

    expect(result.weight).toBe(12);
    expect(result.reps).toBe(11);
    expect(result.adjustment).toMatchObject({
      cause: 'carry_over',
      field: 'weight',
      from: 18,
      to: 12,
    });
  });

  it('reports no adjustment when the set is presented exactly as planned', () => {
    const result = computeIntraSessionAdjustment({
      ...base,
      previousSet: { weight: 50, reps: 10, repsInReserve: 2 },
      plannedSet: { weight: 50, reps: 10, repsInReserve: 2 },
    });

    expect(result).toEqual({ weight: 50, reps: 10, adjustment: null });
  });

  it('leaves a weight under the carry-over epsilon alone', () => {
    const result = computeIntraSessionAdjustment({
      ...base,
      progressionMode: 'weight_first',
      previousSet: { weight: 50.05, reps: 10, repsInReserve: 2 },
      plannedSet: { weight: 50, reps: 10, repsInReserve: 2 },
    });

    expect(result.weight).toBe(50);
    expect(result.adjustment).toBeNull();
  });

  it('does not carry over onto an unloaded planned set', () => {
    const result = computeIntraSessionAdjustment({
      ...base,
      isBodyweight: true,
      previousSet: { weight: 0, reps: 10, repsInReserve: 2 },
      plannedSet: { weight: 0, reps: 10, repsInReserve: 2 },
    });

    expect(result.weight).toBe(0);
    expect(result.adjustment).toBeNull();
  });

  it('counts bodyweight toward the estimate for unloaded bodyweight movements', () => {
    // A pull-up logged with no added weight: without the bodyweight term there is no load to
    // estimate from at all, and the set would be re-targeted down to a single rep.
    const previousSet = { weight: 0, reps: 10, repsInReserve: 0 };
    const plannedSet = { weight: 0, reps: 3, repsInReserve: 0 };

    const loaded = computeIntraSessionAdjustment({
      ...base,
      isBodyweight: true,
      previousSet,
      plannedSet,
    });
    const unloaded = computeIntraSessionAdjustment({
      ...base,
      isBodyweight: false,
      previousSet,
      plannedSet,
    });

    expect(loaded.adjustment?.estimatedOneRepMaxKg).toBeCloseTo(89.78, 1);
    expect(unloaded.adjustment?.estimatedOneRepMaxKg).toBe(0);
    expect(loaded.reps).toBe(10);
    expect(unloaded.reps).toBe(1);
  });

  it('falls back to the default target RIR when the plan does not name one', () => {
    const result = computeIntraSessionAdjustment({
      ...base,
      previousSet: { weight: 12, reps: 11 },
      plannedSet: { weight: 18, reps: 14 },
    });

    expect(result.adjustment?.targetRepsInReserve).toBe(DEFAULT_TARGET_REPS_IN_RESERVE);
  });
});
