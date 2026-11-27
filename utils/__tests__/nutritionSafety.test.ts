import { calculateNutritionPlan } from '@/utils/nutritionCalculator';
import { goalSafetyWarnings } from '@/utils/nutritionSafety';

const base = {
  calories: 2000,
  gender: 'female' as const,
  isCut: false,
  weightKg: 65,
  heightM: 1.7,
};

describe('goalSafetyWarnings', () => {
  it('says nothing about an ordinary goal', () => {
    expect(goalSafetyWarnings(base)).toEqual([]);
  });

  it('warns about a goal below the minimum typed by hand', () => {
    expect(goalSafetyWarnings({ ...base, calories: 300 })).toEqual(['belowMinimum']);
    expect(goalSafetyWarnings({ ...base, calories: 1200 })).toEqual([]);
    expect(goalSafetyWarnings({ ...base, calories: 1400, gender: 'male' })).toEqual([
      'belowMinimum',
    ]);
  });

  it('warns about cutting while underweight', () => {
    expect(goalSafetyWarnings({ ...base, isCut: true, weightKg: 50 })).toEqual(['underweightCut']);
    expect(goalSafetyWarnings({ ...base, isCut: false, weightKg: 50 })).toEqual([]);
  });

  it('warns about a target weight in the underweight range', () => {
    expect(goalSafetyWarnings({ ...base, isCut: true, targetWeightKg: 50 })).toEqual([
      'goalUnderweight',
    ]);
  });

  it('says nothing about weight when height or weight is unknown', () => {
    expect(goalSafetyWarnings({ ...base, isCut: true, weightKg: null })).toEqual([]);
    expect(goalSafetyWarnings({ ...base, isCut: true, heightM: null, weightKg: 40 })).toEqual([]);
  });
});

describe('calculateNutritionPlan for an underweight person', () => {
  const input = {
    gender: 'female' as const,
    heightCm: 175,
    age: 25,
    activityLevel: 2 as const,
    fitnessGoal: 'general' as const,
    liftingExperience: 'beginner' as const,
  };

  it('plans maintenance instead of a deficit', () => {
    const lose = calculateNutritionPlan({ ...input, weightKg: 52, weightGoal: 'lose' });
    const maintain = calculateNutritionPlan({ ...input, weightKg: 52, weightGoal: 'maintain' });

    expect(lose.targetCalories).toBe(maintain.targetCalories);
  });

  it('still plans a deficit above the underweight range', () => {
    const lose = calculateNutritionPlan({ ...input, weightKg: 80, weightGoal: 'lose' });
    const maintain = calculateNutritionPlan({ ...input, weightKg: 80, weightGoal: 'maintain' });

    expect(lose.targetCalories).toBeLessThan(maintain.targetCalories);
  });
});
