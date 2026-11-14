import { defaultGymSnapshot } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';
import { displayToKg } from '@/utils/unitConversion';
import { buildWarmupSets } from '@/utils/warmupSets';

import { MAX_WORKING_WEIGHT, planWarmups, validateWorkingWeight } from '../warmUpCalculatorModel';

describe('validateWorkingWeight', () => {
  it('waits silently while the field is empty', () => {
    expect(validateWorkingWeight('', 'metric')).toEqual({ ok: false, problem: null });
  });

  it('reads a comma decimal and refuses zero, text and anything above the cap', () => {
    expect(validateWorkingWeight('97,5', 'metric')).toEqual({ ok: true, working: 97.5 });
    expect(validateWorkingWeight('0', 'metric')).toEqual({ ok: false, problem: 'working' });
    expect(validateWorkingWeight('ten', 'metric')).toEqual({ ok: false, problem: 'working' });
    expect(validateWorkingWeight(String(MAX_WORKING_WEIGHT.metric + 1), 'metric')).toEqual({
      ok: false,
      problem: 'working',
    });
  });
});

describe('planWarmups', () => {
  it('builds the same ramp as the app for a 100 kg barbell with the default gym', () => {
    const gym = defaultGymSnapshot('metric');
    const plan = planWarmups(100, 'metric', 'barbell', gym);
    const app = buildWarmupSets(100, { gym, equipmentType: 'barbell', units: 'metric' });

    expect(plan.sets.map(({ weightKg, reps }) => ({ weightKg, reps }))).toEqual(
      app.map(({ weightKg, reps }) => ({ weightKg, reps }))
    );
    expect(plan.reason).toBeNull();
    expect(plan.working.weight).toBe(100);
  });

  it('makes every barbell warm-up loadable: its weight is the bar plus both sides', () => {
    const gym = defaultGymSnapshot('metric');
    const plan = planWarmups(100, 'metric', 'barbell', gym);

    for (const set of plan.sets) {
      const load = platesPerSide(set.weightKg, gym);
      const perSide = load.platesPerSide.reduce((sum, p) => sum + p.weightKg * p.count, 0);
      expect(set.weightKg).toBeCloseTo(gym.barWeightKg + 2 * perSide, 4);
      expect(set.perSide).not.toBeNull();
    }
  });

  it('gives an empty result, with the bar as the reason, for a weight near the bar', () => {
    const plan = planWarmups(22, 'metric', 'barbell', defaultGymSnapshot('metric'));

    expect(plan.sets).toEqual([]);
    expect(plan.reason).toBe('barIsWarmUp');
  });

  it('uses imperial pounds on a 45 lb bar', () => {
    const gym = defaultGymSnapshot('imperial');
    const plan = planWarmups(225, 'imperial', 'barbell', gym);

    expect(plan.barWeight).toBe(45);
    expect(plan.sets[0].weight).toBe(45);
    expect(plan.sets[0].reps).toBe(10);
    expect(plan.working.weight).toBe(225);
    expect(plan.working.weightKg).toBeCloseTo(displayToKg(225, 'imperial'), 6);
  });

  it('uses no bar or plates for a dumbbell', () => {
    const plan = planWarmups(30, 'metric', 'dumbbell', null);

    expect(plan.sets.length).toBeGreaterThan(0);
    expect(plan.sets.every((set) => set.perSide === null)).toBe(true);
    expect(plan.sets.every((set) => set.reps !== null)).toBe(true);
    expect(plan.sets[0].weightKg).toBeLessThan(30);
  });
});
