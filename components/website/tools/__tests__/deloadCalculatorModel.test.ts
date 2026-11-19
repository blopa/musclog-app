import { loadStepFor } from '@/utils/loadIncrement';
import { deloadedLoad } from '@/utils/setProgression';
import { LIGHTER_WEEK_TARGET_RIR, lighterSetCount } from '@/utils/weeklyTrainingRecommendation';

import {
  DELOAD_TARGET_RIR,
  DELOAD_WEEKS,
  planDeload,
  validateDeloadInput,
} from '../deloadCalculatorModel';

const options = (overrides = {}) => ({
  units: 'metric' as const,
  equipment: 'barbell' as const,
  gym: null,
  ...overrides,
});

describe('validateDeloadInput', () => {
  it('waits silently while a field is empty', () => {
    expect(validateDeloadInput('', '3', 'metric')).toEqual({ ok: false, problem: null });
    expect(validateDeloadInput('100', ' ', 'metric')).toEqual({ ok: false, problem: null });
  });

  it('reads a comma decimal', () => {
    expect(validateDeloadInput('62,5', '3', 'metric')).toEqual({
      ok: true,
      input: { weight: 62.5, sets: 3 },
    });
  });

  it.each([
    ['0', '3', 'weight'],
    ['abc', '3', 'weight'],
    ['1001', '3', 'weight'],
    ['100', '0', 'sets'],
    ['100', '2.5', 'sets'],
    ['100', '21', 'sets'],
  ])('flags %s kg x %s sets as a %s problem', (weight, sets, problem) => {
    expect(validateDeloadInput(weight, sets, 'metric')).toEqual({ ok: false, problem });
  });
});

describe('planDeload', () => {
  it("uses the app's own deload and lighter-week set count", () => {
    const plan = planDeload({ weight: 100, sets: 3 }, options());
    expect(plan.musclog.weight).toBe(deloadedLoad(100, loadStepFor('barbell', null, 'metric')));
    expect(plan.setsKept).toBe(lighterSetCount(3));
    expect(plan.setsKept + plan.setsDropped).toBe(3);
    expect(DELOAD_TARGET_RIR).toBe(LIGHTER_WEEK_TARGET_RIR);
    expect(DELOAD_WEEKS).toBe(1);
  });

  it('cuts a 100 kg barbell lift to 90 kg: 10% is larger than one 2.5 kg step', () => {
    const plan = planDeload({ weight: 100, sets: 3 }, options());
    expect(plan.musclog).toMatchObject({ weight: 90, actualCutPercent: 10 });
    expect(plan.lighter).toBe(true);
    expect(plan.setsKept).toBe(2);
  });

  it('is always strictly lighter, even for a light dumbbell where 10% rounds back up', () => {
    const plan = planDeload({ weight: 10, sets: 3 }, options({ equipment: 'dumbbell' }));
    expect(plan.musclog.weight).toBeLessThan(10);
    for (const row of plan.table) {
      expect(row.weight).toBeLessThan(10);
    }
  });

  it('lists the common cuts, each at least as deep as the one before', () => {
    const plan = planDeload({ weight: 140, sets: 4 }, options());
    expect(plan.table.map((row) => row.cutPercent)).toEqual([10, 15, 20]);
    const weights = plan.table.map((row) => row.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(plan.table[2].actualCutPercent).toBeGreaterThanOrEqual(20);
  });

  it('reports when nothing lighter exists', () => {
    const plan = planDeload({ weight: 2.5, sets: 3 }, options({ equipment: 'machine' }));
    expect(plan.lighter).toBe(false);
    expect(plan.musclog.weight).toBe(2.5);
  });

  it('keeps at least one set', () => {
    expect(planDeload({ weight: 100, sets: 1 }, options()).setsKept).toBe(1);
  });

  it('works in pounds and lists plates for a barbell only', () => {
    const plan = planDeload({ weight: 225, sets: 3 }, options({ units: 'imperial' }));
    expect(plan.musclog.weight).toBeLessThan(225);
    expect(plan.musclog.weight).toBeGreaterThanOrEqual(200);
    expect(plan.musclog.perSide).not.toBeNull();
    expect(
      planDeload({ weight: 225, sets: 3 }, options({ units: 'imperial', equipment: 'machine' }))
        .musclog.perSide
    ).toBeNull();
  });
});
