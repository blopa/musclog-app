import { NutritionGoals } from '../components/NutritionGoalsBody';
import type {
  EatingPhase,
  FitnessGoal,
  Gender,
  LiftingExperience,
  WeightGoal,
} from '../database/models';

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
  /**
   * Optional body fat percentage (0–100). When provided and valid (5–60),
   * Katch-McArdle is used instead of Mifflin-St Jeor for BMR, and a ±4%
   * uncertainty band produces min/max calorie targets.
   */
  bodyFatPercent?: number;
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
  /**
   * Lower bound of calorie target when body fat is used (pessimistic LBM).
   * Undefined when body fat was not provided.
   */
  minTargetCalories?: number;
  /**
   * Upper bound of calorie target when body fat is used (optimistic LBM).
   * Undefined when body fat was not provided.
   */
  maxTargetCalories?: number;
  /** Target body fat % at projected weight (when computed from height/body fat). */
  targetBodyFat?: number;
  /** Target BMI at projected weight (when height available). */
  targetBMI?: number;
  /** Target FFMI at projected weight (when height and body fat available). */
  targetFFMI?: number;
  /** User's lifting experience (for maintenance messaging, e.g. muscle gain potential). */
  liftingExperience?: LiftingExperience;
  /** Goal date for cut/bulk phases (90 days from start). */
  goalDate?: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default minimum calorie floor when gender/BMR are not provided (backward compatibility).
 * Prefer getMinCalories(gender, bmr) when available.
 */
export const MIN_CALORIES = 1200;

/**
 * Evidence-based minimum daily calorie intake (IOM/National Academies; common practice 1200 female, 1500 male).
 * Never below 80% of BMR when BMR is provided, to avoid extreme restriction.
 */
export function getMinCalories(gender: Gender, bmr?: number): number {
  const genderFloor = gender === 'female' ? 1200 : gender === 'male' ? 1500 : 1350;
  const bmrFloor = bmr !== undefined ? bmr * 0.8 : 0;
  return Math.round(Math.max(genderFloor, bmrFloor));
}

/** Projection horizon in days */
const PROJECTION_DAYS = 90;

// Weight projection: loss uses Hall (2008) metabolizable energy of lost tissue (body-composition-aware when body fat % available);
// gain uses memo build costs (fat + muscle). Do not use build costs for loss or stored costs for gain.

// https://www.google.com/books/edition/The_Nutritionist/olIsBgAAQBAJ?hl=en&gbpv=1&pg=PA148&printsec=frontcover - 1% other, 5% water, 8% protein, 86% fat.
// https://www.sciencedirect.com/science/article/pii/S2212877815000599/#sectitle0050 - efficiency to build fat is ~77%.
// Established thermodynamic model for human adipose tissue:
// ~13% water/trace, 2% protein, 85% lipid.
// Thermodynamic efficiency to build fat from a standard dietary surplus is ~87.4% (7730 / 8840).
const CALORIES_STORED_KG_FAT = 7730; // amount of calories stored in 1kg of fat
const CALORIES_BUILD_KG_FAT = 8840; // amount of calories necessary to build 1kg of fat

// https://www.google.com/books/edition/The_Nutritionist/olIsBgAAQBAJ?hl=en&gbpv=1&pg=PA148&printsec=frontcover - 2% fat, 4% other, 24% protein, 70% water.
// https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8387577/#sec-10title - efficiency to build muscle is ~48%.
// Established thermodynamic model for human skeletal muscle:
// ~75% water/glycogen/trace, 20% protein, 5% intramuscular lipid.
// Thermodynamic efficiency to build muscle is ~32.05% (1250 / 3900).
const CALORIES_STORED_KG_MUSCLE = 1250; // amount of calories stored in 1kg of muscle
const CALORIES_BUILD_KG_MUSCLE = 3900; // amount of calories necessary to build 1kg of muscle

/** Hall (2008): metabolizable energy density of fat loss (MJ/kg → kcal/kg). Used for loss projection only. */
const RHO_FAT_KCAL_PER_KG = 39.5 * 239; // ~9440
/** Hall (2008): metabolizable energy density of lean mass change (MJ/kg → kcal/kg). Used for loss projection only. */
const RHO_LEAN_KCAL_PER_KG = 7.6 * 239; // ~1820
/** Forbes curve parameter (Hall 2007, PMC2376748); used in ΔFFM/ΔBW. */
const FORBES_C = 10.4;
/** Effective kcal per kg gained: 60% fat build + 40% muscle build (memo build costs). Used for gain projection only. */
const CALORIES_EFFECTIVE_KG_GAIN = 0.6 * CALORIES_BUILD_KG_FAT + 0.4 * CALORIES_BUILD_KG_MUSCLE; // ~6864

/** Principal branch of Lambert W, real arguments. Used for Hall–Forbes weight-loss composition. */
function lambertW(z: number): number {
  if (z < -1 / Math.E) return NaN;
  if (z === 0) return 0;
  let w = z < 1 ? z : Math.log(z);
  for (let i = 0; i < 30; i++) {
    const ew = Math.exp(w);
    const f = w * ew - z;
    if (Math.abs(f) < 1e-10) return w;
    const fp = ew * (w + 1);
    w = w - f / fp;
  }
  return w;
}

/**
 * Effective metabolizable energy (kcal) per kg of weight loss from Hall (2008) + Hall (2007) Forbes extension.
 * initialFatMassKg = current fat mass (kg), deltaWeightKg = planned weight change (negative for loss).
 * Returns kcal per kg so that (deficit in kcal) / (this value) = weight loss in kg.
 */
function getEffectiveKcalPerKgWeightLoss(initialFatMassKg: number, deltaWeightKg: number): number {
  const dBw = deltaWeightKg;
  if (dBw >= 0 || initialFatMassKg <= 0) return RHO_FAT_KCAL_PER_KG;
  const arg =
    (1 / FORBES_C) *
    Math.exp(dBw / FORBES_C) *
    initialFatMassKg *
    Math.exp(initialFatMassKg / FORBES_C);
  const w = lambertW(arg);
  if (Number.isNaN(w)) return 7700; // fallback
  const deltaLOverDeltaBW = 1 + initialFatMassKg / dBw - (FORBES_C / dBw) * w;
  const effective =
    RHO_FAT_KCAL_PER_KG * (1 - deltaLOverDeltaBW) + RHO_LEAN_KCAL_PER_KG * deltaLOverDeltaBW;
  return Math.max(1000, Math.min(9500, effective)); // clamp to plausible range
}

/** Default kcal per kg for weight loss when body composition unknown (7700 ≈ classic rule). */
const DEFAULT_KCAL_PER_KG_LOSS = 7700;

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
 * Default calorie adjustments when weight is not available (backward compatibility).
 */
const DEFAULT_CALORIE_ADJUSTMENTS: Record<WeightGoal, number> = {
  lose: -500,
  maintain: 0,
  gain: 250,
};

/**
 * Personalized calorie adjustment (relative to TDEE) from weight goal and body weight.
 * Based on ~0.5% body weight per week for loss, ~0.25% for gain (sustainable rates).
 * Clamped to safe bounds (deficit 250–750 kcal, surplus 150–400 kcal).
 */
export function getCalorieAdjustment(
  weightGoal: WeightGoal,
  weightKg: number,
  _bodyFatPercent?: number
): number {
  if (weightGoal === 'maintain') return 0;
  if (weightGoal === 'lose') {
    const deficit = 5.5 * weightKg; // 0.005 * weightKg * 7700 / 7
    return -Math.max(250, Math.min(750, Math.round(deficit)));
  }
  // gain
  const surplus = 2.75 * weightKg; // ~0.25% BW per week
  return Math.max(150, Math.min(400, Math.round(surplus)));
}

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

/**
 * Uncertainty band (± percentage points) applied to user-reported body fat.
 * Common measurement methods (BIA, skinfolds) have ~±3–5% error;
 * we use 4 as a middle-ground to produce a realistic calorie range.
 */
export const BODY_FAT_UNCERTAINTY = 4;

/** Valid body fat range for Katch-McArdle (percentage points). */
const BODY_FAT_MIN = 5;
const BODY_FAT_MAX = 60;

// ---------------------------------------------------------------------------
// Step 1a – BMR via Katch-McArdle (when body fat % is available)
// ---------------------------------------------------------------------------

/**
 * Calculate Basal Metabolic Rate using the Katch-McArdle equation.
 *
 * BMR = 370 + 21.6 × LBM (kg)
 * where LBM = weightKg × (1 − bodyFatPercent / 100)
 *
 * Preferred over Mifflin-St Jeor when a reliable body fat estimate exists.
 */
export function calculateBMRKatchMcArdle(weightKg: number, bodyFatPercent: number): number {
  const leanBodyMass = weightKg * (1 - bodyFatPercent / 100);
  return Math.round(370 + 21.6 * leanBodyMass);
}

/**
 * Returns true if the given body fat percentage is within a valid range
 * for use with Katch-McArdle.
 */
export function isValidBodyFat(bodyFatPercent: number | undefined): bodyFatPercent is number {
  return (
    bodyFatPercent !== undefined &&
    bodyFatPercent !== null &&
    bodyFatPercent >= BODY_FAT_MIN &&
    bodyFatPercent <= BODY_FAT_MAX
  );
}

// ---------------------------------------------------------------------------
// Step 1b – BMR via Mifflin-St Jeor (default, no body fat required)
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

export interface TargetCaloriesOptions {
  gender?: Gender;
  bmr?: number;
  weightKg?: number;
  bodyFatPercent?: number;
}

/**
 * Calculate the daily calorie target by adjusting TDEE for the weight goal.
 * Applies a safety floor via getMinCalories when gender/bmr provided, else MIN_CALORIES.
 */
export function calculateTargetCalories(
  tdee: number,
  weightGoal: WeightGoal,
  options?: TargetCaloriesOptions
): number {
  const adjustment =
    options?.weightKg !== undefined && options.weightKg > 0
      ? getCalorieAdjustment(weightGoal, options.weightKg, options.bodyFatPercent)
      : (DEFAULT_CALORIE_ADJUSTMENTS[weightGoal] ?? 0);
  const floor =
    options?.gender !== undefined ? getMinCalories(options.gender, options.bmr) : MIN_CALORIES;
  return Math.max(floor, Math.round(tdee + adjustment));
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

export interface WeightProjectionOptions {
  bodyFatPercent?: number;
  weightGoal?: WeightGoal;
}

/**
 * Project weight change over PROJECTION_DAYS based on the calorie delta.
 * When body fat % and weight goal are provided: loss uses Hall/Forbes effective kcal per kg (composition-aware);
 * gain uses effective build cost (fat + muscle). Otherwise uses 7700 kcal/kg for loss, 7730 for gain (legacy).
 */
export function calculateWeightProjection(
  currentWeightKg: number,
  targetCalories: number,
  tdee: number,
  options?: WeightProjectionOptions
): WeightProjection {
  const dailyDelta = targetCalories - tdee;
  const weightGoal = options?.weightGoal;
  const useBodyFat = isValidBodyFat(options?.bodyFatPercent);
  const bodyFatPercent = options?.bodyFatPercent ?? 0;

  let kcalPerKg: number;
  if (dailyDelta === 0) {
    const weeklyWeightChangeKg = 0;
    return {
      weeklyWeightChangeKg: 0,
      projectedWeightKg: parseFloat(currentWeightKg.toFixed(1)),
      projectionDays: PROJECTION_DAYS,
    };
  }
  if (dailyDelta < 0) {
    // Deficit: use composition-aware effective kcal per kg when body fat available (Hall/Forbes)
    if (useBodyFat) {
      const initialFatMassKg = currentWeightKg * (bodyFatPercent / 100);
      const roughDeltaKg = (dailyDelta * 90) / DEFAULT_KCAL_PER_KG_LOSS; // plausible ΔBW over 90 days
      kcalPerKg = getEffectiveKcalPerKgWeightLoss(initialFatMassKg, roughDeltaKg);
    } else {
      kcalPerKg = DEFAULT_KCAL_PER_KG_LOSS;
    }
  } else {
    // Surplus: use effective build cost (fat + muscle)
    kcalPerKg = CALORIES_EFFECTIVE_KG_GAIN;
  }

  const weeklyWeightChangeKg = (dailyDelta * 7) / kcalPerKg;
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

/** Fiber (g): 14 g per 1000 kcal, clamped to 25–40 (IOM-style recommendation). */
export function fiberFromCalories(targetCalories: number): number {
  const fiber = (targetCalories / 1000) * 14;
  return Math.round(Math.max(25, Math.min(40, fiber)));
}

/** BMI = weight (kg) / height (m)². */
export function bmiFromWeightAndHeightM(weightKg: number, heightM: number): number {
  if (heightM <= 0) return 0;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

/** FFMI = fat-free mass (kg) / height (m)². FFM = weight × (1 − bodyFat%/100). */
export function ffmiFromWeightHeightAndBodyFat(
  weightKg: number,
  heightM: number,
  bodyFatPercent: number
): number {
  if (heightM <= 0) return 0;
  const ffm = weightKg * (1 - bodyFatPercent / 100);
  return parseFloat((ffm / (heightM * heightM)).toFixed(1));
}

/**
 * Estimate target body fat % when cutting: assume ~70% of weight lost is fat mass.
 * Returns 0 if not cutting or missing data.
 */
export function estimateTargetBodyFatWhenCutting(
  currentWeightKg: number,
  projectedWeightKg: number,
  currentBodyFatPercent: number
): number {
  const weightLost = currentWeightKg - projectedWeightKg;
  if (weightLost <= 0) {
    return 0;
  }

  const fatLostKg = 0.7 * weightLost;
  const currentFatKg = currentWeightKg * (currentBodyFatPercent / 100);
  const targetFatKg = Math.max(0, currentFatKg - fatLostKg);
  const targetBodyFat = (targetFatKg / projectedWeightKg) * 100;
  return parseFloat(Math.max(0, Math.min(100, targetBodyFat)).toFixed(1));
}

/** Map a stored NutritionPlan to initial form data (Partial<NutritionGoals>). */
export function planToInitialGoals(plan: NutritionPlan): Partial<NutritionGoals> {
  const fiber = Math.round(Math.max(25, Math.min(40, (plan.targetCalories / 1000) * 14)));
  const eatingPhase: EatingPhase =
    plan.targetCalories < plan.tdee ? 'cut' : plan.targetCalories > plan.tdee ? 'bulk' : 'maintain';
  return {
    totalCalories: plan.targetCalories,
    protein: plan.protein,
    carbs: plan.carbs,
    fats: plan.fats,
    fiber,
    eatingPhase,
    targetWeight: plan.projectedWeightKg,
    targetBodyFat: plan.targetBodyFat ?? 0,
    targetBMI: plan.targetBMI ?? 0,
    targetFFMI: plan.targetFFMI ?? 0,
    targetDate: null,
  };
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
 * - BMR: Katch-McArdle (when body fat is available) or Mifflin-St Jeor
 * - TDEE: Standard Harris-Benedict activity multipliers
 * - Calorie adjustment: ±250–500 kcal depending on goal
 * - Macros: Percentage-split method per goal type
 * - Projection: Linear model based on ~7700 kcal per kg
 *
 * When body fat is provided, a ±4% uncertainty band is applied to produce
 * `minTargetCalories` / `maxTargetCalories` reflecting measurement error.
 */
export function calculateNutritionPlan(input: NutritionCalculatorInput): NutritionPlan {
  const {
    gender,
    weightKg,
    heightCm,
    age,
    activityLevel,
    weightGoal,
    fitnessGoal,
    bodyFatPercent,
  } = input;

  const useBodyFat = isValidBodyFat(bodyFatPercent);

  // Step 1 – BMR (Katch-McArdle when body fat available, else Mifflin-St Jeor)
  const bmr = useBodyFat
    ? calculateBMRKatchMcArdle(weightKg, bodyFatPercent)
    : calculateBMR(gender, weightKg, heightCm, age);

  // Step 2 – TDEE
  const tdee = calculateTDEE(bmr, activityLevel);

  // Step 3 – Calorie target (driven by weight goal: lose / maintain / gain)
  const targetCalories = calculateTargetCalories(tdee, weightGoal, {
    gender,
    bmr,
    weightKg,
    bodyFatPercent,
  });

  // Step 4 – Macros (driven by fitness goal for split)
  const macros = calculateMacros(targetCalories, fitnessGoal);

  // Step 5 – Projection
  const projection = calculateWeightProjection(weightKg, targetCalories, tdee, {
    bodyFatPercent,
    weightGoal,
  });

  // Goal label key (for i18n) – from weight goal
  const goalLabel = WEIGHT_GOAL_LABELS[weightGoal] ?? 'generalFitness';

  // Step 6 – Uncertainty range (only when body fat is used)
  let minTargetCalories: number | undefined;
  let maxTargetCalories: number | undefined;

  if (useBodyFat) {
    // Higher body fat → lower LBM → lower BMR (pessimistic / min calories)
    const highBF = Math.min(bodyFatPercent + BODY_FAT_UNCERTAINTY, 99);
    const bmrLow = calculateBMRKatchMcArdle(weightKg, highBF);
    const tdeeLow = calculateTDEE(bmrLow, activityLevel);
    minTargetCalories = calculateTargetCalories(tdeeLow, weightGoal, {
      gender,
      bmr: bmrLow,
      weightKg,
      bodyFatPercent,
    });

    // Lower body fat → higher LBM → higher BMR (optimistic / max calories)
    const lowBF = Math.max(bodyFatPercent - BODY_FAT_UNCERTAINTY, 1);
    const bmrHigh = calculateBMRKatchMcArdle(weightKg, lowBF);
    const tdeeHigh = calculateTDEE(bmrHigh, activityLevel);
    maxTargetCalories = calculateTargetCalories(tdeeHigh, weightGoal, {
      gender,
      bmr: bmrHigh,
      weightKg,
      bodyFatPercent,
    });
  }

  return {
    bmr,
    tdee,
    targetCalories,
    ...macros,
    goalLabel,
    ...projection,
    currentWeightKg: weightKg,
    liftingExperience: input.liftingExperience,
    ...(minTargetCalories !== undefined && { minTargetCalories }),
    ...(maxTargetCalories !== undefined && { maxTargetCalories }),
  };
}
