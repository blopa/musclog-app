import { planWeekOverride } from '@/utils/trainingWeekOverride';

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
