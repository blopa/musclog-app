import { workoutRamp } from '@/utils/comeback/comebackProgram';
import {
  applyWeekOverride,
  planComebackOverride,
  planWeekOverride,
  resolveStartOverride,
} from '@/utils/trainingWeekOverride';

const step = { incrementKg: 2.5, roundLoad: (kg: number) => Math.round(kg / 2.5) * 2.5 };
const planned = (n: number, weight = 60, reps = 8) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, weight, reps }));
const last = (weight: number, reps = 8, n = 3) =>
  Array.from({ length: n }, (_, i) => ({
    weightKg: weight,
    reps,
    repsInReserve: 2,
    prescribedIndex: i,
  }));

describe('planWeekOverride', () => {
  it('lighter: a deload of last time’s load, the plan’s reps, a third of the sets gone', () => {
    const plan = planWeekOverride({ kind: 'lighter', planned: planned(4), last: last(100), step });
    expect(plan.workingSetCount).toBe(3);
    expect(plan.dropSetIds).toEqual(['s4']);
    expect(plan.changes.map((c) => [c.setId, c.weightKg, c.reps, c.repsInReserve])).toEqual([
      ['s1', 90, 8, 4],
      ['s2', 90, 8, 4],
      ['s3', 90, 8, 4],
    ]);
    expect(plan.changes[0].adjustment).toMatchObject({
      cause: 'deload',
      source: 'weekly_review',
      field: 'weight',
      from: 60,
      to: 90,
    });
  });

  it('lighter: uses a deload of at least one step on a light load', () => {
    const plan = planWeekOverride({
      kind: 'lighter',
      planned: planned(3, 10),
      last: last(10),
      step,
    });
    expect(plan.changes[0].weightKg).toBe(7.5);
  });

  it('lighter: a bodyweight set loses sets but its load stays zero and unexplained', () => {
    const plan = planWeekOverride({
      kind: 'lighter',
      planned: planned(3, 0, 10),
      last: last(0, 10),
      step,
    });
    expect(plan.dropSetIds).toEqual(['s3']);
    expect(plan.changes[0]).toMatchObject({ weightKg: 0, reps: 10, repsInReserve: 4 });
    expect(plan.changes[0].adjustment).toBeNull();
  });

  it('lighter: falls back to the plan’s load with no history', () => {
    const plan = planWeekOverride({ kind: 'lighter', planned: planned(3), last: [], step });
    // 60 kg less 10% = 54 kg, snapped down to a loadable 52.5 kg.
    expect(plan.changes[0].weightKg).toBe(52.5);
    expect(plan.changes[0].adjustment?.source).toBe('weekly_review');
  });

  it('lighter: never leaves fewer than one set', () => {
    const plan = planWeekOverride({ kind: 'lighter', planned: planned(1), last: last(100), step });
    expect(plan.dropSetIds).toEqual([]);
    expect(plan.workingSetCount).toBe(1);
  });

  it('repeat: last time’s weight and reps at the same position, all sets kept', () => {
    const plan = planWeekOverride({
      kind: 'repeat',
      planned: planned(3),
      last: last(70, 6),
      step,
    });
    expect(plan.dropSetIds).toEqual([]);
    expect(plan.workingSetCount).toBe(3);
    expect(plan.changes.map((c) => [c.weightKg, c.reps, c.repsInReserve])).toEqual([
      [70, 6, undefined],
      [70, 6, undefined],
      [70, 6, undefined],
    ]);
    expect(plan.changes[0].adjustment).toMatchObject({ cause: 'repeat', source: 'weekly_review' });
  });

  it('repeat: leaves a set with no counterpart, and an unchanged set unexplained', () => {
    const plan = planWeekOverride({
      kind: 'repeat',
      planned: planned(3),
      last: last(60, 8, 1),
      step,
    });
    expect(plan.changes.map((c) => c.setId)).toEqual(['s1']);
    expect(plan.changes[0].adjustment).toBeNull();
    expect(
      planWeekOverride({ kind: 'repeat', planned: planned(2), last: [], step }).changes
    ).toEqual([]);
  });
});

describe('applyWeekOverride', () => {
  it('returns the planned sets as the override leaves them: moved numbers, dropped sets gone', () => {
    const sets = planned(4);
    const plan = planWeekOverride({ kind: 'lighter', planned: sets, last: last(100), step });
    expect(applyWeekOverride(sets, plan)).toEqual([
      { id: 's1', weight: 90, reps: 8 },
      { id: 's2', weight: 90, reps: 8 },
      { id: 's3', weight: 90, reps: 8 },
    ]);
  });

  it('leaves a set without a change as planned', () => {
    const sets = planned(2);
    expect(applyWeekOverride(sets, { changes: [], dropSetIds: [] })).toEqual(sets);
  });
});

describe('planComebackOverride', () => {
  const ramp = (week: number, breakLength: '1to3m' | 'over6m' = '1to3m') =>
    workoutRamp({ breakLength }, week)!;

  it('week 1: scales the pre-break load, keeps the plan’s reps, caps the sets and aims for 4 RIR', () => {
    const plan = planComebackOverride({
      ramp: ramp(1),
      planned: planned(4, 100),
      base: last(100),
      earlier: [],
      step,
    });

    expect(plan.workingSetCount).toBe(2);
    expect(plan.dropSetIds).toEqual(['s3', 's4']);
    expect(plan.changes.map((c) => [c.setId, c.weightKg, c.reps, c.repsInReserve])).toEqual([
      ['s1', 80, 8, 4],
      ['s2', 80, 8, 4],
    ]);
    expect(plan.changes[0].adjustment).toMatchObject({
      cause: 'deload',
      source: 'comeback',
      comeback: { week: 1, percent: 80, targetRir: 4 },
      from: 100,
      to: 80,
    });
  });

  it('keeps one working set in week 1 for someone with little energy', () => {
    const plan = planComebackOverride({
      ramp: workoutRamp({ breakLength: '1to3m', energy: 'low' }, 1)!,
      planned: planned(3, 100),
      base: last(100),
      earlier: [],
      step,
    });

    expect(plan.workingSetCount).toBe(1);
  });

  it('week 4: the plan’s own set count, and never the full pre-break load', () => {
    const plan = planComebackOverride({
      ramp: ramp(4),
      planned: planned(4, 100),
      base: last(100, 8, 4),
      earlier: [],
      step,
    });

    expect(plan.dropSetIds).toEqual([]);
    expect(plan.workingSetCount).toBe(4);
    expect(plan.changes.every((c) => c.weightKg < 100)).toBe(true);
  });

  it('snaps a small load DOWN so an easing never rounds back up to the original', () => {
    const plan = planComebackOverride({
      ramp: ramp(2),
      planned: planned(2, 10),
      base: last(10),
      earlier: [],
      step,
    });

    expect(plan.changes[0].weightKg).toBeLessThan(10);
  });

  it('does not ease an exercise with no pre-break history: it caps sets and effort only', () => {
    const plan = planComebackOverride({
      ramp: ramp(1),
      planned: planned(3, 40),
      base: [],
      earlier: [],
      step,
    });

    expect(plan.changes.map((c) => c.weightKg)).toEqual([40, 40]);
    expect(plan.changes.every((c) => c.adjustment === null && c.repsInReserve === 4)).toBe(true);
    expect(plan.dropSetIds).toEqual(['s3']);
  });

  it('never goes below what was already lifted in an earlier session of this comeback', () => {
    const plan = planComebackOverride({
      ramp: ramp(1),
      planned: planned(2, 100),
      base: last(100),
      earlier: last(90),
      step,
    });

    expect(plan.changes.map((c) => c.weightKg)).toEqual([90, 90]);
  });

  it('lets the floor win when the person got stronger than the pre-break load', () => {
    const plan = planComebackOverride({
      ramp: ramp(2),
      planned: planned(2, 100),
      base: last(100),
      earlier: last(105),
      step,
    });

    expect(plan.changes.map((c) => c.weightKg)).toEqual([105, 105]);
  });

  it('a bodyweight exercise only loses sets: load and reps stay, no explanation is written', () => {
    const plan = planComebackOverride({
      ramp: ramp(1),
      planned: planned(3, 0, 10),
      base: last(0, 10),
      earlier: [],
      step,
    });

    expect(plan.dropSetIds).toEqual(['s3']);
    expect(plan.changes[0]).toMatchObject({ weightKg: 0, reps: 10, repsInReserve: 4 });
    expect(plan.changes[0].adjustment).toBeNull();
  });

  it('is applied by applyWeekOverride like any other plan', () => {
    const sets = planned(3, 100);
    const plan = planComebackOverride({
      ramp: ramp(1),
      planned: sets,
      base: last(100),
      earlier: [],
      step,
    });

    expect(applyWeekOverride(sets, plan)).toEqual([
      { id: 's1', weight: 80, reps: 8 },
      { id: 's2', weight: 80, reps: 8 },
    ]);
  });
});

describe('resolveStartOverride', () => {
  const comeback = workoutRamp({}, 1);

  it('lets an active comeback beat a Weekly Review decision', () => {
    expect(resolveStartOverride({ comeback, week: 'lighter' })).toEqual({
      kind: 'comeback',
      ramp: comeback,
    });
    expect(resolveStartOverride({ comeback, week: 'repeat' })?.kind).toBe('comeback');
  });

  it('falls back to the review’s week, or to nothing', () => {
    expect(resolveStartOverride({ comeback: null, week: 'lighter' })).toEqual({ kind: 'lighter' });
    expect(resolveStartOverride({ comeback: null, week: null })).toBeNull();
  });
});
