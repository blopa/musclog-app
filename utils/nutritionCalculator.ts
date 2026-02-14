import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '../database/models/User';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface NutritionCalculatorInput {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: 1 | 2 | 3 | 4 | 5;
  /** User's body goal: drives calorie target (deficit / maintenance / surplus). */
  weightGoal: WeightGoal;
  /** Type of training: drives macro split and optional label nuance. */
  fitnessGoal: FitnessGoal;
  liftingExperience: LiftingExperience;
}

export interface NutritionPlan {
  /** Basal Metabolic Rate (kcal/day) */
  bmr: number;
  /** Total Daily Energy Expenditure (kcal/day) */
  tdee: number;
  /** Daily calorie target after goal adjustment (kcal/day) */
  targetCalories: number;
  /** Protein in grams */
  protein: number;
  /** Carbohydrates in grams */
  carbs: number;
  /** Fats in grams */
  fats: number;
  /** Protein as percentage of calories (0-100) */
  proteinPct: number;
  /** Carbs as percentage of calories (0-100) */
  carbsPct: number;
  /** Fats as percentage of calories (0-100) */
  fatsPct: number;
  /** Human-readable goal label key for i18n */
  goalLabel: string;
  /** Estimated weekly weight change in kg (negative = loss) */
  weeklyWeightChangeKg: number;
  /** Projected weight in kg after projectionDays */
  projectedWeightKg: number;
  /** Number of days for the projection */
  projectionDays: number;
  /** Current weight used in the calculation */
  currentWeightKg: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum safe calorie target (kcal/day) */
export const MIN_CALORIES = 1200;

/** Projection horizon in days */
const PROJECTION_DAYS = 90;

/** Approximate kcal per kg of body weight change (mixed fat + lean tissue) */
const KCAL_PER_KG = 7700;

/**
 * Standard TDEE activity multipliers (Harris-Benedict / Mifflin-St Jeor scale)
 */
export const ACTIVITY_MULTIPLIERS: Record<number, number> = {
  1: 1.2, // Sedentary
  2: 1.375, // Light (1-3 days/week)
  3: 1.55, // Moderate (3-5 days/week)
  4: 1.725, // Active (6-7 days/week)
  5: 1.9, // Super Active (physical job + training)
};

/**
 * Calorie adjustment (relative to TDEE) per weight goal.
 * Used for target calories; fitnessGoal is used for macro split only.
 * TODO: these must be calculated depending on the weight of the user
 */
const WEIGHT_GOAL_CALORIE_ADJUSTMENTS: Record<WeightGoal, number> = {
  lose: -500,
  maintain: 0,
  gain: 250,
};

/**
 * Human-readable i18n label key per weight goal (for results screen).
 */
const WEIGHT_GOAL_LABELS: Record<WeightGoal, string> = {
  lose: 'moderateWeightLoss',
  maintain: 'generalFitness',
  gain: 'leanBulk',
};

/**
 * Macro percentage splits per fitness goal: [carbsPct, proteinPct, fatsPct].
 * Based on standard sports-nutrition recommendations.
 */
const MACRO_SPLITS: Record<FitnessGoal, { carbsPct: number; proteinPct: number; fatsPct: number }> =
  {
    weight_loss: { carbsPct: 40, proteinPct: 30, fatsPct: 30 },
    endurance: { carbsPct: 55, proteinPct: 20, fatsPct: 25 },
    hypertrophy: { carbsPct: 45, proteinPct: 30, fatsPct: 25 },
    strength: { carbsPct: 50, proteinPct: 30, fatsPct: 20 },
    general: { carbsPct: 45, proteinPct: 25, fatsPct: 30 },
  };

// ---------------------------------------------------------------------------
// Step 1 – BMR (Mifflin-St Jeor Equation)
// ---------------------------------------------------------------------------

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 *
 * - Male:   10 * weightKg + 6.25 * heightCm - 5 * age + 5
 * - Female: 10 * weightKg + 6.25 * heightCm - 5 * age - 161
 * - Other:  Average of male and female formulas
 */
export function calculateBMR(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);

  // 'other': average of male and female = base + (5 + -161) / 2 = base - 78
  return Math.round(base - 78);
}

// ---------------------------------------------------------------------------
// Step 2 – TDEE
// ---------------------------------------------------------------------------

/**
 * Calculate Total Daily Energy Expenditure from BMR and activity level.
 */
export function calculateTDEE(bmr: number, activityLevel: number): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}

// ---------------------------------------------------------------------------
// Step 3 – Calorie target
// ---------------------------------------------------------------------------

/**
 * Calculate the daily calorie target by adjusting TDEE for the weight goal.
 * Applies a safety floor of MIN_CALORIES.
 */
export function calculateTargetCalories(tdee: number, weightGoal: WeightGoal): number {
  const adjustment = WEIGHT_GOAL_CALORIE_ADJUSTMENTS[weightGoal] ?? 0;
  return Math.max(MIN_CALORIES, Math.round(tdee + adjustment));
}

// ---------------------------------------------------------------------------
// Step 4 – Macros
// ---------------------------------------------------------------------------

export interface MacroSplit {
  protein: number;
  carbs: number;
  fats: number;
  proteinPct: number;
  carbsPct: number;
  fatsPct: number;
}

/**
 * Calculate macronutrient grams from target calories and the goal's percentage split.
 *
 * - Protein & carbs: 4 kcal per gram
 * - Fat: 9 kcal per gram
 */
export function calculateMacros(targetCalories: number, fitnessGoal: FitnessGoal): MacroSplit {
  const { carbsPct, proteinPct, fatsPct } = MACRO_SPLITS[fitnessGoal] ?? MACRO_SPLITS.general;

  return {
    protein: Math.round((targetCalories * proteinPct) / 100 / 4),
    carbs: Math.round((targetCalories * carbsPct) / 100 / 4),
    fats: Math.round((targetCalories * fatsPct) / 100 / 9),
    proteinPct,
    carbsPct,
    fatsPct,
  };
}

// ---------------------------------------------------------------------------
// Step 5 – Weight projection
// ---------------------------------------------------------------------------

export interface WeightProjection {
  weeklyWeightChangeKg: number;
  projectedWeightKg: number;
  projectionDays: number;
}

/**
 * Project weight change over PROJECTION_DAYS based on the calorie delta.
 */
export function calculateWeightProjection(
  currentWeightKg: number,
  targetCalories: number,
  tdee: number
): WeightProjection {
  const dailyDelta = targetCalories - tdee;
  const weeklyWeightChangeKg = (dailyDelta * 7) / KCAL_PER_KG;
  const projectedWeightKg = currentWeightKg + weeklyWeightChangeKg * (PROJECTION_DAYS / 7);

  return {
    weeklyWeightChangeKg: parseFloat(weeklyWeightChangeKg.toFixed(2)),
    projectedWeightKg: parseFloat(projectedWeightKg.toFixed(1)),
    projectionDays: PROJECTION_DAYS,
  };
}

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

export function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

// ---------------------------------------------------------------------------
// Legacy fitness goal normalizer (backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Normalize weight goal for backward compatibility (e.g. missing DB column).
 */
export function normalizeWeightGoal(raw: string | undefined): WeightGoal {
  if (!raw) return 'maintain';
  const lower = raw.toLowerCase();
  if (lower === 'lose') return 'lose';
  if (lower === 'gain') return 'gain';
  if (lower === 'maintain') return 'maintain';
  return 'maintain';
}

/**
 * Maps legacy translated fitness goal labels to the stable FitnessGoal enum key.
 * Falls back to 'general' if no match is found.
 */
export function normalizeFitnessGoal(raw: string): FitnessGoal {
  const lower = raw.toLowerCase();

  if (lower.includes('hypertrophy') || lower.includes('build muscle')) return 'hypertrophy';
  if (lower.includes('strength') || lower.includes('lift heavier')) return 'strength';
  if (lower.includes('endurance') || lower.includes('stamina')) return 'endurance';
  if (lower.includes('weight loss') || lower.includes('burn fat')) return 'weight_loss';
  if (lower.includes('general') || lower.includes('fitness')) return 'general';

  // Check if it's already a valid key
  const validKeys: FitnessGoal[] = [
    'hypertrophy',
    'strength',
    'endurance',
    'weight_loss',
    'general',
  ];
  if (validKeys.includes(raw as FitnessGoal)) return raw as FitnessGoal;

  return 'general';
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Calculate a complete nutrition plan from user inputs.
 *
 * This is a **pure function** with no side effects – it takes measurements
 * and preferences and returns a full NutritionPlan.
 *
 * Science basis:
 * - BMR: Mifflin-St Jeor equation (most accurate for modern populations)
 * - TDEE: Standard Harris-Benedict activity multipliers
 * - Calorie adjustment: ±250–500 kcal depending on goal
 * - Macros: Percentage-split method per goal type
 * - Projection: Linear model based on ~7700 kcal per kg
 */
export function calculateNutritionPlan(input: NutritionCalculatorInput): NutritionPlan {
  const { gender, weightKg, heightCm, age, activityLevel, weightGoal, fitnessGoal } = input;

  // Step 1 – BMR
  const bmr = calculateBMR(gender, weightKg, heightCm, age);

  // Step 2 – TDEE
  const tdee = calculateTDEE(bmr, activityLevel);

  // Step 3 – Calorie target (driven by weight goal: lose / maintain / gain)
  const targetCalories = calculateTargetCalories(tdee, weightGoal);

  // Step 4 – Macros (driven by fitness goal for split)
  const macros = calculateMacros(targetCalories, fitnessGoal);

  // Step 5 – Projection
  const projection = calculateWeightProjection(weightKg, targetCalories, tdee);

  // Goal label key (for i18n) – from weight goal
  const goalLabel = WEIGHT_GOAL_LABELS[weightGoal] ?? 'generalFitness';

  return {
    bmr,
    tdee,
    targetCalories,
    ...macros,
    goalLabel,
    ...projection,
    currentWeightKg: weightKg,
  };
}
