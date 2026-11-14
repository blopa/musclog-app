import { bodyweightProtein, PROTEIN_G_PER_KG_BODYWEIGHT } from '@/utils/nutritionCalculator';

import { PROTEIN_GOALS, proteinPlan, type ProteinInput } from '../proteinCalculatorModel';

const base: ProteinInput = {
  units: 'metric',
  weightText: '80',
  heightText: '180',
  goal: 'general',
  deficit: false,
  goalWeightText: '',
};

function planOf(overrides: Partial<ProteinInput>) {
  const result = proteinPlan({ ...base, ...overrides });
  if (!result.ok) {
    throw new Error(`expected a plan, got problem ${String(result.problem)}`);
  }
  return result.plan;
}

describe('proteinPlan', () => {
  it('waits silently while weight or height is empty', () => {
    expect(proteinPlan({ ...base, weightText: '' })).toEqual({ ok: false, problem: null });
    expect(proteinPlan({ ...base, heightText: ' ' })).toEqual({ ok: false, problem: null });
  });

  it.each(['hypertrophy', 'strength', 'general', 'endurance', 'weight_loss'] as const)(
    'gives the app own bodyweightProtein result for %s',
    (goal) => {
      const plan = planOf({ goal, weightText: '70', heightText: '175' });
      const expected = bodyweightProtein(goal, 70, {
        heightCm: 175,
        weightGoal: goal === 'weight_loss' ? 'lose' : 'maintain',
      });
      expect(plan.grams).toBe(expected.grams);
      expect(plan.gramsPerKg).toBe(expected.gramsPerKg);
    }
  );

  it('lists every goal straight from the app table', () => {
    const plan = planOf({});
    expect(plan.table.map((row) => row.goal)).toEqual([...PROTEIN_GOALS]);
    for (const row of plan.table) {
      expect(row.gramsPerKg).toBe(PROTEIN_G_PER_KG_BODYWEIGHT[row.goal]);
    }
  });

  it('caps the reference weight at BMI 30 for the height (140 kg at 175 cm)', () => {
    const plan = planOf({ weightText: '140', heightText: '175' });
    expect(plan.referenceWeightKg).toBeCloseTo(30 * 1.75 * 1.75, 6);
    expect(plan.capped).toBe(true);
    expect(plan.grams).toBe(Math.round(30 * 1.75 * 1.75 * 1.6));
  });

  it('does not cap a weight under the reference', () => {
    const plan = planOf({ weightText: '70', heightText: '175' });
    expect(plan.capped).toBe(false);
    expect(plan.referenceWeightKg).toBe(70);
  });

  it('applies a goal weight instead of the capped current weight, and says it was not capped', () => {
    const plan = planOf({ weightText: '140', heightText: '175', goalWeightText: '85' });
    expect(plan.referenceWeightKg).toBe(85);
    expect(plan.capped).toBe(false);
  });

  it('raises a goal below 2.0 g/kg to 2.0 when eating in a deficit', () => {
    const plan = planOf({ goal: 'general', deficit: true });
    expect(plan.gramsPerKg).toBe(2);
    expect(plan.raisedByDeficit).toBe(true);
  });

  it('raises endurance (1.4 g/kg) to the same 2.0 minimum in a deficit', () => {
    const plan = planOf({ goal: 'endurance', deficit: true });
    expect(plan.gramsPerKg).toBe(2);
    expect(plan.raisedByDeficit).toBe(true);
  });

  it('does not report a deficit raise when maintaining', () => {
    expect(planOf({ goal: 'general', deficit: false }).raisedByDeficit).toBe(false);
  });

  it('converts imperial input: 176 lb and 5 ft 11 in match the metric result', () => {
    const imperial = planOf({ units: 'imperial', weightText: '176.37', heightText: '69.685' });
    const metric = planOf({ units: 'metric', weightText: '80', heightText: '177' });
    expect(imperial.weightKg).toBeCloseTo(80, 1);
    expect(imperial.grams).toBe(metric.grams);
  });

  it('refuses a weight outside the range the calculator accepts', () => {
    expect(proteinPlan({ ...base, weightText: '0' })).toEqual({ ok: false, problem: 'weight' });
    expect(proteinPlan({ ...base, weightText: 'abc' })).toEqual({ ok: false, problem: 'weight' });
    expect(proteinPlan({ ...base, weightText: '500' })).toEqual({ ok: false, problem: 'weight' });
  });

  it('refuses a height outside the range', () => {
    expect(proteinPlan({ ...base, heightText: '50' })).toEqual({ ok: false, problem: 'height' });
    expect(proteinPlan({ ...base, heightText: '300' })).toEqual({ ok: false, problem: 'height' });
  });

  it('refuses a goal weight that is typed but not usable, and ignores an empty one', () => {
    expect(proteinPlan({ ...base, goalWeightText: 'x' })).toEqual({
      ok: false,
      problem: 'goalWeight',
    });
    expect(proteinPlan({ ...base, goalWeightText: '5' })).toEqual({
      ok: false,
      problem: 'goalWeight',
    });
    expect(proteinPlan({ ...base, goalWeightText: '' }).ok).toBe(true);
  });
});
