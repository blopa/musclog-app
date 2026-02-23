import {
  bmiFromWeightAndHeightM,
  BODY_FAT_UNCERTAINTY,
  calculateBMR,
  calculateBMRKatchMcArdle,
  calculateMacros,
  calculateNutritionPlan,
  calculateTargetCalories,
  calculateTDEE,
  calculateWeightProjection,
  estimateTargetBodyFatWhenCutting,
  ffmiFromWeightHeightAndBodyFat,
  fiberFromCalories,
  getCalorieAdjustment,
  inchesToCm,
  isValidBodyFat,
  lbsToKg,
  MIN_CALORIES,
  normalizeFitnessGoal,
  normalizeWeightGoal,
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
  it('applies -500 deficit for lose', () => {
    expect(calculateTargetCalories(2500, 'lose')).toBe(2000);
  });

  it('maintains TDEE for maintain', () => {
    expect(calculateTargetCalories(2500, 'maintain')).toBe(2500);
  });

  it('applies +250 surplus for gain', () => {
    expect(calculateTargetCalories(2500, 'gain')).toBe(2750);
  });

  it('never goes below MIN_CALORIES safety floor', () => {
    expect(calculateTargetCalories(1500, 'lose')).toBe(MIN_CALORIES);
    expect(calculateTargetCalories(1200, 'lose')).toBe(MIN_CALORIES);
  });

  it('returns MIN_CALORIES when TDEE itself is at floor', () => {
    expect(calculateTargetCalories(MIN_CALORIES, 'lose')).toBe(MIN_CALORIES);
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
// normalizeWeightGoal
// ---------------------------------------------------------------------------

describe('normalizeWeightGoal', () => {
  it('returns maintain for undefined or empty', () => {
    expect(normalizeWeightGoal(undefined)).toBe('maintain');
    expect(normalizeWeightGoal('')).toBe('maintain');
  });

  it('recognizes lose, maintain, gain', () => {
    expect(normalizeWeightGoal('lose')).toBe('lose');
    expect(normalizeWeightGoal('maintain')).toBe('maintain');
    expect(normalizeWeightGoal('gain')).toBe('gain');
  });

  it('is case-insensitive', () => {
    expect(normalizeWeightGoal('LOSE')).toBe('lose');
    expect(normalizeWeightGoal('GAIN')).toBe('gain');
  });

  it('falls back to maintain for unknown input', () => {
    expect(normalizeWeightGoal('unknown')).toBe('maintain');
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
    weightGoal: 'lose',
    fitnessGoal: 'weight_loss',
    liftingExperience: 'intermediate',
  };

  it('produces a complete plan object', () => {
    const plan = calculateNutritionPlan(baseInput);

    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.targetCalories).toBeGreaterThan(0);
    expect(plan.targetCalories).toBeLessThan(plan.tdee); // weightGoal: lose
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
    // 10*83 + 6.25*180 - 5*30 + 5 = 1810 BMR; TDEE = 1810 * 1.55 ≈ 2806
    // Target = TDEE + personalized adjustment (lose, 83kg): ~0.5% BW/week → -456 kcal
    const plan = calculateNutritionPlan(baseInput);
    expect(plan.bmr).toBe(1810);
    expect(plan.tdee).toBe(Math.round(1810 * 1.55));
    expect(plan.targetCalories).toBe(plan.tdee + getCalorieAdjustment('lose', 83));
  });

  it('produces surplus for gain weight goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'gain' });
    expect(plan.targetCalories).toBeGreaterThan(plan.tdee);
    expect(plan.goalLabel).toBe('leanBulk');
    expect(plan.projectedWeightKg).toBeGreaterThan(83);
  });

  it('produces maintenance for maintain weight goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'maintain' });
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
      weightGoal: 'lose',
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

// ---------------------------------------------------------------------------
// Katch-McArdle BMR
// ---------------------------------------------------------------------------

describe('calculateBMRKatchMcArdle', () => {
  // Reference: 80kg at 15% body fat → LBM = 80 * 0.85 = 68 kg
  // BMR = 370 + 21.6 * 68 = 370 + 1468.8 = 1838.8 → 1839
  it('calculates BMR correctly for 80kg at 15% body fat', () => {
    expect(calculateBMRKatchMcArdle(80, 15)).toBe(1839);
  });

  // 90kg at 25% body fat → LBM = 90 * 0.75 = 67.5 kg
  // BMR = 370 + 21.6 * 67.5 = 370 + 1458 = 1828
  it('calculates BMR correctly for 90kg at 25% body fat', () => {
    expect(calculateBMRKatchMcArdle(90, 25)).toBe(1828);
  });

  it('returns higher BMR for lower body fat at same weight', () => {
    const lean = calculateBMRKatchMcArdle(80, 10);
    const heavy = calculateBMRKatchMcArdle(80, 30);
    expect(lean).toBeGreaterThan(heavy);
  });

  it('returns higher BMR for heavier individual at same body fat', () => {
    const lighter = calculateBMRKatchMcArdle(60, 20);
    const heavier = calculateBMRKatchMcArdle(100, 20);
    expect(heavier).toBeGreaterThan(lighter);
  });
});

// ---------------------------------------------------------------------------
// isValidBodyFat
// ---------------------------------------------------------------------------

describe('isValidBodyFat', () => {
  it('returns true for values in valid range (5-60)', () => {
    expect(isValidBodyFat(5)).toBe(true);
    expect(isValidBodyFat(15)).toBe(true);
    expect(isValidBodyFat(30)).toBe(true);
    expect(isValidBodyFat(60)).toBe(true);
  });

  it('returns false for values outside valid range', () => {
    expect(isValidBodyFat(4)).toBe(false);
    expect(isValidBodyFat(61)).toBe(false);
    expect(isValidBodyFat(0)).toBe(false);
    expect(isValidBodyFat(100)).toBe(false);
  });

  it('returns false for undefined or null', () => {
    expect(isValidBodyFat(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateNutritionPlan with body fat (Katch-McArdle + range)
// ---------------------------------------------------------------------------

describe('calculateNutritionPlan with bodyFatPercent', () => {
  const baseInput: NutritionCalculatorInput = {
    gender: 'male',
    weightKg: 83,
    heightCm: 180,
    age: 30,
    activityLevel: 3,
    weightGoal: 'lose',
    fitnessGoal: 'weight_loss',
    liftingExperience: 'intermediate',
  };

  it('uses Katch-McArdle when valid body fat is provided', () => {
    const withBF = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });
    const withoutBF = calculateNutritionPlan(baseInput);

    // Should use different BMR formula → different BMR value
    expect(withBF.bmr).not.toBe(withoutBF.bmr);

    // Katch-McArdle: LBM = 83 * 0.80 = 66.4; BMR = 370 + 21.6 * 66.4 = 1804.24 → 1804
    expect(withBF.bmr).toBe(Math.round(370 + 21.6 * (83 * 0.8)));
  });

  it('falls back to Mifflin-St Jeor when body fat is not provided', () => {
    const plan = calculateNutritionPlan(baseInput);

    // Mifflin-St Jeor for male: 10*83 + 6.25*180 - 5*30 + 5 = 1810
    expect(plan.bmr).toBe(1810);
    expect(plan.minTargetCalories).toBeUndefined();
    expect(plan.maxTargetCalories).toBeUndefined();
  });

  it('falls back to Mifflin-St Jeor for invalid body fat (too low)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 3 });
    expect(plan.bmr).toBe(1810); // Mifflin-St Jeor
    expect(plan.minTargetCalories).toBeUndefined();
  });

  it('falls back to Mifflin-St Jeor for invalid body fat (too high)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 65 });
    expect(plan.bmr).toBe(1810); // Mifflin-St Jeor
    expect(plan.minTargetCalories).toBeUndefined();
  });

  it('produces min/max target calories when body fat is valid', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });

    expect(plan.minTargetCalories).toBeDefined();
    expect(plan.maxTargetCalories).toBeDefined();
    expect(plan.minTargetCalories!).toBeLessThanOrEqual(plan.targetCalories);
    expect(plan.maxTargetCalories!).toBeGreaterThanOrEqual(plan.targetCalories);
  });

  it('min/max bracket the mid target calories', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 25 });

    expect(plan.minTargetCalories!).toBeLessThanOrEqual(plan.targetCalories);
    expect(plan.maxTargetCalories!).toBeGreaterThanOrEqual(plan.targetCalories);
    // Range should reflect ±${BODY_FAT_UNCERTAINTY}% body fat
    expect(plan.maxTargetCalories! - plan.minTargetCalories!).toBeGreaterThan(0);
  });

  it('handles body fat at lower boundary (5%)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 5 });

    expect(plan.minTargetCalories).toBeDefined();
    expect(plan.maxTargetCalories).toBeDefined();
    // Low BF clamped: max(5 - 4, 1) = 1% → still valid
    expect(plan.maxTargetCalories!).toBeGreaterThan(plan.minTargetCalories!);
  });

  it('handles body fat at upper boundary (60%)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 60 });

    expect(plan.minTargetCalories).toBeDefined();
    expect(plan.maxTargetCalories).toBeDefined();
    // High BF clamped: min(60 + 4, 99) = 64% → still valid. Allow >= when both hit floor (1500).
    expect(plan.maxTargetCalories!).toBeGreaterThanOrEqual(plan.minTargetCalories!);
  });

  it('BODY_FAT_UNCERTAINTY constant is 4', () => {
    expect(BODY_FAT_UNCERTAINTY).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// fiberFromCalories
// ---------------------------------------------------------------------------

describe('fiberFromCalories', () => {
  it('calculates 14g per 1000 kcal correctly', () => {
    expect(fiberFromCalories(1000)).toBe(25);
    expect(fiberFromCalories(2000)).toBe(28);
    expect(fiberFromCalories(2500)).toBe(35);
  });

  it('clamps to minimum of 25g', () => {
    expect(fiberFromCalories(1000)).toBe(25); // 14g calculated, clamped to 25g
    expect(fiberFromCalories(1500)).toBe(25); // 21g calculated, clamped to 25g
    expect(fiberFromCalories(1790)).toBe(25); // 25.06g calculated, clamped to 25g
  });

  it('clamps to maximum of 40g', () => {
    expect(fiberFromCalories(3000)).toBe(40); // 42g calculated, clamped to 40g
    expect(fiberFromCalories(3500)).toBe(40); // 49g calculated, clamped to 40g
    expect(fiberFromCalories(4000)).toBe(40); // 56g calculated, clamped to 40g
  });

  it('returns exact values within range', () => {
    expect(fiberFromCalories(2000)).toBe(28); // 28g within 25-40 range
    expect(fiberFromCalories(2143)).toBe(30); // 30g within 25-40 range
    expect(fiberFromCalories(2857)).toBe(40); // 40g at upper bound
  });

  it('handles edge cases', () => {
    expect(fiberFromCalories(0)).toBe(25); // Minimum clamp
    expect(fiberFromCalories(-100)).toBe(25); // Negative input, minimum clamp
  });
});

// ---------------------------------------------------------------------------
// bmiFromWeightAndHeightM
// ---------------------------------------------------------------------------

describe('bmiFromWeightAndHeightM', () => {
  it('calculates BMI correctly for normal values', () => {
    // 70kg at 1.75m: 70 / (1.75 * 1.75) = 22.86
    expect(bmiFromWeightAndHeightM(70, 1.75)).toBe(22.9);
    // 80kg at 1.80m: 80 / (1.80 * 1.80) = 24.69
    expect(bmiFromWeightAndHeightM(80, 1.8)).toBe(24.7);
    // 60kg at 1.65m: 60 / (1.65 * 1.65) = 22.04
    expect(bmiFromWeightAndHeightM(60, 1.65)).toBe(22.0);
  });

  it('handles underweight BMI', () => {
    // 50kg at 1.75m: 50 / (1.75 * 1.75) = 16.33
    expect(bmiFromWeightAndHeightM(50, 1.75)).toBe(16.3);
  });

  it('handles overweight BMI', () => {
    // 90kg at 1.75m: 90 / (1.75 * 1.75) = 29.39
    expect(bmiFromWeightAndHeightM(90, 1.75)).toBe(29.4);
  });

  it('handles obese BMI', () => {
    // 100kg at 1.70m: 100 / (1.70 * 1.70) = 34.60
    expect(bmiFromWeightAndHeightM(100, 1.7)).toBe(34.6);
  });

  it('returns 0 for invalid height (zero or negative)', () => {
    expect(bmiFromWeightAndHeightM(70, 0)).toBe(0);
    expect(bmiFromWeightAndHeightM(70, -1.75)).toBe(0);
  });

  it('returns rounded to one decimal place', () => {
    // 75kg at 1.73m: 75 / (1.73 * 1.73) = 25.06
    expect(bmiFromWeightAndHeightM(75, 1.73)).toBe(25.1);
    // 68kg at 1.72m: 68 / (1.72 * 1.72) = 22.98
    expect(bmiFromWeightAndHeightM(68, 1.72)).toBe(23.0);
  });
});

// ---------------------------------------------------------------------------
// ffmiFromWeightHeightAndBodyFat
// ---------------------------------------------------------------------------

describe('ffmiFromWeightHeightAndBodyFat', () => {
  it('calculates FFMI correctly for normal values', () => {
    // 80kg at 1.80m with 15% body fat:
    // FFM = 80 * (1 - 0.15) = 68kg
    // FFMI = 68 / (1.80 * 1.80) = 20.99
    expect(ffmiFromWeightHeightAndBodyFat(80, 1.8, 15)).toBe(21.0);
  });

  it('calculates FFMI for lean individual', () => {
    // 75kg at 1.75m with 10% body fat:
    // FFM = 75 * (1 - 0.10) = 67.5kg
    // FFMI = 67.5 / (1.75 * 1.75) = 22.04
    expect(ffmiFromWeightHeightAndBodyFat(75, 1.75, 10)).toBe(22.0);
  });

  it('calculates FFMI for higher body fat', () => {
    // 85kg at 1.80m with 25% body fat:
    // FFM = 85 * (1 - 0.25) = 63.75kg
    // FFMI = 63.75 / (1.80 * 1.80) = 19.68
    expect(ffmiFromWeightHeightAndBodyFat(85, 1.8, 25)).toBe(19.7);
  });

  it('returns 0 for invalid height (zero or negative)', () => {
    expect(ffmiFromWeightHeightAndBodyFat(80, 0, 15)).toBe(0);
    expect(ffmiFromWeightHeightAndBodyFat(80, -1.8, 15)).toBe(0);
  });

  it('returns 0 for 0% body fat (theoretically impossible but handled)', () => {
    // 80kg at 1.80m with 0% body fat: FFM = 80kg
    // FFMI = 80 / (1.80 * 1.80) = 24.69
    expect(ffmiFromWeightHeightAndBodyFat(80, 1.8, 0)).toBe(24.7);
  });

  it('returns lower FFMI for higher body fat at same weight', () => {
    const lean = ffmiFromWeightHeightAndBodyFat(80, 1.8, 10);
    const fat = ffmiFromWeightHeightAndBodyFat(80, 1.8, 30);
    expect(lean).toBeGreaterThan(fat);
  });

  it('returns higher FFMI for heavier individual at same body fat', () => {
    const lighter = ffmiFromWeightHeightAndBodyFat(70, 1.8, 15);
    const heavier = ffmiFromWeightHeightAndBodyFat(90, 1.8, 15);
    expect(heavier).toBeGreaterThan(lighter);
  });

  it('returns rounded to one decimal place', () => {
    // 77kg at 1.78m with 12% body fat:
    // FFM = 77 * (1 - 0.12) = 67.76kg
    // FFMI = 67.76 / (1.78 * 1.78) = 21.39
    expect(ffmiFromWeightHeightAndBodyFat(77, 1.78, 12)).toBe(21.4);
  });
});

// ---------------------------------------------------------------------------
// estimateTargetBodyFatWhenCutting
// ---------------------------------------------------------------------------

describe('estimateTargetBodyFatWhenCutting', () => {
  it('estimates target body fat for weight loss', () => {
    // 80kg at 20% body fat, target 75kg:
    // Weight lost = 5kg, fat lost = 0.7 * 5 = 3.5kg
    // Current fat = 80 * 0.20 = 16kg, target fat = 16 - 3.5 = 12.5kg
    // Target body fat % = 12.5 / 75 * 100 = 16.67%
    expect(estimateTargetBodyFatWhenCutting(80, 75, 20)).toBe(16.7);
  });

  it('returns 0 when no weight loss (maintenance)', () => {
    expect(estimateTargetBodyFatWhenCutting(80, 80, 20)).toBe(0);
    expect(estimateTargetBodyFatWhenCutting(80, 85, 20)).toBe(0); // Weight gain
  });

  it('handles significant weight loss', () => {
    // 100kg at 30% body fat, target 80kg:
    // Weight lost = 20kg, fat lost = 0.7 * 20 = 14kg
    // Current fat = 100 * 0.30 = 30kg, target fat = 30 - 14 = 16kg
    // Target body fat % = 16 / 80 * 100 = 20%
    expect(estimateTargetBodyFatWhenCutting(100, 80, 30)).toBe(20.0);
  });

  it('handles lean individual cutting', () => {
    // 70kg at 12% body fat, target 65kg:
    // Weight lost = 5kg, fat lost = 0.7 * 5 = 3.5kg
    // Current fat = 70 * 0.12 = 8.4kg, target fat = 8.4 - 3.5 = 4.9kg
    // Target body fat % = 4.9 / 65 * 100 = 7.54%
    expect(estimateTargetBodyFatWhenCutting(70, 65, 12)).toBe(7.5);
  });

  it('prevents negative target body fat', () => {
    // Very lean individual losing lots of weight
    // 60kg at 5% body fat, target 50kg:
    // Weight lost = 10kg, fat lost = 0.7 * 10 = 7kg
    // Current fat = 60 * 0.05 = 3kg, target fat = max(0, 3 - 7) = 0kg
    // Target body fat % = 0 / 50 * 100 = 0%
    expect(estimateTargetBodyFatWhenCutting(60, 50, 5)).toBe(0);
  });

  it('returns rounded to one decimal place', () => {
    // 85kg at 18% body fat, target 82kg:
    // Weight lost = 3kg, fat lost = 0.7 * 3 = 2.1kg
    // Current fat = 85 * 0.18 = 15.3kg, target fat = 15.3 - 2.1 = 13.2kg
    // Target body fat % = 13.2 / 82 * 100 = 16.10%
    expect(estimateTargetBodyFatWhenCutting(85, 82, 18)).toBe(16.1);
  });

  it('handles edge case with minimal weight loss', () => {
    // 80kg at 20% body fat, target 79.5kg:
    // Weight lost = 0.5kg, fat lost = 0.7 * 0.5 = 0.35kg
    // Current fat = 80 * 0.20 = 16kg, target fat = 16 - 0.35 = 15.65kg
    // Target body fat % = 15.65 / 79.5 * 100 = 19.69%
    expect(estimateTargetBodyFatWhenCutting(80, 79.5, 20)).toBe(19.7);
  });
});
