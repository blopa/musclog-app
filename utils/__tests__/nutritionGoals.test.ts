import { nutritionGoalToInitialValues, nutritionGoalsToInput } from '@/utils/nutritionGoals';

const goalRecord = {
  totalCalories: 2400,
  protein: 180,
  carbs: 250,
  fats: 70,
  fiber: 30,
  eatingPhase: 'bulking',
  targetWeight: 82,
  targetBodyFat: 15,
  targetBmi: 23,
  targetFfmi: 21,
  targetDate: 1_700_000_000_000,
  createdAt: 1_690_000_000_000,
  isDynamic: true,
} as any;

describe('nutritionGoalToInitialValues', () => {
  it('maps a stored goal onto the modal initial values', () => {
    expect(nutritionGoalToInitialValues(goalRecord)).toEqual({
      totalCalories: 2400,
      protein: 180,
      carbs: 250,
      fats: 70,
      fiber: 30,
      eatingPhase: 'bulking',
      targetWeight: 82,
      targetBodyFat: 15,
      targetBMI: 23,
      targetFFMI: 21,
      targetDate: 1_700_000_000_000,
      goalStartDate: 1_690_000_000_000,
      isDynamic: true,
    });
  });

  // The WatermelonDB model uses camelCase-from-snake_case (`target_bmi` -> `targetBmi`) while the
  // UI type uses the acronym casing. Getting this wrong silently drops the values from the form.
  it('renames the model’s targetBmi/targetFfmi to the UI’s targetBMI/targetFFMI', () => {
    const result = nutritionGoalToInitialValues(goalRecord);

    expect(result.targetBMI).toBe(23);
    expect(result.targetFFMI).toBe(21);
    expect(result).not.toHaveProperty('targetBmi');
    expect(result).not.toHaveProperty('targetFfmi');
  });

  // The record's createdAt is the goal's start date — dynamic goals interpolate from it, so it
  // must be carried into the form rather than re-derived.
  it('uses the record’s createdAt as the goal start date', () => {
    expect(nutritionGoalToInitialValues(goalRecord).goalStartDate).toBe(1_690_000_000_000);
  });

  it('normalizes a non-positive stored target weight to null', () => {
    expect(
      nutritionGoalToInitialValues({ ...goalRecord, targetWeight: 0 }).targetWeight
    ).toBeNull();
  });

  it('defaults a missing targetDate/isDynamic to null/false', () => {
    const result = nutritionGoalToInitialValues({
      ...goalRecord,
      targetDate: undefined,
      isDynamic: undefined,
    });

    expect(result.targetDate).toBeNull();
    expect(result.isDynamic).toBe(false);
  });
});

describe('nutritionGoalsToInput', () => {
  const formGoals = {
    totalCalories: 2200,
    protein: 160,
    carbs: 220,
    fats: 65,
    fiber: 28,
    eatingPhase: 'cutting',
    targetWeight: 78,
    targetBodyFat: 12,
    targetBMI: 22,
    targetFFMI: 20,
    targetDate: 1_710_000_000_000,
    goalStartDate: 1_700_000_000_000,
    isDynamic: true,
  } as any;

  it('maps the modal values onto the persistence input', () => {
    expect(nutritionGoalsToInput(formGoals)).toEqual({
      totalCalories: 2200,
      protein: 160,
      carbs: 220,
      fats: 65,
      fiber: 28,
      eatingPhase: 'cutting',
      targetWeight: 78,
      targetBodyFat: 12,
      targetBMI: 22,
      targetFFMI: 20,
      targetDate: 1_710_000_000_000,
      isDynamic: true,
    });
  });

  // goalStartDate is the record's createdAt, owned by the DB layer — echoing the form's copy back
  // on save would let an edit rewrite when the goal began.
  it('drops goalStartDate — the start date is the record’s createdAt, not a user-editable field', () => {
    expect(nutritionGoalsToInput(formGoals)).not.toHaveProperty('goalStartDate');
  });

  it('normalizes a non-positive target weight to null', () => {
    expect(nutritionGoalsToInput({ ...formGoals, targetWeight: 0 }).targetWeight).toBeNull();
    expect(nutritionGoalsToInput({ ...formGoals, targetWeight: -3 }).targetWeight).toBeNull();
  });

  // The DB columns are nullable; leaving them `undefined` would skip the column on update and
  // strand a previously-set target instead of clearing it.
  it('coerces every optional target from undefined to an explicit null', () => {
    const result = nutritionGoalsToInput({
      totalCalories: 2000,
      protein: 150,
      carbs: 200,
      fats: 60,
      fiber: 25,
      eatingPhase: 'maintenance',
      targetWeight: undefined,
    } as any);

    expect(result).toEqual({
      totalCalories: 2000,
      protein: 150,
      carbs: 200,
      fats: 60,
      fiber: 25,
      eatingPhase: 'maintenance',
      targetWeight: null,
      targetBodyFat: null,
      targetBMI: null,
      targetFFMI: null,
      targetDate: null,
      isDynamic: false,
    });
  });
});
