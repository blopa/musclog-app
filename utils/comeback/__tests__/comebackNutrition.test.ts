import {
  COMEBACK_DEFICIT_GENTLE_KCAL,
  COMEBACK_DEFICIT_PLENTY_KCAL,
  comebackChangesTargets,
  comebackDeficitKcal,
  computeComebackTargets,
  nutritionStage,
  type ComebackNutritionProfile,
} from '@/utils/comeback/comebackNutrition';

const profile: ComebackNutritionProfile = {
  gender: 'male',
  weightKg: 82,
  heightCm: 180,
  age: 34,
  activityLevel: 3,
  liftingExperience: 'intermediate',
  fitnessGoal: 'general',
};

describe('nutritionStage', () => {
  it('is maintenance for everyone before the week-2 check-in', () => {
    expect(nutritionStage({ nutritionGoal: 'loseSlowly' }, 1)).toBe('maintenance');
  });

  it('only offers a deficit to someone who asked to lose fat', () => {
    expect(nutritionStage({ nutritionGoal: 'loseSlowly' }, 2)).toBe('deficitOffer');
    expect(nutritionStage({ nutritionGoal: 'regular' }, 3)).toBe('maintenance');
    expect(nutritionStage({ nutritionGoal: 'rebuild' }, 3)).toBe('maintenance');
    expect(nutritionStage({}, 3)).toBe('maintenance');
  });
});

describe('comebackDeficitKcal', () => {
  it('is gentle unless energy is plentiful', () => {
    expect(comebackDeficitKcal({ energy: 'plenty' })).toBe(COMEBACK_DEFICIT_PLENTY_KCAL);
    expect(comebackDeficitKcal({ energy: 'some' })).toBe(COMEBACK_DEFICIT_GENTLE_KCAL);
    expect(comebackDeficitKcal({ energy: 'low' })).toBe(COMEBACK_DEFICIT_GENTLE_KCAL);
    expect(comebackDeficitKcal({})).toBe(COMEBACK_DEFICIT_GENTLE_KCAL);
  });
});

describe('computeComebackTargets', () => {
  it('writes nothing when the person keeps their current targets', () => {
    expect(comebackChangesTargets({ nutritionGoal: 'keep' })).toBe(false);
    expect(
      computeComebackTargets(profile, { nutritionGoal: 'keep' }, { applyDeficit: true })
    ).toBeNull();
  });

  it('starts at maintenance even when fat loss was asked for', () => {
    const targets = computeComebackTargets(
      profile,
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: false }
    );

    expect(targets).not.toBeNull();
    expect(targets!.deficitCalories).toBe(0);
    expect(targets!.totalCalories).toBe(targets!.maintenanceCalories);
    expect(targets!.stage).toBe('maintenance');
  });

  it('takes the chosen deficit once it is applied', () => {
    const maintenance = computeComebackTargets(
      profile,
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: false }
    )!;
    const deficit = computeComebackTargets(
      profile,
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: true }
    )!;

    expect(deficit.maintenanceCalories).toBe(maintenance.maintenanceCalories);
    expect(deficit.deficitCalories).toBe(COMEBACK_DEFICIT_PLENTY_KCAL);
    expect(deficit.stage).toBe('deficitOffer');
  });

  it('never applies a deficit to someone who did not ask for fat loss', () => {
    const targets = computeComebackTargets(
      profile,
      { nutritionGoal: 'regular' },
      { applyDeficit: true }
    )!;

    expect(targets.deficitCalories).toBe(0);
  });

  it('does not push calories under the floor', () => {
    const small: ComebackNutritionProfile = {
      ...profile,
      gender: 'female',
      weightKg: 48,
      heightCm: 152,
      age: 60,
      activityLevel: 1,
    };
    const maintenance = computeComebackTargets(
      small,
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: false }
    )!;
    const deficit = computeComebackTargets(
      small,
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: true }
    )!;

    expect(deficit.totalCalories).toBeLessThanOrEqual(maintenance.totalCalories);
    expect(deficit.totalCalories).toBeGreaterThanOrEqual(Math.min(maintenance.totalCalories, 1200));
  });

  it('keeps protein first: a deficit never lowers protein below the maintenance figure', () => {
    const answers = { nutritionGoal: 'loseSlowly' as const, energy: 'plenty' as const };
    const maintenance = computeComebackTargets(profile, answers, { applyDeficit: false })!;
    const deficit = computeComebackTargets(profile, answers, { applyDeficit: true })!;

    expect(deficit.protein).toBeGreaterThanOrEqual(maintenance.protein);
  });

  it('adds up: protein, carbs and fats stay within the calorie target', () => {
    const targets = computeComebackTargets(
      profile,
      { nutritionGoal: 'rebuild' },
      { applyDeficit: false }
    )!;
    const kcal = targets.protein * 4 + targets.carbs * 4 + targets.fats * 9;

    expect(Math.abs(kcal - targets.totalCalories)).toBeLessThan(40);
    expect(targets.fiber).toBeGreaterThanOrEqual(25);
  });
});
