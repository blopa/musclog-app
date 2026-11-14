import {
  calculateBMR,
  calculateTDEE,
  getEffectiveKcalPerKgGoalChange,
  getMinCalories,
} from '@/utils/nutritionCalculator';

import {
  addIsoDays,
  CALORIE_ACTIVITY_LEVELS,
  calorieDeficitPlan,
  type CalorieDeficitInput,
  parseIsoDay,
} from '../calorieDeficitModel';

const TODAY = '2026-11-14';

const base: CalorieDeficitInput = {
  units: 'metric',
  sex: 'male',
  ageText: '30',
  heightText: '180',
  weightText: '90',
  activityLevel: 3,
  goalWeightText: '85',
  goalDate: '2027-01-14',
  today: TODAY,
};

function planOf(overrides: Partial<CalorieDeficitInput>) {
  const result = calorieDeficitPlan({ ...base, ...overrides });
  if (!result.ok) {
    throw new Error(`expected a plan, got problem ${String(result.problem)}`);
  }
  return result.plan;
}

describe('calorieDeficitPlan', () => {
  it('waits silently while a required field is empty', () => {
    expect(calorieDeficitPlan({ ...base, ageText: '' })).toEqual({ ok: false, problem: null });
    expect(calorieDeficitPlan({ ...base, goalDate: '' })).toEqual({ ok: false, problem: null });
  });

  it('counts calendar days to the goal date', () => {
    expect(planOf({}).days).toBe(61);
    expect(addIsoDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(parseIsoDay('2026-02-30')).toBeNull();
  });

  it("uses the app's TDEE, floor and kcal-per-kg for the deficit", () => {
    const plan = planOf({});
    const bmr = calculateBMR('male', 90, 180, 30);
    const tdee = calculateTDEE({ bmr, activityLevel: 3 });
    const kcalPerKg = getEffectiveKcalPerKgGoalChange('lose', 90, 85, undefined, 'male');
    expect(plan.bmr).toBe(bmr);
    expect(plan.tdee).toBe(tdee);
    expect(plan.minCalories).toBe(getMinCalories('male', bmr));
    expect(plan.kcalPerKg).toBe(kcalPerKg);
    expect(plan.requiredDailyChange).toBeCloseTo((kcalPerKg! * 5) / 61, 6);
    expect(plan.target).toBeCloseTo(tdee - (kcalPerKg! * 5) / 61, 6);
    expect(plan.clamped).toBe(false);
    expect(plan.laterDate).toBeNull();
  });

  it('gives the target as a range of plus or minus 10% of TDEE around it', () => {
    const plan = planOf({});
    expect(plan.rangeHigh - plan.rangeLow).toBeCloseTo(0.2 * plan.tdee, 6);
    expect(plan.target - plan.rangeLow).toBeCloseTo(0.1 * plan.tdee, 6);
    expect(plan.rangeHigh - plan.target).toBeCloseTo(0.1 * plan.tdee, 6);
  });

  it('moves a target below the floor up to it and gives the later date the floor allows', () => {
    const plan = planOf({
      sex: 'female',
      ageText: '50',
      heightText: '165',
      weightText: '70',
      activityLevel: 1,
      goalWeightText: '50',
      goalDate: '2026-12-14',
    });
    expect(plan.clamped).toBe(true);
    expect(plan.target).toBe(plan.minCalories);
    expect(plan.warnings).toContain('floorApplied');
    expect(plan.laterDays).not.toBeNull();
    expect(plan.laterDays!).toBeGreaterThan(30);
    expect(plan.laterDate).toBe(addIsoDays(TODAY, plan.laterDays!));
    const achievable = plan.tdee - plan.minCalories;
    expect(plan.laterDays!).toBe(Math.ceil((plan.kcalPerKg * 20) / achievable));
  });

  it('gives a surplus when the goal is above the current weight', () => {
    const plan = planOf({ weightText: '70', goalWeightText: '75', goalDate: '2027-02-12' });
    expect(plan.direction).toBe('gain');
    expect(plan.target).toBeGreaterThan(plan.tdee);
    expect(plan.clamped).toBe(false);
    expect(plan.warnings).toEqual([]);
  });

  it('flags a pace above 1% of body weight per week and a deficit above 25% of TDEE', () => {
    const plan = planOf({ weightText: '90', goalWeightText: '60', goalDate: '2026-12-14' });
    expect(plan.warnings).toEqual(expect.arrayContaining(['paceTooFast', 'deficitTooLarge']));
    expect(plan.weeklyChangeKg).toBeLessThan(0);
  });

  it('reports no change needed when the goal weight is the current weight', () => {
    const plan = planOf({ goalWeightText: '90' });
    expect(plan.direction).toBe('none');
    expect(plan.warnings).toEqual(['noChange']);
    expect(plan.target).toBe(plan.tdee);
  });

  it('converts imperial input to the same metric figures', () => {
    const metric = planOf({ weightText: '70', goalWeightText: '65', heightText: '180' });
    const imperial = planOf({
      units: 'imperial',
      weightText: '154.3236',
      goalWeightText: '143.3',
      heightText: '70.866',
    });
    expect(imperial.bmr).toBe(metric.bmr);
    expect(imperial.tdee).toBe(metric.tdee);
  });

  it('refuses a goal date that is today or in the past', () => {
    expect(calorieDeficitPlan({ ...base, goalDate: TODAY })).toEqual({
      ok: false,
      problem: 'goalDateNotFuture',
    });
    expect(calorieDeficitPlan({ ...base, goalDate: '2026-01-01' })).toEqual({
      ok: false,
      problem: 'goalDateNotFuture',
    });
    expect(calorieDeficitPlan({ ...base, goalDate: '2026-02-31' })).toEqual({
      ok: false,
      problem: 'goalDate',
    });
  });

  it('refuses values outside the ranges the page accepts', () => {
    expect(calorieDeficitPlan({ ...base, ageText: '10' })).toEqual({ ok: false, problem: 'age' });
    expect(calorieDeficitPlan({ ...base, heightText: '50' })).toEqual({
      ok: false,
      problem: 'height',
    });
    expect(calorieDeficitPlan({ ...base, weightText: '20' })).toEqual({
      ok: false,
      problem: 'weight',
    });
    expect(calorieDeficitPlan({ ...base, goalWeightText: '5' })).toEqual({
      ok: false,
      problem: 'goalWeight',
    });
  });

  it('accepts every activity level the app multiplies', () => {
    expect([...CALORIE_ACTIVITY_LEVELS]).toEqual([1, 2, 3, 4, 5]);
  });
});
