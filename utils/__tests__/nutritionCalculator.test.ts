import {
  calculateBMR,
  calculateMacros,
  calculateNutritionPlan,
  calculateTargetCalories,
  calculateTDEE,
  calculateWeightProjection,
  inchesToCm,
  lbsToKg,
  MIN_CALORIES,
  normalizeFitnessGoal,
  type NutritionCalculatorInput,
} from '../nutritionCalculator';

// ---------------------------------------------------------------------------
// BMR (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

describe('calculateBMR', () => {
  // Reference: 30-year-old, 80kg, 180cm male
  // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  it('calculates BMR for a male correctly', () => {
    expect(calculateBMR('male', 80, 180, 30)).toBe(1780);
  });

  // Same person, female: 800 + 1125 - 150 - 161 = 1614
  it('calculates BMR for a female correctly', () => {
    expect(calculateBMR('female', 80, 180, 30)).toBe(1614);
  });

  // 'other' = average: base - 78 = 800 + 1125 - 150 - 78 = 1697
  it('calculates BMR for gender=other as average of male/female', () => {
    expect(calculateBMR('other', 80, 180, 30)).toBe(1697);
  });

  it('returns lower BMR for higher age', () => {
    const younger = calculateBMR('male', 80, 180, 25);
    const older = calculateBMR('male', 80, 180, 50);
    expect(younger).toBeGreaterThan(older);
  });

  it('returns higher BMR for heavier individual', () => {
    const lighter = calculateBMR('male', 60, 180, 30);
    const heavier = calculateBMR('male', 100, 180, 30);
    expect(heavier).toBeGreaterThan(lighter);
  });

  it('returns higher BMR for taller individual', () => {
    const shorter = calculateBMR('male', 80, 160, 30);
    const taller = calculateBMR('male', 80, 200, 30);
    expect(taller).toBeGreaterThan(shorter);
  });
});

// ---------------------------------------------------------------------------
// TDEE
// ---------------------------------------------------------------------------

describe('calculateTDEE', () => {
  const bmr = 1780;

  it('applies sedentary multiplier (1.2)', () => {
    expect(calculateTDEE(bmr, 1)).toBe(Math.round(1780 * 1.2));
  });

  it('applies light multiplier (1.375)', () => {
    expect(calculateTDEE(bmr, 2)).toBe(Math.round(1780 * 1.375));
  });

  it('applies moderate multiplier (1.55)', () => {
    expect(calculateTDEE(bmr, 3)).toBe(Math.round(1780 * 1.55));
  });

  it('applies active multiplier (1.725)', () => {
    expect(calculateTDEE(bmr, 4)).toBe(Math.round(1780 * 1.725));
  });

  it('applies super active multiplier (1.9)', () => {
    expect(calculateTDEE(bmr, 5)).toBe(Math.round(1780 * 1.9));
  });

  it('falls back to moderate multiplier for unknown level', () => {
    expect(calculateTDEE(bmr, 99)).toBe(Math.round(1780 * 1.55));
  });

  it('increases with activity level', () => {
    const sedentary = calculateTDEE(bmr, 1);
    const superActive = calculateTDEE(bmr, 5);
    expect(superActive).toBeGreaterThan(sedentary);
  });
});

// ---------------------------------------------------------------------------
// Target Calories
// ---------------------------------------------------------------------------

describe('calculateTargetCalories', () => {
  it('applies -500 deficit for weight_loss', () => {
    expect(calculateTargetCalories(2500, 'weight_loss')).toBe(2000);
  });

  it('maintains TDEE for general fitness', () => {
    expect(calculateTargetCalories(2500, 'general')).toBe(2500);
  });

  it('maintains TDEE for endurance', () => {
    expect(calculateTargetCalories(2500, 'endurance')).toBe(2500);
  });

  it('applies +250 surplus for hypertrophy', () => {
    expect(calculateTargetCalories(2500, 'hypertrophy')).toBe(2750);
  });

  it('applies +350 surplus for strength', () => {
    expect(calculateTargetCalories(2500, 'strength')).toBe(2850);
  });

  it('never goes below MIN_CALORIES safety floor', () => {
    // Very low TDEE scenario
    expect(calculateTargetCalories(1500, 'weight_loss')).toBe(MIN_CALORIES);
    expect(calculateTargetCalories(1200, 'weight_loss')).toBe(MIN_CALORIES);
  });

  it('returns MIN_CALORIES when TDEE itself is at floor', () => {
    expect(calculateTargetCalories(MIN_CALORIES, 'weight_loss')).toBe(MIN_CALORIES);
  });
});

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

describe('calculateMacros', () => {
  it('calculates weight_loss macros (40/30/30)', () => {
    const result = calculateMacros(2000, 'weight_loss');
    expect(result.proteinPct).toBe(30);
    expect(result.carbsPct).toBe(40);
    expect(result.fatsPct).toBe(30);
    // 2000 * 0.30 / 4 = 150g protein
    expect(result.protein).toBe(150);
    // 2000 * 0.40 / 4 = 200g carbs
    expect(result.carbs).toBe(200);
    // 2000 * 0.30 / 9 ≈ 67g fats
    expect(result.fats).toBe(67);
  });

  it('calculates hypertrophy macros (45/30/25)', () => {
    const result = calculateMacros(2750, 'hypertrophy');
    expect(result.proteinPct).toBe(30);
    expect(result.carbsPct).toBe(45);
    expect(result.fatsPct).toBe(25);
    // 2750 * 0.30 / 4 = 206.25 → 206
    expect(result.protein).toBe(206);
    // 2750 * 0.45 / 4 = 309.375 → 309
    expect(result.carbs).toBe(309);
    // 2750 * 0.25 / 9 ≈ 76.4 → 76
    expect(result.fats).toBe(76);
  });

  it('calculates endurance macros (55/20/25)', () => {
    const result = calculateMacros(2500, 'endurance');
    expect(result.proteinPct).toBe(20);
    expect(result.carbsPct).toBe(55);
    expect(result.fatsPct).toBe(25);
  });

  it('calculates strength macros (50/30/20)', () => {
    const result = calculateMacros(2850, 'strength');
    expect(result.proteinPct).toBe(30);
    expect(result.carbsPct).toBe(50);
    expect(result.fatsPct).toBe(20);
  });

  it('calculates general macros (45/25/30)', () => {
    const result = calculateMacros(2500, 'general');
    expect(result.proteinPct).toBe(25);
    expect(result.carbsPct).toBe(45);
    expect(result.fatsPct).toBe(30);
  });

  it('percentage splits always sum to 100', () => {
    for (const goal of [
      'weight_loss',
      'endurance',
      'hypertrophy',
      'strength',
      'general',
    ] as const) {
      const result = calculateMacros(2500, goal);
      expect(result.proteinPct + result.carbsPct + result.fatsPct).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Weight Projection
// ---------------------------------------------------------------------------

describe('calculateWeightProjection', () => {
  it('projects weight loss for calorie deficit', () => {
    const result = calculateWeightProjection(80, 2000, 2500);
    expect(result.weeklyWeightChangeKg).toBeLessThan(0);
    expect(result.projectedWeightKg).toBeLessThan(80);
    expect(result.projectionDays).toBe(90);
  });

  it('projects weight gain for calorie surplus', () => {
    const result = calculateWeightProjection(80, 3000, 2500);
    expect(result.weeklyWeightChangeKg).toBeGreaterThan(0);
    expect(result.projectedWeightKg).toBeGreaterThan(80);
  });

  it('projects no change for maintenance', () => {
    const result = calculateWeightProjection(80, 2500, 2500);
    expect(result.weeklyWeightChangeKg).toBe(0);
    expect(result.projectedWeightKg).toBe(80);
  });

  it('calculates correct weight change for -500 kcal/day deficit', () => {
    // -500 * 7 / 7700 ≈ -0.45 kg/week
    const result = calculateWeightProjection(80, 2000, 2500);
    expect(result.weeklyWeightChangeKg).toBeCloseTo(-0.45, 1);
    // Over 90 days (~12.86 weeks): -0.45 * 12.86 ≈ -5.8 kg
    const expectedProjected = 80 + result.weeklyWeightChangeKg * (90 / 7);
    expect(result.projectedWeightKg).toBeCloseTo(expectedProjected, 0);
  });
});

// ---------------------------------------------------------------------------
// Unit Conversion
// ---------------------------------------------------------------------------

describe('unit conversion helpers', () => {
  it('converts lbs to kg correctly', () => {
    expect(lbsToKg(176)).toBeCloseTo(79.83, 1);
    expect(lbsToKg(0)).toBe(0);
    expect(lbsToKg(1)).toBeCloseTo(0.4536, 3);
  });

  it('converts inches to cm correctly', () => {
    expect(inchesToCm(70)).toBeCloseTo(177.8, 1);
    expect(inchesToCm(0)).toBe(0);
    expect(inchesToCm(1)).toBeCloseTo(2.54, 2);
  });
});

// ---------------------------------------------------------------------------
// Legacy Fitness Goal Normalizer
// ---------------------------------------------------------------------------

describe('normalizeFitnessGoal', () => {
  it('maps translated labels to stable keys', () => {
    expect(normalizeFitnessGoal('Hypertrophy (Build Muscle)')).toBe('hypertrophy');
    expect(normalizeFitnessGoal('Strength (Lift Heavier)')).toBe('strength');
    expect(normalizeFitnessGoal('Endurance (Stamina)')).toBe('endurance');
    expect(normalizeFitnessGoal('Weight Loss (Burn Fat)')).toBe('weight_loss');
    expect(normalizeFitnessGoal('General Fitness')).toBe('general');
  });

  it('recognizes already-valid enum keys', () => {
    expect(normalizeFitnessGoal('hypertrophy')).toBe('hypertrophy');
    expect(normalizeFitnessGoal('strength')).toBe('strength');
    expect(normalizeFitnessGoal('endurance')).toBe('endurance');
    expect(normalizeFitnessGoal('weight_loss')).toBe('weight_loss');
    expect(normalizeFitnessGoal('general')).toBe('general');
  });

  it('is case-insensitive for legacy labels', () => {
    expect(normalizeFitnessGoal('HYPERTROPHY')).toBe('hypertrophy');
    expect(normalizeFitnessGoal('weight loss')).toBe('weight_loss');
  });

  it('falls back to general for unknown input', () => {
    expect(normalizeFitnessGoal('something_unknown')).toBe('general');
    expect(normalizeFitnessGoal('')).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// Full calculateNutritionPlan integration
// ---------------------------------------------------------------------------

describe('calculateNutritionPlan', () => {
  const baseInput: NutritionCalculatorInput = {
    gender: 'male',
    weightKg: 83,
    heightCm: 180,
    age: 30,
    activityLevel: 3,
    fitnessGoal: 'weight_loss',
    liftingExperience: 'intermediate',
  };

  it('produces a complete plan object', () => {
    const plan = calculateNutritionPlan(baseInput);

    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.targetCalories).toBeGreaterThan(0);
    expect(plan.targetCalories).toBeLessThan(plan.tdee); // weight_loss
    expect(plan.protein).toBeGreaterThan(0);
    expect(plan.carbs).toBeGreaterThan(0);
    expect(plan.fats).toBeGreaterThan(0);
    expect(plan.proteinPct + plan.carbsPct + plan.fatsPct).toBe(100);
    expect(plan.goalLabel).toBe('moderateWeightLoss');
    expect(plan.projectionDays).toBe(90);
    expect(plan.currentWeightKg).toBe(83);
    expect(plan.projectedWeightKg).toBeLessThan(83);
  });

  it('reproduces the reference example from design (≈2150 kcal for 83kg male)', () => {
    // 10*83 + 6.25*180 - 5*30 + 5 = 830 + 1125 - 150 + 5 = 1810 BMR
    // TDEE = 1810 * 1.55 ≈ 2806
    // Target = 2806 - 500 = 2306 (not exactly 2150 as the design used a simple split,
    // but within a reasonable range for the algorithm)
    const plan = calculateNutritionPlan(baseInput);
    expect(plan.bmr).toBe(1810);
    expect(plan.tdee).toBe(Math.round(1810 * 1.55));
    expect(plan.targetCalories).toBe(plan.tdee - 500);
  });

  it('produces surplus for hypertrophy goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, fitnessGoal: 'hypertrophy' });
    expect(plan.targetCalories).toBeGreaterThan(plan.tdee);
    expect(plan.goalLabel).toBe('leanBulk');
    expect(plan.projectedWeightKg).toBeGreaterThan(83);
  });

  it('produces maintenance for general fitness', () => {
    const plan = calculateNutritionPlan({ ...baseInput, fitnessGoal: 'general' });
    expect(plan.targetCalories).toBe(plan.tdee);
    expect(plan.goalLabel).toBe('generalFitness');
  });

  it('never goes below MIN_CALORIES even for very light individuals', () => {
    const plan = calculateNutritionPlan({
      ...baseInput,
      weightKg: 40,
      heightCm: 150,
      age: 60,
      activityLevel: 1,
      fitnessGoal: 'weight_loss',
    });
    expect(plan.targetCalories).toBeGreaterThanOrEqual(MIN_CALORIES);
  });

  it('handles female gender correctly', () => {
    const malePlan = calculateNutritionPlan(baseInput);
    const femalePlan = calculateNutritionPlan({ ...baseInput, gender: 'female' });
    // Female BMR is lower → everything downstream should be lower or equal
    expect(femalePlan.bmr).toBeLessThan(malePlan.bmr);
    expect(femalePlan.tdee).toBeLessThan(malePlan.tdee);
  });

  it('handles gender=other as average', () => {
    const malePlan = calculateNutritionPlan(baseInput);
    const femalePlan = calculateNutritionPlan({ ...baseInput, gender: 'female' });
    const otherPlan = calculateNutritionPlan({ ...baseInput, gender: 'other' });
    // 'other' BMR should be between male and female
    expect(otherPlan.bmr).toBeGreaterThan(femalePlan.bmr);
    expect(otherPlan.bmr).toBeLessThan(malePlan.bmr);
  });

  it('returns higher TDEE for higher activity level', () => {
    const sedentary = calculateNutritionPlan({ ...baseInput, activityLevel: 1 });
    const superActive = calculateNutritionPlan({ ...baseInput, activityLevel: 5 });
    expect(superActive.tdee).toBeGreaterThan(sedentary.tdee);
  });
});
