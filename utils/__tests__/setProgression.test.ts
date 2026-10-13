import {
  parseStartAdjustment,
  revertTargetFor,
  serializeStartAdjustment,
  type StartSetAdjustment,
} from '../setAdjustment';
import {
  computeStartTarget,
  defaultRepsFor,
  repsFirstRange,
  type LastWorkingSession,
  planStartChanges,
  type StartTarget,
} from '../setProgression';

const wholeKg = (kg: number) => Math.round(kg);
const last = (
  weightKg: number,
  reps: number,
  averageRepsInReserve: number
): LastWorkingSession => ({
  weightKg,
  reps,
  averageRepsInReserve,
});
const target = (overrides: Partial<Parameters<typeof computeStartTarget>[0]> = {}) =>
  computeStartTarget({
    last: last(100, 8, 4),
    progressionMode: 'weight_first',
    isCompound: true,
    incrementKg: 2.5,
    roundLoad: wholeKg,
    ...overrides,
  });

describe('computeStartTarget', () => {
  describe('weight_first', () => {
    it('adds one increment when last time left plenty in reserve', () => {
      expect(target({ last: last(100, 8, 3) })).toEqual({
        weightKg: 103,
        reps: 8,
        kind: 'progression',
      });
    });

    it('progresses a lifter who trained exactly at the target effort', () => {
      // Two reps in reserve IS the prescription; waiting for three told them to repeat forever.
      expect(target({ last: last(100, 8, 2) })).toEqual({
        weightKg: 103,
        reps: 8,
        kind: 'progression',
      });
    });

    it('does not progress when the planned reps were missed, however easy it felt', () => {
      expect(target({ planReps: 8, last: last(100, 6, 4) })).toEqual({
        weightKg: 100,
        reps: 6,
        kind: 'repeat',
      });
    });

    it('rounds the new load with the supplied rounding', () => {
      expect(target({ roundLoad: (kg) => kg })).toMatchObject({ weightKg: 102.5 });
    });

    it('holds after one session with nothing left in reserve: one hard day is not a stall', () => {
      expect(target({ last: last(100, 8, 0) })).toEqual({ weightKg: 100, reps: 8, kind: 'repeat' });
    });

    it('deloads by 10% of the load when the session before also had nothing left', () => {
      expect(target({ last: last(100, 8, 0), failedBefore: true })).toEqual({
        weightKg: 90,
        reps: 8,
        kind: 'deload',
      });
    });

    it('never deloads below zero', () => {
      expect(target({ last: last(1, 8, 0), failedBefore: true, incrementKg: 2.5 }).weightKg).toBe(
        0
      );
    });

    it('repeats last time in between', () => {
      expect(target({ last: last(100, 8, 1) })).toEqual({ weightKg: 100, reps: 8, kind: 'repeat' });
      expect(target({ last: last(100, 8, 1.5) })).toEqual({
        weightKg: 100,
        reps: 8,
        kind: 'repeat',
      });
    });
  });

  describe('reps_first', () => {
    it('adds a rep while there is room in the range', () => {
      expect(target({ progressionMode: 'reps_first', last: last(100, 8, 4) })).toEqual({
        weightKg: 100,
        reps: 9,
        kind: 'progression',
      });
    });

    it('adds the increment and resets to the bottom of the range at the top of it', () => {
      // A compound lift works in 8–12: at 12 reps the load goes up and the reps start over at 8.
      expect(target({ progressionMode: 'reps_first', last: last(100, 12, 4) })).toEqual({
        weightKg: 103,
        reps: 8,
        kind: 'progression',
      });
    });

    it('works upward from the planned reps instead of drifting into a generic range', () => {
      // A 5-rep strength block climbs to 7 reps, then adds load and returns to 5 — it never
      // becomes the 8–12 hypertrophy range the generic default would walk it into.
      expect(target({ progressionMode: 'reps_first', planReps: 5, last: last(100, 5, 4) })).toEqual(
        { weightKg: 100, reps: 6, kind: 'progression' }
      );
      expect(target({ progressionMode: 'reps_first', planReps: 5, last: last(100, 7, 4) })).toEqual(
        { weightKg: 103, reps: 5, kind: 'progression' }
      );
      // A high-rep plan is not cut down to the default range's ceiling either.
      expect(
        target({
          progressionMode: 'reps_first',
          isCompound: false,
          planReps: 20,
          last: last(10, 20, 4),
        })
      ).toEqual({ weightKg: 10, reps: 21, kind: 'progression' });
    });

    it('uses a higher range for isolation work', () => {
      expect(defaultRepsFor(true)).toBe(10);
      expect(defaultRepsFor(false)).toBe(14);
      // Isolation works in 12–16, so 12 reps is still inside it.
      expect(
        target({ progressionMode: 'reps_first', isCompound: false, last: last(20, 12, 4) })
      ).toMatchObject({ weightKg: 20, reps: 13 });
      expect(
        target({ progressionMode: 'reps_first', isCompound: false, last: last(20, 16, 4) })
      ).toMatchObject({ weightKg: 23, reps: 12 });
    });
  });
});

describe('computeStartTarget without rated effort', () => {
  const unrated = (
    reps: number,
    overrides: Partial<Parameters<typeof computeStartTarget>[0]> = {}
  ) =>
    target({
      last: { weightKg: 100, reps, averageRepsInReserve: 0, rirRecorded: false },
      planReps: 5,
      ...overrides,
    });

  it('climbs the plan rep range one rep at a time, with a reason that names no effort', () => {
    expect(unrated(5)).toEqual({
      weightKg: 100,
      reps: 6,
      kind: 'progression',
      rule: { kind: 'range', outcome: 'add_reps', repMin: 5, repMax: 7 },
    });
  });

  it('adds load and restarts at the plan reps once the top of the range is reached', () => {
    expect(unrated(7)).toEqual({
      weightKg: 103,
      reps: 5,
      kind: 'progression',
      rule: { kind: 'range', outcome: 'add_weight', repMin: 5, repMax: 7 },
    });
  });

  it('works the same in either progression mode', () => {
    expect(unrated(5, { progressionMode: 'reps_first' })).toEqual(unrated(5));
  });

  it('holds when the plan reps were missed', () => {
    expect(unrated(4)).toEqual({ weightKg: 100, reps: 4, kind: 'repeat' });
  });

  it('holds when there is no plan to judge the reps against', () => {
    expect(unrated(12, { planReps: undefined })).toEqual({
      weightKg: 100,
      reps: 12,
      kind: 'repeat',
    });
  });

  it('carries the reason onto the set explanation', () => {
    const start = unrated(5);
    const [change] = planStartChanges([{ id: 's1', weight: 100, reps: 5 }], start, {
      weightKg: 100,
      reps: 5,
      averageRepsInReserve: 0,
    });
    expect(change.adjustment.rule).toEqual(start.rule);
  });
});

describe('repsFirstRange', () => {
  it('anchors on the plan when there is one, and on the generic range otherwise', () => {
    expect(repsFirstRange(true, 5)).toEqual({ minReps: 5, maxReps: 7 });
    expect(repsFirstRange(true)).toEqual({ minReps: 8, maxReps: 12 });
    expect(repsFirstRange(false, 0)).toEqual({ minReps: 12, maxReps: 16 });
  });
});

describe('planStartChanges', () => {
  const sets = [
    { id: 's1', weight: 60, reps: 8 },
    { id: 's2', weight: 60, reps: 8 },
    { id: 's3', weight: 60, reps: 8 },
  ];
  const progression: StartTarget = { weightKg: 65, reps: 8, kind: 'progression' };
  const lastSession = last(62.5, 8, 4);

  it('rewrites every straight set and says why', () => {
    const changes = planStartChanges(sets, progression, lastSession);

    expect(changes.map((c) => c.setId)).toEqual(['s1', 's2', 's3']);
    expect(changes[0]).toMatchObject({ weightKg: 65, reps: 8 });
    expect(changes[0].adjustment).toEqual({
      cause: 'progression',
      field: 'weight',
      from: 60,
      to: 65,
      plan: { weightKg: 60, reps: 8 },
      last: lastSession,
      now: { weightKg: 65, reps: 8 },
    });
  });

  it('leaves a pyramid, back-off or drop set exactly as planned', () => {
    const changes = planStartChanges(
      [
        { id: 'top', weight: 80, reps: 5 },
        { id: 'back-off-1', weight: 70, reps: 8 },
        { id: 'back-off-2', weight: 70, reps: 8 },
      ],
      { weightKg: 85, reps: 5, kind: 'progression' },
      last(80, 5, 4)
    );

    // Only the sets that match the first one are the "straight" block.
    expect(changes.map((c) => c.setId)).toEqual(['top']);
  });

  it('reports reps as the field when only the reps move', () => {
    const [change] = planStartChanges(
      sets,
      { weightKg: 60, reps: 9, kind: 'progression' },
      lastSession
    );

    expect(change.adjustment).toMatchObject({ field: 'reps', from: 8, to: 9 });
  });

  it('reports weight as the primary field when both move', () => {
    const [change] = planStartChanges(
      sets,
      { weightKg: 65, reps: 6, kind: 'progression' },
      lastSession
    );

    expect(change.adjustment).toMatchObject({ field: 'weight', from: 60, to: 65 });
    expect(change.adjustment.now).toEqual({ weightKg: 65, reps: 6 });
  });

  it('touches nothing when the target is what the plan already says', () => {
    expect(
      planStartChanges(sets, { weightKg: 60, reps: 8, kind: 'repeat' }, last(60, 8, 2))
    ).toEqual([]);
  });

  it('ignores a difference smaller than the precision of a stored weight', () => {
    expect(
      planStartChanges(sets, { weightKg: 60.004, reps: 8, kind: 'repeat' }, last(60, 8, 2))
    ).toEqual([]);
  });

  it('has nothing to do for an exercise with no planned working sets', () => {
    expect(planStartChanges([], progression, lastSession)).toEqual([]);
  });
});

describe('start adjustment persistence', () => {
  const adjustment: StartSetAdjustment = {
    cause: 'progression',
    field: 'weight',
    from: 60,
    to: 65,
    plan: { weightKg: 60, reps: 8 },
    last: { weightKg: 62.5, reps: 7, averageRepsInReserve: 3.5 },
    now: { weightKg: 65, reps: 8 },
  };

  it('round-trips', () => {
    expect(parseStartAdjustment(serializeStartAdjustment(adjustment))).toEqual(adjustment);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['not json'],
    ['{}'],
    [JSON.stringify({ ...adjustment, cause: 'target_rir' })],
    [JSON.stringify({ ...adjustment, field: 'sets' })],
    [JSON.stringify({ ...adjustment, to: 'a lot' })],
    [JSON.stringify({ ...adjustment, last: { weightKg: 1 } })],
    [JSON.stringify({ ...adjustment, plan: undefined })],
  ])('reads %p as no explanation rather than a wrong one', (raw) => {
    expect(parseStartAdjustment(raw as string)).toBeNull();
  });

  it('reverts a progression or deload to what the user did last time', () => {
    expect(revertTargetFor(adjustment)).toEqual({ weightKg: 62.5, reps: 7 });
    expect(revertTargetFor({ ...adjustment, cause: 'deload' })).toEqual({
      weightKg: 62.5,
      reps: 7,
    });
  });

  it("reverts a repeat — which already is last time — to the plan's own numbers", () => {
    expect(revertTargetFor({ ...adjustment, cause: 'repeat' })).toEqual({ weightKg: 60, reps: 8 });
  });
});

describe('session completeness and the weakest set', () => {
  const base = {
    progressionMode: 'reps_first' as const,
    isCompound: true,
    incrementKg: 2.5,
    roundLoad: (kg: number) => kg,
  };

  it('holds when the last session left prescribed sets undone, however well the done ones went', () => {
    expect(
      computeStartTarget({
        ...base,
        planReps: 8,
        last: {
          weightKg: 60,
          reps: 8,
          averageRepsInReserve: 3,
          rirRecorded: true,
          complete: false,
        },
      })
    ).toEqual({ weightKg: 60, reps: 8, kind: 'repeat' });
  });

  it('judges an unrated session by its weakest set, not the first', () => {
    // Sets of 10 / 6 / 5 against a plan of 10: the first set alone said "go up".
    expect(
      computeStartTarget({
        ...base,
        planReps: 10,
        last: {
          weightKg: 60,
          reps: 10,
          lowestReps: 5,
          averageRepsInReserve: 0,
          rirRecorded: false,
        },
      })
    ).toEqual({ weightKg: 60, reps: 10, kind: 'repeat' });
  });

  it('adds weight only when every unrated set reached the top of the range', () => {
    const result = computeStartTarget({
      ...base,
      planReps: 10,
      last: { weightKg: 60, reps: 12, lowestReps: 12, averageRepsInReserve: 0, rirRecorded: false },
    });
    expect(result).toMatchObject({ weightKg: 62.5, reps: 10, kind: 'progression' });
  });

  it('keeps adding reps instead of a step that is a large share of a light load', () => {
    const result = computeStartTarget({
      ...base,
      progressionMode: 'weight_first',
      isCompound: false,
      last: { weightKg: 6, reps: 14, averageRepsInReserve: 3, rirRecorded: true },
    });
    expect(result).toEqual({ weightKg: 6, reps: 15, kind: 'progression' });
  });

  it('deloads by 10% of the load once that exceeds one step', () => {
    expect(
      computeStartTarget({
        ...base,
        failedBefore: true,
        last: { weightKg: 120, reps: 5, averageRepsInReserve: 0, rirRecorded: true },
      }).weightKg
    ).toBe(108);
  });
});
