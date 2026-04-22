import {
  ACTIVITY_MULTIPLIERS,
  ADAPTIVE_THERMOGENESIS_KCAL_PER_KG,
  bmiFromWeightAndHeightM,
  BODY_FAT_UNCERTAINTY,
  calculateBMR,
  calculateBMRKatchMcArdle,
  calculateMacros,
  calculateNutritionPlan,
  calculateTargetCalories,
  calculateTDEE,
  calculateWeightProjection,
  computeWeightChangeFromCalorieDelta,
  eatingPhaseToWeightGoal,
  estimateTargetBodyFatWhenCutting,
  ffmiFromWeightHeightAndBodyFat,
  fiberFromCalories,
  FORBES_C_FEMALE,
  FORBES_C_MALE,
  generateWeeklyCheckins,
  getCalorieAdjustment,
  getEffectiveKcalPerKgGain,
  getEffectiveKcalPerKgWeightLoss,
  getGainFatFraction,
  getMinCalories,
  getWeightChangeComposition,
  inchesToCm,
  isValidBodyFat,
  lbsToKg,
  MIN_CALORIES,
  normalizeFitnessGoal,
  normalizeWeightGoal,
  type NutritionCalculatorInput,
  planToInitialGoals,
  RMR_FAT_KCAL_PER_KG,
  RMR_LEAN_KCAL_PER_KG,
} from '@/utils/nutritionCalculator';

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
    expect(calculateTDEE({ bmr, activityLevel: 1 })).toBe(Math.round(1780 * 1.2));
  });

  it('applies light multiplier (1.375)', () => {
    expect(calculateTDEE({ bmr, activityLevel: 2 })).toBe(Math.round(1780 * 1.375));
  });

  it('applies moderate multiplier (1.55)', () => {
    expect(calculateTDEE({ bmr, activityLevel: 3 })).toBe(Math.round(1780 * 1.55));
  });

  it('applies active multiplier (1.725)', () => {
    expect(calculateTDEE({ bmr, activityLevel: 4 })).toBe(Math.round(1780 * 1.725));
  });

  it('applies super active multiplier (1.9)', () => {
    expect(calculateTDEE({ bmr, activityLevel: 5 })).toBe(Math.round(1780 * 1.9));
  });

  it('falls back to moderate multiplier for unknown level', () => {
    expect(calculateTDEE({ bmr, activityLevel: 99 })).toBe(Math.round(1780 * 1.55));
  });

  it('increases with activity level', () => {
    const sedentary = calculateTDEE({ bmr, activityLevel: 1 });
    const superActive = calculateTDEE({ bmr, activityLevel: 5 });
    expect(superActive).toBeGreaterThan(sedentary);
  });

  it('returns 0 when neither empirical data nor bmr+activityLevel are provided', () => {
    expect(calculateTDEE({})).toBe(0);
  });

  it('calculates empirical TDEE with drift correction correctly (weight loss)', () => {
    // Scenario: User loses 4kg in 30 days, eating 2000 kcal/day.
    // Average weight: (84 + 80) / 2 = 82kg.
    // ΔWeight = -4kg.
    // Assuming 25% fat (default if not provided), getWeightChangeComposition handles the split.
    // For -4kg weight loss, it might be e.g. -3kg fat, -1kg lean.
    // TDEE_avg = (TotalCalories - (ΔFat * 7730 + ΔLean * 1250)) / 30
    // TDEE_final = TDEE_avg + (ΔLean/2 * 27) + (ΔFat/2 * 9)

    const params = {
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 84,
      finalWeight: 80,
      liftingExperience: 'intermediate' as const,
    };

    // No gender provided → forbesC = average(10.4, 13.8) = 12.1.
    // No heightCm/age → tissue coefficients unscaled.
    // Fat/lean split changes vs old FORBES_C=10.4 calculation; adaptive penalty now 20 kcal/kg/day.
    const tdee = calculateTDEE(params);

    expect(tdee).toBeGreaterThan(2000); // Deficit should result in TDEE > intake
    expect(tdee).toBe(2638);
  });

  it('calculates empirical TDEE with drift correction correctly (weight gain)', () => {
    // Scenario: User gains 2kg in 30 days, eating 3000 kcal/day.
    // ΔWeight = +2kg.
    // For +2kg weight gain, intermediate (50/50 split) -> +1kg fat, +1kg lean.
    // fatCalories = 1 * 8840 = 8840
    // leanCalories = 1 * 3900 = 3900
    // totalStored = 12740
    // averageTdee = (90000 - 12740) / 30 = 77260 / 30 = 2575.33
    // Refined Drift Model (default PAL = 1.55):
    // restingDrop = (1/2 * 13) + (1/2 * 4.5) = 6.5 + 2.25 = 8.75
    // activityScaledDrop = 8.75 * 1.55 = 13.5625
    // adaptivePenalty = (2/2 * 20) = 20  [ADAPTIVE_THERMOGENESIS_KCAL_PER_KG updated to 20.0]
    // totalDriftAdjustment = 33.5625
    // expectedTdee = 2575.33 + 33.56 = 2608.89 -> 2609

    const params = {
      totalCalories: 3000 * 30,
      totalDays: 30,
      initialWeight: 70,
      finalWeight: 72,
      liftingExperience: 'intermediate' as const,
    };

    const tdee = calculateTDEE(params);
    expect(tdee).toBe(2609);
  });

  it('produces different TDEE when heightCm creates BMI > 30 (obesity scaling)', () => {
    const shared = {
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 100,
      finalWeight: 96,
      liftingExperience: 'intermediate' as const,
    };
    const withoutHeight = calculateTDEE(shared);
    // BMI = 100 / (1.65^2) ≈ 36.7 > 30 → tissue coefficients scaled down 2%
    const withObeseHeight = calculateTDEE({ ...shared, heightCm: 165 });
    expect(withoutHeight).toBeGreaterThan(0);
    expect(withObeseHeight).toBeGreaterThan(0);
    expect(withObeseHeight).not.toBe(withoutHeight);
  });

  it('produces different TDEE when age > 50 (age scaling)', () => {
    const shared = {
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 80,
      finalWeight: 77,
      liftingExperience: 'intermediate' as const,
    };
    const young = calculateTDEE({ ...shared, age: 30 });
    const older = calculateTDEE({ ...shared, age: 55 });
    expect(young).not.toBe(older);
  });

  it('uses activity multiplier for drift correction when activityLevel is provided', () => {
    const shared = {
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 80,
      finalWeight: 77,
      liftingExperience: 'intermediate' as const,
    };
    const sedentary = calculateTDEE({ ...shared, activityLevel: 1 });
    const active = calculateTDEE({ ...shared, activityLevel: 5 });
    expect(sedentary).not.toBe(active);
  });

  it('uses exact body fat split when both initial and final fat % are provided', () => {
    const withExactBF = calculateTDEE({
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 84,
      finalWeight: 80,
      initialFatPercentage: 25,
      finalFatPercentage: 23,
      liftingExperience: 'intermediate' as const,
    });
    const withoutBF = calculateTDEE({
      totalCalories: 2000 * 30,
      totalDays: 30,
      initialWeight: 84,
      finalWeight: 80,
      liftingExperience: 'intermediate' as const,
    });
    expect(withExactBF).not.toBe(withoutBF);
    expect(withExactBF).toBeGreaterThan(0);
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

  it('uses FFM-based protein for weight_loss when body fat is valid', () => {
    // 80kg at 20% BF → FFM = 64kg; weight_loss target: 2.7 g/kg FFM = 172.8 → 173g
    const result = calculateMacros(2000, 'weight_loss', { weightKg: 80, bodyFatPercent: 20 });
    expect(result.protein).toBe(Math.round(64 * 2.7));
    // Protein pct should be recalculated from actual grams
    expect(result.proteinPct).toBeGreaterThan(0);
    expect(result.carbsPct + result.fatsPct + result.proteinPct).toBe(100);
  });

  it('uses FFM-based protein for hypertrophy when body fat is valid', () => {
    // 80kg at 20% BF → FFM = 64kg; hypertrophy target: 2.0 g/kg FFM = 128g
    const result = calculateMacros(2500, 'hypertrophy', { weightKg: 80, bodyFatPercent: 20 });
    expect(result.protein).toBe(Math.round(64 * 2.0));
  });

  it('falls back to pct-based when body fat is invalid', () => {
    const withInvalidBF = calculateMacros(2000, 'weight_loss', { weightKg: 80, bodyFatPercent: 3 });
    const withoutBF = calculateMacros(2000, 'weight_loss');
    expect(withInvalidBF.protein).toBe(withoutBF.protein);
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
    // Steady-state rate: -500 * 7 / 7700 ≈ -0.45 kg/week
    const result = calculateWeightProjection(80, 2000, 2500);
    expect(result.weeklyWeightChangeKg).toBeCloseTo(-0.45, 1);
    // Glycogen-pool projection over 90 days (80 kg person):
    //   glycogenDryKg  = 80 * 0.015 = 1.2 kg
    //   glycogenWetKg  = 1.2 * 4   = 4.8 kg
    //   glycogenEnergy = 1.2 * 4206 = 5047 kcal
    //   totalDeficit   = 500 * 90  = 45 000 kcal
    //   earlyPhase     = min(45000, 5047) = 5047 kcal → loses 4.8 kg (glycogen+water)
    //   steadyPhase    = (45000 - 5047) / 7700 ≈ 5.19 kg
    //   projected      = 80 - 4.8 - 5.19 = 70.0 kg
    expect(result.projectedWeightKg).toBeCloseTo(70.0, 0);
  });

  it('uses Forbes model for deficit projection when body fat is valid', () => {
    const withBF = calculateWeightProjection(80, 2000, 2500, { bodyFatPercent: 20 });
    const withoutBF = calculateWeightProjection(80, 2000, 2500);
    // Forbes gives a composition-aware kcal/kg, so projections differ
    expect(withBF.projectedWeightKg).not.toBe(withoutBF.projectedWeightKg);
    expect(withBF.weeklyWeightChangeKg).not.toBe(withoutBF.weeklyWeightChangeKg);
  });

  it('uses experience-dependent build cost for surplus', () => {
    const beginner = calculateWeightProjection(80, 3000, 2500, { liftingExperience: 'beginner' });
    const advanced = calculateWeightProjection(80, 3000, 2500, { liftingExperience: 'advanced' });
    // Beginner has lower effective build cost → more weight gained
    expect(beginner.projectedWeightKg).toBeGreaterThan(advanced.projectedWeightKg);
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

  it('populates dailyCalorieDeficit for lose goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'lose' });
    expect(plan.dailyCalorieDeficit).toBeDefined();
    expect(plan.dailyCalorieDeficit).toBeGreaterThan(0);
    expect(plan.dailyCalorieSurplus).toBeUndefined();
    expect(plan.dailyCalorieDeficit).toBe(plan.tdee - plan.targetCalories);
  });

  it('populates dailyCalorieSurplus for gain goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'gain' });
    expect(plan.dailyCalorieSurplus).toBeDefined();
    expect(plan.dailyCalorieSurplus).toBeGreaterThan(0);
    expect(plan.dailyCalorieDeficit).toBeUndefined();
    expect(plan.dailyCalorieSurplus).toBe(plan.targetCalories - plan.tdee);
  });

  it('omits both deficit and surplus for maintain goal', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'maintain' });
    expect(plan.dailyCalorieDeficit).toBeUndefined();
    expect(plan.dailyCalorieSurplus).toBeUndefined();
  });

  it('populates targetBMI when heightCm > 0', () => {
    const plan = calculateNutritionPlan(baseInput);
    expect(plan.targetBMI).toBeDefined();
    expect(plan.targetBMI).toBeGreaterThan(0);
    expect(plan.targetBMI).toBe(
      bmiFromWeightAndHeightM(plan.projectedWeightKg, baseInput.heightCm / 100)
    );
  });

  it('populates estimatedFatChangeKg and estimatedLeanChangeKg for non-maintenance', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'lose' });
    expect(plan.estimatedFatChangeKg).toBeDefined();
    expect(plan.estimatedLeanChangeKg).toBeDefined();
    expect(plan.estimatedFatChangeKg).toBeLessThan(0); // cutting
    expect(plan.estimatedLeanChangeKg).toBeLessThan(0); // cutting
  });

  it('estimatedFatChangeKg and estimatedLeanChangeKg sum to total weight change', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'lose' });
    const totalChange = plan.projectedWeightKg - plan.currentWeightKg;
    expect(plan.estimatedFatChangeKg! + plan.estimatedLeanChangeKg!).toBeCloseTo(totalChange, 1);
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

  it('targetBodyFat for cuts is consistent with estimatedFatChangeKg (Forbes model)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });

    expect(plan.targetBodyFat).toBeDefined();
    expect(plan.estimatedFatChangeKg).toBeDefined();

    const expectedNewFatMass = baseInput.weightKg * 0.2 + plan.estimatedFatChangeKg!;
    const expectedTargetBF = parseFloat(
      Math.max(0, Math.min(100, (expectedNewFatMass / plan.projectedWeightKg) * 100)).toFixed(1)
    );
    expect(plan.targetBodyFat).toBe(expectedTargetBF);
  });

  it('targetBodyFat for cuts (Forbes) differs from the 70%-hardcoded estimate', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });
    const oldEstimate = estimateTargetBodyFatWhenCutting(
      baseInput.weightKg,
      plan.projectedWeightKg,
      20
    );
    // The Forbes model gives a different lean/fat split than a fixed 70% fat assumption
    expect(plan.targetBodyFat).not.toBe(oldEstimate);
  });

  it('targetBodyFat for gain uses Forbes composition model', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'gain', bodyFatPercent: 20 });
    expect(plan.targetBodyFat).toBeDefined();
    expect(plan.targetBodyFat).toBeGreaterThan(0);
    // For a bulk, body fat % should be slightly higher than current
    expect(plan.targetBodyFat).toBeGreaterThan(20);
  });

  it('targetBodyFat for maintain equals current body fat', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'maintain', bodyFatPercent: 20 });
    expect(plan.targetBodyFat).toBe(20);
  });

  it('targetBodyFat is undefined when body fat not provided', () => {
    const plan = calculateNutritionPlan(baseInput);
    expect(plan.targetBodyFat).toBeUndefined();
  });

  it('targetFFMI is populated when height and targetBodyFat are available', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });
    expect(plan.targetFFMI).toBeDefined();
    expect(plan.targetFFMI).toBeGreaterThan(0);
    expect(plan.targetFFMI).toBe(
      ffmiFromWeightHeightAndBodyFat(plan.projectedWeightKg, baseInput.heightCm / 100, plan.targetBodyFat!)
    );
  });

  it('targetFFMI is undefined when body fat is not provided', () => {
    const plan = calculateNutritionPlan(baseInput);
    expect(plan.targetFFMI).toBeUndefined();
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

// ---------------------------------------------------------------------------
// calculateNutritionPlan – diverse scenarios (height, body comp, gender, age, goal, experience)
// ---------------------------------------------------------------------------

const BASE_SCENARIO_INPUT: NutritionCalculatorInput = {
  gender: 'male',
  weightKg: 75,
  heightCm: 175,
  age: 35,
  activityLevel: 3,
  weightGoal: 'lose',
  fitnessGoal: 'general',
  liftingExperience: 'intermediate',
};

function scenario(
  label: string,
  overrides: Partial<NutritionCalculatorInput>
): [string, NutritionCalculatorInput] {
  return [label, { ...BASE_SCENARIO_INPUT, ...overrides }];
}

const DIVERSE_SCENARIOS: [string, NutritionCalculatorInput][] = [
  // --- Height: short, average, tall ---
  scenario('short female 160cm lose', {
    gender: 'female',
    heightCm: 160,
    weightKg: 58,
    weightGoal: 'lose',
  }),
  scenario('short male 158cm maintain', {
    gender: 'male',
    heightCm: 158,
    weightKg: 55,
    weightGoal: 'maintain',
  }),
  scenario('tall female 182cm gain', {
    gender: 'female',
    heightCm: 182,
    weightKg: 78,
    weightGoal: 'gain',
  }),
  scenario('tall male 195cm lose', {
    gender: 'male',
    heightCm: 195,
    weightKg: 98,
    weightGoal: 'lose',
  }),
  scenario('average height 175cm male lose', { heightCm: 175, weightKg: 80, weightGoal: 'lose' }),
  scenario('average height 170cm female gain', {
    gender: 'female',
    heightCm: 170,
    weightKg: 65,
    weightGoal: 'gain',
  }),
  // --- Body composition: lean/fit vs heavy/higher fat ---
  scenario('lean male 12% body fat lose', { weightKg: 72, bodyFatPercent: 12, weightGoal: 'lose' }),
  scenario('lean female 15% body fat maintain', {
    gender: 'female',
    weightKg: 58,
    bodyFatPercent: 15,
    weightGoal: 'maintain',
  }),
  scenario('higher body fat male 32% lose', {
    weightKg: 95,
    bodyFatPercent: 32,
    weightGoal: 'lose',
  }),
  scenario('higher body fat female 38% lose', {
    gender: 'female',
    weightKg: 82,
    bodyFatPercent: 38,
    weightGoal: 'lose',
  }),
  scenario('fit male no BF gain', {
    weightKg: 78,
    weightGoal: 'gain',
    liftingExperience: 'beginner',
  }),
  scenario('heavy male no BF lose', { weightKg: 110, heightCm: 180, weightGoal: 'lose' }),
  scenario('light female 52kg maintain', {
    gender: 'female',
    weightKg: 52,
    heightCm: 162,
    weightGoal: 'maintain',
  }),
  scenario('heavy female 90kg lose', {
    gender: 'female',
    weightKg: 90,
    heightCm: 168,
    weightGoal: 'lose',
  }),
  // --- Gender: male, female, other ---
  scenario('male 30y lose', { gender: 'male', age: 30, weightGoal: 'lose' }),
  scenario('female 30y lose', { gender: 'female', age: 30, weightGoal: 'lose' }),
  scenario('other 30y lose', { gender: 'other', age: 30, weightGoal: 'lose' }),
  scenario('male 30y gain', { gender: 'male', age: 30, weightGoal: 'gain' }),
  scenario('female 30y gain', { gender: 'female', age: 30, weightGoal: 'gain' }),
  scenario('other 30y maintain', { gender: 'other', age: 30, weightGoal: 'maintain' }),
  // --- Age: young, middle, older ---
  scenario('young male 20y lose', { age: 20, weightGoal: 'lose' }),
  scenario('young female 22y gain', { gender: 'female', age: 22, weightGoal: 'gain' }),
  scenario('middle male 45y lose', { age: 45, weightGoal: 'lose' }),
  scenario('middle female 48y maintain', { gender: 'female', age: 48, weightGoal: 'maintain' }),
  scenario('older male 58y lose', { age: 58, weightGoal: 'lose' }),
  scenario('older female 62y lose', {
    gender: 'female',
    age: 62,
    weightKg: 70,
    weightGoal: 'lose',
  }),
  scenario('older male 65y maintain', { age: 65, weightKg: 78, weightGoal: 'maintain' }),
  scenario('young male 25y gain', { age: 25, weightGoal: 'gain', liftingExperience: 'beginner' }),
  // --- Weight goal ---
  scenario('male lose goal', { weightGoal: 'lose' }),
  scenario('male maintain goal', { weightGoal: 'maintain' }),
  scenario('male gain goal', { weightGoal: 'gain' }),
  scenario('female lose goal', { gender: 'female', weightGoal: 'lose' }),
  scenario('female gain goal', { gender: 'female', weightGoal: 'gain' }),
  // --- Activity level ---
  scenario('sedentary male lose', { activityLevel: 1, weightGoal: 'lose' }),
  scenario('light activity female gain', {
    gender: 'female',
    activityLevel: 2,
    weightGoal: 'gain',
  }),
  scenario('moderate activity male maintain', { activityLevel: 3, weightGoal: 'maintain' }),
  scenario('active male lose', { activityLevel: 4, weightGoal: 'lose' }),
  scenario('super active female gain', { gender: 'female', activityLevel: 5, weightGoal: 'gain' }),
  // --- Lifting experience ---
  scenario('beginner male gain', { weightGoal: 'gain', liftingExperience: 'beginner' }),
  scenario('intermediate male lose', { weightGoal: 'lose', liftingExperience: 'intermediate' }),
  scenario('advanced male gain', { weightGoal: 'gain', liftingExperience: 'advanced' }),
  scenario('beginner female gain', {
    gender: 'female',
    weightGoal: 'gain',
    liftingExperience: 'beginner',
  }),
  scenario('advanced female lose', {
    gender: 'female',
    weightGoal: 'lose',
    liftingExperience: 'advanced',
  }),
  // --- Combined: tall + fat + lose, short + lean + gain, etc. ---
  scenario('tall heavy male 100kg 30% BF lose', {
    heightCm: 190,
    weightKg: 100,
    bodyFatPercent: 30,
    weightGoal: 'lose',
  }),
  scenario('short lean female 55kg 14% BF gain', {
    gender: 'female',
    heightCm: 158,
    weightKg: 55,
    bodyFatPercent: 14,
    weightGoal: 'gain',
    liftingExperience: 'beginner',
  }),
  scenario('older tall male 60y 90kg maintain', {
    age: 60,
    heightCm: 185,
    weightKg: 90,
    weightGoal: 'maintain',
  }),
  scenario('young short female 20y 50kg gain', {
    gender: 'female',
    age: 20,
    heightCm: 155,
    weightKg: 50,
    weightGoal: 'gain',
  }),
  scenario('other 40y 70kg body fat 25% lose', {
    gender: 'other',
    age: 40,
    weightKg: 70,
    bodyFatPercent: 25,
    weightGoal: 'lose',
  }),
  scenario('sedentary older female 65y 68kg lose', {
    gender: 'female',
    age: 65,
    activityLevel: 1,
    weightKg: 68,
    weightGoal: 'lose',
  }),
  scenario('super active young male 24y 85kg gain', {
    gender: 'male',
    age: 24,
    activityLevel: 5,
    weightKg: 85,
    weightGoal: 'gain',
    liftingExperience: 'beginner',
  }),
  scenario('boundary body fat 5% male lose', {
    weightKg: 70,
    bodyFatPercent: 5,
    weightGoal: 'lose',
  }),
  scenario('boundary body fat 60% female lose', {
    gender: 'female',
    weightKg: 88,
    bodyFatPercent: 60,
    weightGoal: 'lose',
  }),
  scenario('hypertrophy goal male gain', {
    weightGoal: 'gain',
    fitnessGoal: 'hypertrophy',
    liftingExperience: 'beginner',
  }),
  scenario('strength goal female lose', {
    gender: 'female',
    weightGoal: 'lose',
    fitnessGoal: 'strength',
  }),
  scenario('endurance goal male maintain', { weightGoal: 'maintain', fitnessGoal: 'endurance' }),
];

describe('calculateNutritionPlan – diverse scenarios', () => {
  it.each(DIVERSE_SCENARIOS)('produces valid plan for: %s', (_label, input) => {
    const plan = calculateNutritionPlan(input);
    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThanOrEqual(plan.bmr);
    expect(plan.targetCalories).toBeGreaterThanOrEqual(MIN_CALORIES);
    expect(plan.protein).toBeGreaterThan(0);
    expect(plan.carbs).toBeGreaterThan(0);
    expect(plan.fats).toBeGreaterThan(0);
    expect(plan.proteinPct + plan.carbsPct + plan.fatsPct).toBe(100);
    expect(plan.currentWeightKg).toBe(input.weightKg);
    expect(plan.projectionDays).toBe(90);
    if (input.weightGoal === 'lose') {
      expect(plan.targetCalories).toBeLessThanOrEqual(plan.tdee);
      expect(plan.projectedWeightKg).toBeLessThanOrEqual(input.weightKg);
    }
    if (input.weightGoal === 'gain') {
      expect(plan.targetCalories).toBeGreaterThanOrEqual(plan.tdee);
      expect(plan.projectedWeightKg).toBeGreaterThanOrEqual(input.weightKg);
    }
    if (input.weightGoal === 'maintain') {
      expect(plan.projectedWeightKg).toBeCloseTo(input.weightKg, 0);
    }
    if (input.bodyFatPercent != null && input.bodyFatPercent >= 5 && input.bodyFatPercent <= 60) {
      expect(plan.minTargetCalories).toBeDefined();
      expect(plan.maxTargetCalories).toBeDefined();
      expect(plan.minTargetCalories!).toBeLessThanOrEqual(plan.targetCalories);
      expect(plan.maxTargetCalories!).toBeGreaterThanOrEqual(plan.targetCalories);
    }
  });

  it('tall person has higher BMR than short person (same gender, age, weight)', () => {
    const short = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, heightCm: 160, weightKg: 70 });
    const tall = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, heightCm: 192, weightKg: 70 });
    expect(tall.bmr).toBeGreaterThan(short.bmr);
    expect(tall.tdee).toBeGreaterThan(short.tdee);
  });

  it('female has lower BMR than male (same height, weight, age)', () => {
    const male = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, gender: 'male' });
    const female = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, gender: 'female' });
    expect(female.bmr).toBeLessThan(male.bmr);
    expect(female.tdee).toBeLessThan(male.tdee);
  });

  it('older person has lower BMR than younger (same gender, height, weight)', () => {
    const young = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, age: 22 });
    const older = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, age: 58 });
    expect(older.bmr).toBeLessThan(young.bmr);
    expect(older.tdee).toBeLessThan(young.tdee);
  });

  it('heavier person has higher BMR than lighter (same gender, height, age)', () => {
    const light = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, weightKg: 60 });
    const heavy = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, weightKg: 95 });
    expect(heavy.bmr).toBeGreaterThan(light.bmr);
    expect(heavy.tdee).toBeGreaterThan(light.tdee);
  });

  it('with body fat (Katch-McArdle) differs from without (Mifflin-St Jeor) for same stats', () => {
    const without = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT });
    const withBF = calculateNutritionPlan({ ...BASE_SCENARIO_INPUT, bodyFatPercent: 22 });
    expect(withBF.bmr).not.toBe(without.bmr);
  });

  it('beginner gain projects more weight gain than advanced (same surplus)', () => {
    const base: NutritionCalculatorInput = {
      ...BASE_SCENARIO_INPUT,
      weightGoal: 'gain',
      weightKg: 80,
      activityLevel: 3,
    };
    const beginner = calculateNutritionPlan({ ...base, liftingExperience: 'beginner' });
    const advanced = calculateNutritionPlan({ ...base, liftingExperience: 'advanced' });
    // Same TDEE/target → same surplus; beginner has lower effective kcal/kg gain → more kg gained
    expect(beginner.projectedWeightKg).toBeGreaterThan(advanced.projectedWeightKg);
  });
});

// ---------------------------------------------------------------------------
// getMinCalories
// ---------------------------------------------------------------------------

describe('getMinCalories', () => {
  it('returns 1200 for female with no BMR', () => {
    expect(getMinCalories('female')).toBe(1200);
  });

  it('returns 1500 for male with no BMR', () => {
    expect(getMinCalories('male')).toBe(1500);
  });

  it('returns 1350 for other with no BMR', () => {
    expect(getMinCalories('other')).toBe(1350);
  });

  it('applies 80% BMR floor when it exceeds gender floor', () => {
    // female, BMR=2000 → 80% = 1600 > 1200 → floor = 1600
    expect(getMinCalories('female', 2000)).toBe(1600);
    // male, BMR=2000 → 80% = 1600 > 1500 → floor = 1600
    expect(getMinCalories('male', 2000)).toBe(1600);
  });

  it('uses gender floor when 80% BMR is below it', () => {
    // female, BMR=1000 → 80% = 800 < 1200 → floor = 1200
    expect(getMinCalories('female', 1000)).toBe(1200);
    // male, BMR=1500 → 80% = 1200 < 1500 → floor = 1500
    expect(getMinCalories('male', 1500)).toBe(1500);
  });

  it('returns rounded result', () => {
    // male, BMR=1876 → 80% = 1500.8 → rounded 1501 vs floor 1500 → 1501
    expect(getMinCalories('male', 1876)).toBe(Math.round(1876 * 0.8));
  });
});

// ---------------------------------------------------------------------------
// eatingPhaseToWeightGoal
// ---------------------------------------------------------------------------

describe('eatingPhaseToWeightGoal', () => {
  it('maps cut to lose', () => {
    expect(eatingPhaseToWeightGoal('cut')).toBe('lose');
  });

  it('maps bulk to gain', () => {
    expect(eatingPhaseToWeightGoal('bulk')).toBe('gain');
  });

  it('maps maintain to maintain', () => {
    expect(eatingPhaseToWeightGoal('maintain')).toBe('maintain');
  });
});

// ---------------------------------------------------------------------------
// getGainFatFraction
// ---------------------------------------------------------------------------

describe('getGainFatFraction', () => {
  it('returns 0.4 for beginner (60% lean gain)', () => {
    expect(getGainFatFraction('beginner')).toBe(0.4);
  });

  it('returns 0.5 for intermediate (50/50)', () => {
    expect(getGainFatFraction('intermediate')).toBe(0.5);
  });

  it('returns 0.6 for advanced (40% lean gain)', () => {
    expect(getGainFatFraction('advanced')).toBe(0.6);
  });

  it('returns 0.5 for undefined (defaults to intermediate)', () => {
    expect(getGainFatFraction(undefined)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveKcalPerKgGain
// ---------------------------------------------------------------------------

describe('getEffectiveKcalPerKgGain', () => {
  // CALORIES_BUILD_KG_FAT = 8840, CALORIES_BUILD_KG_MUSCLE = 3900

  it('calculates correctly for intermediate (50/50 split)', () => {
    // 0.5 * 8840 + 0.5 * 3900 = 4420 + 1950 = 6370
    expect(getEffectiveKcalPerKgGain('intermediate')).toBe(6370);
  });

  it('calculates correctly for beginner (40% fat / 60% lean)', () => {
    // 0.4 * 8840 + 0.6 * 3900 = 3536 + 2340 = 5876
    expect(getEffectiveKcalPerKgGain('beginner')).toBe(5876);
  });

  it('calculates correctly for advanced (60% fat / 40% lean)', () => {
    // 0.6 * 8840 + 0.4 * 3900 = 5304 + 1560 = 6864
    expect(getEffectiveKcalPerKgGain('advanced')).toBe(6864);
  });

  it('defaults to intermediate for undefined experience', () => {
    expect(getEffectiveKcalPerKgGain(undefined)).toBe(6370);
  });

  it('beginner has lowest kcal/kg (cheapest gains → most weight per surplus)', () => {
    expect(getEffectiveKcalPerKgGain('beginner')).toBeLessThan(getEffectiveKcalPerKgGain('intermediate'));
    expect(getEffectiveKcalPerKgGain('intermediate')).toBeLessThan(getEffectiveKcalPerKgGain('advanced'));
  });
});

// ---------------------------------------------------------------------------
// getEffectiveKcalPerKgWeightLoss
// ---------------------------------------------------------------------------

describe('getEffectiveKcalPerKgWeightLoss', () => {
  // RHO_FAT_KCAL_PER_KG = 39.5 * 239 = 9440.5

  it('returns RHO_FAT when deltaWeightKg is zero (no change)', () => {
    expect(getEffectiveKcalPerKgWeightLoss(20, 0)).toBe(39.5 * 239);
  });

  it('returns RHO_FAT when deltaWeightKg is positive (gaining)', () => {
    expect(getEffectiveKcalPerKgWeightLoss(20, 2)).toBe(39.5 * 239);
  });

  it('returns RHO_FAT when initialFatMassKg is zero', () => {
    expect(getEffectiveKcalPerKgWeightLoss(0, -5)).toBe(39.5 * 239);
  });

  it('returns a value within the clamped range [1000, 9500] for valid loss', () => {
    const result = getEffectiveKcalPerKgWeightLoss(16, -5);
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThanOrEqual(9500);
  });

  it('is lower than pure fat loss density when body composition is mixed', () => {
    // Mixed fat+lean loss is cheaper per kg than pure fat loss
    const result = getEffectiveKcalPerKgWeightLoss(16, -5);
    expect(result).toBeLessThan(39.5 * 239);
  });

  it('approaches pure fat density when initial fat mass is very large', () => {
    // Very obese person: mostly fat lost → approaches RHO_FAT
    const result = getEffectiveKcalPerKgWeightLoss(100, -5);
    expect(result).toBeGreaterThan(8000); // close to 9440.5
  });

  it('male and female give different results (different Forbes C)', () => {
    const male = getEffectiveKcalPerKgWeightLoss(16, -5, 'male');
    const female = getEffectiveKcalPerKgWeightLoss(16, -5, 'female');
    expect(male).not.toBe(female);
  });
});

// ---------------------------------------------------------------------------
// getWeightChangeComposition
// ---------------------------------------------------------------------------

describe('getWeightChangeComposition', () => {
  it('returns zeros for zero weight change', () => {
    const result = getWeightChangeComposition(16, 0);
    expect(result.fatChangeKg).toBe(0);
    expect(result.leanChangeKg).toBe(0);
  });

  it('splits gain by fat fraction for intermediate (50/50)', () => {
    // 2kg gain, intermediate: 1kg fat, 1kg lean
    const result = getWeightChangeComposition(16, 2, 'intermediate');
    expect(result.fatChangeKg).toBe(1.0);
    expect(result.leanChangeKg).toBe(1.0);
  });

  it('splits gain by fat fraction for beginner (40% fat)', () => {
    // 2kg gain, beginner: 0.8kg fat, 1.2kg lean
    const result = getWeightChangeComposition(16, 2, 'beginner');
    expect(result.fatChangeKg).toBe(0.8);
    expect(result.leanChangeKg).toBe(1.2);
  });

  it('splits gain by fat fraction for advanced (60% fat)', () => {
    // 2kg gain, advanced: 1.2kg fat, 0.8kg lean
    const result = getWeightChangeComposition(16, 2, 'advanced');
    expect(result.fatChangeKg).toBe(1.2);
    expect(result.leanChangeKg).toBe(0.8);
  });

  it('fat + lean equals total weight change for gain', () => {
    const result = getWeightChangeComposition(16, 3, 'intermediate');
    expect(result.fatChangeKg + result.leanChangeKg).toBeCloseTo(3, 1);
  });

  it('uses 75/25 fallback for loss when initialFatMassKg is zero', () => {
    const result = getWeightChangeComposition(0, -4);
    expect(result.fatChangeKg).toBe(-3.0);
    expect(result.leanChangeKg).toBe(-1.0);
  });

  it('both components are negative for weight loss', () => {
    const result = getWeightChangeComposition(16, -4);
    expect(result.fatChangeKg).toBeLessThan(0);
    expect(result.leanChangeKg).toBeLessThan(0);
  });

  it('fat + lean sum approximately equals total weight loss (Forbes)', () => {
    const result = getWeightChangeComposition(16, -4);
    expect(result.fatChangeKg + result.leanChangeKg).toBeCloseTo(-4, 1);
  });

  it('fat loss is larger share than lean loss for average body fat (Forbes)', () => {
    const result = getWeightChangeComposition(16, -4);
    expect(Math.abs(result.fatChangeKg)).toBeGreaterThan(Math.abs(result.leanChangeKg));
  });

  it('gender affects the fat/lean split during loss', () => {
    const male = getWeightChangeComposition(16, -4, 'intermediate', 'male');
    const female = getWeightChangeComposition(16, -4, 'intermediate', 'female');
    expect(male.fatChangeKg).not.toBe(female.fatChangeKg);
  });
});

// ---------------------------------------------------------------------------
// getCalorieAdjustment
// ---------------------------------------------------------------------------

describe('getCalorieAdjustment', () => {
  it('returns 0 for maintain', () => {
    expect(getCalorieAdjustment('maintain', 80)).toBe(0);
  });

  it('returns negative deficit for lose', () => {
    const adj = getCalorieAdjustment('lose', 80);
    expect(adj).toBeLessThan(0);
  });

  it('returns positive surplus for gain', () => {
    const adj = getCalorieAdjustment('gain', 80);
    expect(adj).toBeGreaterThan(0);
  });

  it('deficit is clamped to minimum -250 for very light person', () => {
    // 5.5 * 40 = 220 < 250 → clamped to -250
    expect(getCalorieAdjustment('lose', 40)).toBe(-250);
  });

  it('deficit is clamped to maximum -750 for very heavy person', () => {
    // 5.5 * 140 = 770 > 750 → clamped to -750
    expect(getCalorieAdjustment('lose', 140)).toBe(-750);
  });

  it('calculates unclamped deficit for typical weight (80kg)', () => {
    // 5.5 * 80 = 440, within [250, 750]
    expect(getCalorieAdjustment('lose', 80)).toBe(-440);
  });

  it('surplus is clamped to minimum 150 for very light person', () => {
    // 2.75 * 40 = 110 < 150 → clamped to 150
    expect(getCalorieAdjustment('gain', 40)).toBe(150);
  });

  it('surplus is clamped to maximum 400 for very heavy person', () => {
    // 2.75 * 160 = 440 > 400 → clamped to 400
    expect(getCalorieAdjustment('gain', 160)).toBe(400);
  });

  it('calculates unclamped surplus for typical weight (80kg)', () => {
    // 2.75 * 80 = 220, within [150, 400]
    expect(getCalorieAdjustment('gain', 80)).toBe(220);
  });
});

// ---------------------------------------------------------------------------
// computeWeightChangeFromCalorieDelta
// ---------------------------------------------------------------------------

describe('computeWeightChangeFromCalorieDelta', () => {
  it('returns 0 for zero delta', () => {
    expect(computeWeightChangeFromCalorieDelta(0, 80)).toBe(0);
  });

  it('returns positive kg for a calorie surplus', () => {
    const change = computeWeightChangeFromCalorieDelta(6370, 80, { liftingExperience: 'intermediate' });
    // 6370 / 6370 = 1.0 kg
    expect(change).toBeCloseTo(1.0, 5);
  });

  it('returns negative kg for a calorie deficit (no body fat)', () => {
    // -7700 / 7700 = -1.0 kg
    const change = computeWeightChangeFromCalorieDelta(-7700, 80);
    expect(change).toBeCloseTo(-1.0, 5);
  });

  it('uses Forbes model when body fat is valid for deficit', () => {
    const withBF = computeWeightChangeFromCalorieDelta(-7700, 80, {
      bodyFatPercent: 20,
      gender: 'male',
    });
    const withoutBF = computeWeightChangeFromCalorieDelta(-7700, 80);
    // Forbes gives a different kcal/kg than the default 7700
    expect(withBF).not.toBe(withoutBF);
  });

  it('uses experience-based build cost for surplus', () => {
    const beginner = computeWeightChangeFromCalorieDelta(5876, 80, { liftingExperience: 'beginner' });
    const advanced = computeWeightChangeFromCalorieDelta(5876, 80, { liftingExperience: 'advanced' });
    // 5876/5876=1 for beginner, 5876/6864<1 for advanced
    expect(beginner).toBeGreaterThan(advanced);
  });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('ACTIVITY_MULTIPLIERS has entries for levels 1–5', () => {
    expect(ACTIVITY_MULTIPLIERS[1]).toBe(1.2);
    expect(ACTIVITY_MULTIPLIERS[2]).toBe(1.375);
    expect(ACTIVITY_MULTIPLIERS[3]).toBe(1.55);
    expect(ACTIVITY_MULTIPLIERS[4]).toBe(1.725);
    expect(ACTIVITY_MULTIPLIERS[5]).toBe(1.9);
  });

  it('FORBES_C_MALE is greater than FORBES_C_FEMALE', () => {
    expect(FORBES_C_MALE).toBeGreaterThan(FORBES_C_FEMALE);
    expect(FORBES_C_MALE).toBe(13.8);
    expect(FORBES_C_FEMALE).toBe(10.4);
  });

  it('RMR constants are positive', () => {
    expect(RMR_LEAN_KCAL_PER_KG).toBe(13.0);
    expect(RMR_FAT_KCAL_PER_KG).toBe(4.5);
    expect(RMR_LEAN_KCAL_PER_KG).toBeGreaterThan(RMR_FAT_KCAL_PER_KG);
  });

  it('ADAPTIVE_THERMOGENESIS_KCAL_PER_KG is 20', () => {
    expect(ADAPTIVE_THERMOGENESIS_KCAL_PER_KG).toBe(20.0);
  });

  it('BODY_FAT_UNCERTAINTY is 4', () => {
    expect(BODY_FAT_UNCERTAINTY).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// planToInitialGoals
// ---------------------------------------------------------------------------

describe('planToInitialGoals', () => {
  const loseInput: NutritionCalculatorInput = {
    gender: 'male',
    weightKg: 83,
    heightCm: 180,
    age: 30,
    activityLevel: 3,
    weightGoal: 'lose',
    fitnessGoal: 'weight_loss',
    liftingExperience: 'intermediate',
  };

  it('maps totalCalories, macros, and targetWeight from plan', () => {
    const plan = calculateNutritionPlan(loseInput);
    const goals = planToInitialGoals(plan);

    expect(goals.totalCalories).toBe(plan.targetCalories);
    expect(goals.protein).toBe(plan.protein);
    expect(goals.carbs).toBe(plan.carbs);
    expect(goals.fats).toBe(plan.fats);
    expect(goals.targetWeight).toBe(plan.projectedWeightKg);
    expect(goals.targetDate).toBeNull();
  });

  it('calculates fiber via fiberFromCalories (not inline)', () => {
    const plan = calculateNutritionPlan(loseInput);
    const goals = planToInitialGoals(plan);
    expect(goals.fiber).toBe(fiberFromCalories(plan.targetCalories));
  });

  it('sets eatingPhase to cut when targetCalories < tdee', () => {
    const plan = calculateNutritionPlan(loseInput);
    expect(plan.targetCalories).toBeLessThan(plan.tdee);
    const goals = planToInitialGoals(plan);
    expect(goals.eatingPhase).toBe('cut');
  });

  it('sets eatingPhase to bulk when targetCalories > tdee', () => {
    const plan = calculateNutritionPlan({ ...loseInput, weightGoal: 'gain' });
    expect(plan.targetCalories).toBeGreaterThan(plan.tdee);
    const goals = planToInitialGoals(plan);
    expect(goals.eatingPhase).toBe('bulk');
  });

  it('sets eatingPhase to maintain when targetCalories equals tdee', () => {
    const plan = calculateNutritionPlan({ ...loseInput, weightGoal: 'maintain' });
    expect(plan.targetCalories).toBe(plan.tdee);
    const goals = planToInitialGoals(plan);
    expect(goals.eatingPhase).toBe('maintain');
  });

  it('maps optional body composition targets when available', () => {
    const plan = calculateNutritionPlan({ ...loseInput, bodyFatPercent: 20 });
    const goals = planToInitialGoals(plan);

    expect(goals.targetBodyFat).toBe(plan.targetBodyFat);
    expect(goals.targetBMI).toBe(plan.targetBMI);
    expect(goals.targetFFMI).toBe(plan.targetFFMI);
  });

  it('optional targets are undefined when plan has no body fat', () => {
    const plan = calculateNutritionPlan(loseInput);
    const goals = planToInitialGoals(plan);
    expect(goals.targetBodyFat).toBeUndefined();
    expect(goals.targetFFMI).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateWeeklyCheckins
// ---------------------------------------------------------------------------

describe('generateWeeklyCheckins', () => {
  const baseInput: NutritionCalculatorInput = {
    gender: 'male',
    weightKg: 80,
    heightCm: 175,
    age: 30,
    activityLevel: 3,
    weightGoal: 'lose',
    fitnessGoal: 'weight_loss',
    liftingExperience: 'intermediate',
  };

  // Use noon UTC timestamps to avoid timezone boundary issues
  const START_MS = new Date('2026-01-15T12:00:00.000Z').getTime();
  const DAY_MS = 86_400_000;

  it('returns empty array when period <= frequencyDays', () => {
    const plan = calculateNutritionPlan(baseInput);
    expect(generateWeeklyCheckins(plan, START_MS, START_MS + 7 * DAY_MS, 1.75, null)).toHaveLength(0);
    expect(generateWeeklyCheckins(plan, START_MS, START_MS + 6 * DAY_MS, 1.75, null)).toHaveLength(0);
  });

  it('returns one checkin for a 14-day period', () => {
    const plan = calculateNutritionPlan(baseInput);
    // totalCalendarDays=14, totalIntervals=2, loop interval 1 only → 1 checkin
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 14 * DAY_MS, 1.75, null);
    expect(checkins).toHaveLength(1);
  });

  it('returns three checkins for a 28-day period (weekly frequency)', () => {
    const plan = calculateNutritionPlan(baseInput);
    // totalCalendarDays=28, totalIntervals=4, loop interval 1..3 → 3 checkins
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null);
    expect(checkins).toHaveLength(3);
  });

  it('each checkin has required fields', () => {
    const plan = calculateNutritionPlan(baseInput);
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null);
    for (const checkin of checkins) {
      expect(checkin.checkinDate).toBeDefined();
      expect(typeof checkin.targetWeight).toBe('number');
    }
  });

  it('target weights move toward projected weight (losing)', () => {
    const plan = calculateNutritionPlan(baseInput);
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null);
    // Each checkin should have a lower target weight than the current
    for (const checkin of checkins) {
      expect(checkin.targetWeight).toBeLessThanOrEqual(baseInput.weightKg);
    }
    // And weights decrease monotonically
    for (let i = 1; i < checkins.length; i++) {
      expect(checkins[i].targetWeight).toBeLessThanOrEqual(checkins[i - 1].targetWeight);
    }
  });

  it('target weights move upward for a bulk plan', () => {
    const plan = calculateNutritionPlan({ ...baseInput, weightGoal: 'gain' });
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null);
    for (const checkin of checkins) {
      expect(checkin.targetWeight).toBeGreaterThanOrEqual(baseInput.weightKg);
    }
  });

  it('includes targetBodyFat when body fat is provided (cutting)', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, 20);
    expect(checkins.length).toBeGreaterThan(0);
    for (const checkin of checkins) {
      expect(checkin.targetBodyFat).toBeDefined();
      expect(checkin.targetBodyFat).toBeGreaterThan(0);
    }
  });

  it('includes targetBmi and targetFfmi when height and body fat are provided', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 20 });
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, 20);
    for (const checkin of checkins) {
      expect(checkin.targetBmi).toBeDefined();
      expect(checkin.targetFfmi).toBeDefined();
    }
  });

  it('omits targetBodyFat when currentBodyFatPercent is null', () => {
    const plan = calculateNutritionPlan(baseInput);
    const checkins = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null);
    for (const checkin of checkins) {
      expect(checkin.targetBodyFat).toBeUndefined();
    }
  });

  it('custom frequencyDays changes number of checkins', () => {
    const plan = calculateNutritionPlan(baseInput);
    const weekly = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null, 7);
    const biweekly = generateWeeklyCheckins(plan, START_MS, START_MS + 28 * DAY_MS, 1.75, null, 14);
    expect(weekly.length).toBeGreaterThan(biweekly.length);
  });
});
