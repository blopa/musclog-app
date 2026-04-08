import convert from 'convert';
import { differenceInCalendarDays } from 'date-fns';

import { NutritionGoals } from '@/components/NutritionGoalsBody';
import type {
  EatingPhase,
  FitnessGoal,
  Gender,
  LiftingExperience,
  WeightGoal,
} from '@/database/models';

import { localDayKeyPlusCalendarDays, localDayStartFromUtcMs } from './calendarDate';

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

  // --- Empirical TDEE Tracking Data ---
  /** (Optional) Total calories consumed over a continuous tracking period */
  historicalTotalCalories?: number;
  /** (Optional) Number of days in the tracking period */
  historicalTotalDays?: number;
  /** (Optional) User's starting weight (kg) at the beginning of the period */
  historicalInitialWeightKg?: number;
  /** (Optional) User's ending weight (kg) at the end of the period */
  historicalFinalWeightKg?: number;
  /** (Optional) User's starting body fat % at the beginning of the period */
  historicalInitialFatPercent?: number;
  /** (Optional) User's ending body fat % at the end of the period */
  historicalFinalFatPercent?: number;
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
  /** Daily calorie deficit (cut); positive number. Undefined when not cutting. */
  dailyCalorieDeficit?: number;
  /** Daily calorie surplus (bulk); positive number. Undefined when not bulking. */
  dailyCalorieSurplus?: number;
  /** Estimated fat mass change over projection (kg; negative = loss). From Hall/Forbes when body fat available. */
  estimatedFatChangeKg?: number;
  /** Estimated lean mass change over projection (kg; negative = loss). From Hall/Forbes when body fat available. */
  estimatedLeanChangeKg?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Resting Metabolic Rate (RMR) specific tissue coefficients (kcal/kg/day).
 * Research: Elia (1992).
 */
export const RMR_LEAN_KCAL_PER_KG = 13.0;
export const RMR_FAT_KCAL_PER_KG = 4.5;

/**
 * Adaptive Thermogenesis coefficient (kcal/kg/day) per kg of total body mass lost.
 * Accounts for hormonal shifts (leptin, thyroid) and subconscious NEAT reduction.
 * Research: Müller et al. (2022), Hall et al. (NIH dynamic energy balance).
 */
export const ADAPTIVE_THERMOGENESIS_KCAL_PER_KG = 15.0;

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

/** Convert EatingPhase to WeightGoal for nutrition planning. */
export function eatingPhaseToWeightGoal(eatingPhase: EatingPhase): WeightGoal {
  switch (eatingPhase) {
    case 'cut':
      return 'lose';
    case 'bulk':
      return 'gain';
    case 'maintain':
    default:
      return 'maintain';
  }
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

/**
 * Fraction of weight gain that is fat (remainder = lean) by lifting experience.
 * Evidence: untrained show substantially greater hypertrophy effect sizes vs trained (Schoenfeld et al.;
 * resistance training load meta-analyses). Muscle growth plateau with chronic training (Sports Med.
 * 2023, “Plateau in Muscle Growth with Resistance Training”). Year-1 gains ~9–11 kg vs advanced ~2–3 kg/yr.
 * Beginner 40% fat / 60% lean; intermediate 50/50 (Smith et al. 2020, Slater et al. 2023); advanced 60/40.
 * When experience is undefined, defaults to intermediate (0.5).
 */
export function getGainFatFraction(liftingExperience?: LiftingExperience): number {
  switch (liftingExperience) {
    case 'beginner':
      return 0.4; // ~60% lean gain
    case 'advanced':
      return 0.6; // ~40% lean gain
    case 'intermediate':
    default:
      return 0.5; // 50/50
  }
}

/**
 * Effective kcal per kg of mixed weight gain (RT + moderate surplus), dependent on lifting experience.
 * Uses memo build costs (8840 fat, 3900 muscle) and getGainFatFraction for the split.
 */
export function getEffectiveKcalPerKgGain(liftingExperience?: LiftingExperience): number {
  const fatFraction = getGainFatFraction(liftingExperience);
  return fatFraction * CALORIES_BUILD_KG_FAT + (1 - fatFraction) * CALORIES_BUILD_KG_MUSCLE;
}

/** Principal branch of Lambert W, real arguments. Used for Hall–Forbes weight-loss composition. */
function lambertW(z: number): number {
  if (z < -1 / Math.E) {
    return NaN;
  }
  if (z === 0) {
    return 0;
  }
  let w = z < 1 ? z : Math.log(z);
  for (let i = 0; i < 30; i++) {
    const ew = Math.exp(w);
    const f = w * ew - z;
    if (Math.abs(f) < 1e-10) {
      return w;
    }
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
  if (dBw >= 0 || initialFatMassKg <= 0) {
    return RHO_FAT_KCAL_PER_KG;
  }
  const arg =
    (1 / FORBES_C) *
    Math.exp(dBw / FORBES_C) *
    initialFatMassKg *
    Math.exp(initialFatMassKg / FORBES_C);
  const w = lambertW(arg);
  if (Number.isNaN(w)) {
    return 7700;
  } // fallback
  const deltaLOverDeltaBW = 1 + initialFatMassKg / dBw - (FORBES_C / dBw) * w;
  const effective =
    RHO_FAT_KCAL_PER_KG * (1 - deltaLOverDeltaBW) + RHO_LEAN_KCAL_PER_KG * deltaLOverDeltaBW;
  return Math.max(1000, Math.min(9500, effective)); // clamp to plausible range
}

/** Default kcal per kg for weight loss when body composition unknown (7700 ≈ classic rule). */
const DEFAULT_KCAL_PER_KG_LOSS = 7700;

/**
 * Fat/lean split of a weight change (Hall/Forbes for loss; experience-dependent for gain).
 * initialFatMassKg = current fat mass (kg), deltaWeightKg = total weight change (negative for loss).
 */
export function getWeightChangeComposition(
  initialFatMassKg: number,
  deltaWeightKg: number,
  liftingExperience?: LiftingExperience
): { fatChangeKg: number; leanChangeKg: number } {
  if (deltaWeightKg === 0) {
    return { fatChangeKg: 0, leanChangeKg: 0 };
  }
  if (deltaWeightKg > 0) {
    const fatFraction = getGainFatFraction(liftingExperience);
    return {
      fatChangeKg: parseFloat((fatFraction * deltaWeightKg).toFixed(2)),
      leanChangeKg: parseFloat(((1 - fatFraction) * deltaWeightKg).toFixed(2)),
    };
  }
  // Loss: Hall/Forbes ΔFFM/ΔBW
  const dBw = deltaWeightKg;
  if (initialFatMassKg <= 0) {
    return {
      fatChangeKg: parseFloat((0.75 * deltaWeightKg).toFixed(2)),
      leanChangeKg: parseFloat((0.25 * deltaWeightKg).toFixed(2)),
    };
  }
  const arg =
    (1 / FORBES_C) *
    Math.exp(dBw / FORBES_C) *
    initialFatMassKg *
    Math.exp(initialFatMassKg / FORBES_C);
  const w = lambertW(arg);
  if (Number.isNaN(w)) {
    return {
      fatChangeKg: parseFloat((0.75 * deltaWeightKg).toFixed(2)),
      leanChangeKg: parseFloat((0.25 * deltaWeightKg).toFixed(2)),
    };
  }
  const deltaLOverDeltaBW = 1 + initialFatMassKg / dBw - (FORBES_C / dBw) * w;
  const leanChangeKg = parseFloat((deltaLOverDeltaBW * deltaWeightKg).toFixed(2));
  const fatChangeKg = parseFloat((deltaWeightKg - leanChangeKg).toFixed(2));
  return { fatChangeKg, leanChangeKg };
}

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
  if (weightGoal === 'maintain') {
    return 0;
  }
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
 *
 * These splits are derived from the following evidence-based sources:
 *
 * 1. **Institute of Medicine (IOM) Acceptable Macronutrient Distribution Ranges (AMDR)**:
 *    - Carbohydrates: 45–65% of total energy (DRI 2005)
 *    - Protein: 10–35% of total energy
 *    - Fat: 20–35% of total energy
 *    Source: Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. National Academies Press, 2005.
 *    https://doi.org/10.17226/10490
 *
 * 2. **International Society of Sports Nutrition (ISSN) Position Stand**: Protein and Exercise (2017)
 *    - Protein needs: 1.4–2.0 g/kg/day for most exercisers; higher during energy restriction
 *    - Higher protein intakes (≥2.3 g/kg FFM) maximize muscle retention during cuts
 *    Source: Jäger et al., J Int Soc Sports Nutr. 2017;14:20.
 *    https://pubmed.ncbi.nlm.nih.gov/28642676/
 *
 * 3. **ACSM/ADA/DC Joint Position Stand**: Nutrition and Athletic Performance (2016)
 *    - Endurance athletes: 6–10 g/kg/day carbohydrate for training
 *    - Resistance athletes: lower carbohydrate, moderate protein emphasis
 *    Source: Thomas et al., Med Sci Sports Exerc. 2016;48(3):543-568.
 *    https://pubmed.ncbi.nlm.nih.gov/26891166/
 *
 * 4. **Helms et al. (2014)**: Evidence-based recommendations for bodybuilders
 *    - During caloric restriction: 2.3–3.1 g/kg FFM protein recommended
 *    - Fat intake: 15–30% of calories to maintain hormonal function
 *    Source: Helms et al., J Sports Sci. 2014;32(18):1701-1711.
 *    https://pubmed.ncbi.nlm.nih.gov/25000063/
 *
 * Goal-specific reasoning:
 * - **weight_loss (40C/30P/30F)**: Higher protein (30%) aligns with ISSN/Helms
 *   recommendations for muscle preservation during caloric deficit. Moderate fat
 *   (30%) maintains hormonal function. Carbs adjusted to support deficit.
 * - **endurance (55C/20P/25F)**: Higher carbs (55%) approach the lower bound of
 *   ACSM recommendations (6–10 g/kg) for glycogen-demanding training. Lower
 *   protein sufficient for non-hypertrophy goals.
 * - **hypertrophy (45C/30P/25F)**: Balanced approach with protein at 30% to support
 *   muscle protein synthesis (1.6–2.2 g/kg for average body weights). Moderate
 *   carbs support training volume without excessive fat.
 * - **strength (50C/30P/20F)**: Emphasizes carbs (50%) for glycolytic demands of
 *   heavy compound lifting. Protein at 30% supports recovery. Fat at minimum IOM
 *   threshold (20%) to allow higher carb/protein priority.
 * - **general (45C/25P/30F)**: Centered within IOM AMDR. Protein at 25% provides
 *   ~1.2–1.6 g/kg for average adults, appropriate for general fitness.
 *
 * Important caveat: Percentage-based targets are less precise than absolute g/kg
 * recommendations. These splits assume typical body compositions; athletes with
 * outlier body weights may need gram-based adjustments (see ISSN position stand).
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

  if (gender === 'male') {
    return Math.round(base + 5);
  }
  if (gender === 'female') {
    return Math.round(base - 161);
  }

  // 'other': average of male and female = base + (5 + -161) / 2 = base - 78
  return Math.round(base - 78);
}

export interface TDEEParams {
  totalCalories?: number;
  totalDays?: number;
  initialWeight?: number;
  finalWeight?: number;
  initialFatPercentage?: number;
  finalFatPercentage?: number;
  bmr?: number;
  activityLevel?: number;
  liftingExperience?: LiftingExperience;
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 * * PRIORITIZES EMPIRICAL DATA (The "Adaptive" or "Observed" TDEE method)
 * By strictly applying the First Law of Thermodynamics, if we know total energy in (calories)
 * and total change in energy stores (weight/tissue fluctuation), we can perfectly
 * reverse-engineer the energy out (TDEE).
 * * Research Basis:
 * - Hall, K. D. (2008). What is the Required Energy Deficit per unit Weight Loss?
 * - Forbes, G. B. (1987). Human Body Composition: Growth, Aging, Nutrition, and Activity.
 * * If empirical tracking data is absent, falls back to standard population-based
 * statistical estimation (BMR * Activity Multiplier).
 */
export const calculateTDEE = (params: TDEEParams): number => {
  const {
    totalCalories,
    totalDays,
    initialWeight,
    finalWeight,
    initialFatPercentage,
    finalFatPercentage,
    bmr,
    activityLevel,
    liftingExperience,
  } = params;

  // 1. EMPIRICAL / OBSERVED TDEE
  // Execute only if we have sufficient historical tracking data
  if (
    totalDays !== undefined &&
    totalDays > 0 &&
    totalCalories !== undefined &&
    initialWeight !== undefined &&
    finalWeight !== undefined
  ) {
    const weightDifference = finalWeight - initialWeight;

    let fatDifference: number;
    let leanDifference: number;

    // If exact Body Fat % changes are tracked, calculate the exact lipid vs lean mass shift
    if (initialFatPercentage !== undefined && finalFatPercentage !== undefined) {
      const initialFatMass = (initialFatPercentage * initialWeight) / 100;
      const finalFatMass = (finalFatPercentage * finalWeight) / 100;

      fatDifference = finalFatMass - initialFatMass;
      leanDifference = weightDifference - fatDifference;
    } else {
      // If no exact body fat % data, leverage our advanced Forbes Curve / Experience partition models!
      const assumedInitialFatMass =
        initialWeight * (initialFatPercentage !== undefined ? initialFatPercentage / 100 : 0.25);

      const comp = getWeightChangeComposition(
        assumedInitialFatMass,
        weightDifference,
        liftingExperience
      );

      fatDifference = comp.fatChangeKg;
      leanDifference = comp.leanChangeKg;
    }

    // Apply specific thermodynamic constants based on tissue fate (Anabolism vs Catabolism)
    const leanCalories =
      leanDifference > 0
        ? leanDifference * CALORIES_BUILD_KG_MUSCLE
        : leanDifference * CALORIES_STORED_KG_MUSCLE;

    const fatCalories =
      fatDifference > 0
        ? fatDifference * CALORIES_BUILD_KG_FAT
        : fatDifference * CALORIES_STORED_KG_FAT;

    // TDEE = (Energy In - Energy Stored/Expended on Tissue) / Days
    // If tissue is lost, fatCalories/leanCalories are negative, effectively ADDING
    // the liberated energy back into the TDEE pool, which is physiologically accurate.
    const averageTdee = (totalCalories - (fatCalories + leanCalories)) / totalDays;

    // 1.1 TDEE Drift Correction
    // Since body weight/composition changes during the period, the averageTdee represents the
    // midpoint of the period. We adjust it to the final (current) state using a refined model:
    // 1. Resting Tissue Drop (Elia)
    // 2. Activity Multiplier Scaling (to account for reduced mechanical cost of movement)
    // 3. Adaptive Thermogenesis (mass-independent neuroendocrine/NEAT penalty)

    const multiplier =
      activityLevel !== undefined ? (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55) : 1.55;

    const restingDrop =
      (leanDifference / 2) * RMR_LEAN_KCAL_PER_KG + (fatDifference / 2) * RMR_FAT_KCAL_PER_KG;

    const activityScaledDrop = restingDrop * multiplier;

    const adaptivePenalty = (weightDifference / 2) * ADAPTIVE_THERMOGENESIS_KCAL_PER_KG;

    const totalDriftAdjustment = activityScaledDrop + adaptivePenalty;

    return Math.round(averageTdee + totalDriftAdjustment);
  }

  // 2. STATISTICAL FALLBACK
  // Used for new users or when tracking data is missing
  if (bmr && activityLevel) {
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
    return Math.round(bmr * multiplier);
  }

  return 0; // Failsafe
};

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
  liftingExperience?: LiftingExperience;
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
  const useBodyFat = isValidBodyFat(options?.bodyFatPercent);
  const bodyFatPercent = options?.bodyFatPercent ?? 0;

  let kcalPerKg: number;
  if (dailyDelta === 0) {
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
    // Surplus: use experience-dependent effective build cost (fat + muscle)
    kcalPerKg = getEffectiveKcalPerKgGain(options?.liftingExperience);
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
  return convert(lbs, 'lb').to('kg') as number;
}

export function inchesToCm(inches: number): number {
  return convert(inches, 'in').to('cm') as number;
}

// ---------------------------------------------------------------------------
// Legacy fitness goal normalizer (backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Normalize weight goal for backward compatibility (e.g. missing DB column).
 */
export function normalizeWeightGoal(raw: string | undefined): WeightGoal {
  if (!raw) {
    return 'maintain';
  }

  const lower = raw.toLowerCase();
  if (lower === 'lose') {
    return 'lose';
  }

  if (lower === 'gain') {
    return 'gain';
  }

  if (lower === 'maintain') {
    return 'maintain';
  }

  return 'maintain';
}

/**
 * Maps legacy translated fitness goal labels to the stable FitnessGoal enum key.
 * Falls back to 'general' if no match is found.
 */
export function normalizeFitnessGoal(raw: string): FitnessGoal {
  const lower = raw.toLowerCase();

  if (lower.includes('hypertrophy') || lower.includes('build muscle')) {
    return 'hypertrophy';
  }
  if (lower.includes('strength') || lower.includes('lift heavier')) {
    return 'strength';
  }
  if (lower.includes('endurance') || lower.includes('stamina')) {
    return 'endurance';
  }
  if (lower.includes('weight loss') || lower.includes('burn fat')) {
    return 'weight_loss';
  }
  if (lower.includes('general') || lower.includes('fitness')) {
    return 'general';
  }

  // Check if it's already a valid key
  const validKeys: FitnessGoal[] = [
    'hypertrophy',
    'strength',
    'endurance',
    'weight_loss',
    'general',
  ];
  if (validKeys.includes(raw as FitnessGoal)) {
    return raw as FitnessGoal;
  }

  return 'general';
}

/** Fiber (g): 14 g per 1000 kcal, clamped to 25–40 (IOM-style recommendation). */
export function fiberFromCalories(targetCalories: number): number {
  const fiber = (targetCalories / 1000) * 14;
  return Math.round(Math.max(25, Math.min(40, fiber)));
}

/** BMI = weight (kg) / height (m)². */
export function bmiFromWeightAndHeightM(weightKg: number, heightM: number): number {
  if (heightM <= 0) {
    return 0;
  }

  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

/** FFMI = fat-free mass (kg) / height (m)². FFM = weight × (1 − bodyFat%/100). */
export function ffmiFromWeightHeightAndBodyFat(
  weightKg: number,
  heightM: number,
  bodyFatPercent: number
): number {
  if (heightM <= 0) {
    return 0;
  }
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
// Weekly check-in generation
// ---------------------------------------------------------------------------

export interface WeeklyCheckinData {
  checkinDate: number;
  targetWeight: number;
  targetBodyFat: number;
  targetBmi: number;
  targetFfmi: number;
}

/**
 * Generate check-in data for a nutrition plan.
 * Creates intermediate targets for each interval between startDate and endDate.
 *
 * @param plan - The calculated nutrition plan with projection data
 * @param startDate - Start timestamp (typically Date.now())
 * @param endDate - End timestamp (the goal target date)
 * @param heightM - User's height in meters (for BMI/FFMI calculations)
 * @param currentBodyFatPercent - Current body fat percentage (null if unknown)
 * @param frequencyDays - How often to check in (default 7 days)
 * @returns Array of check-in data, one per interval (excluding final week which is the goal itself)
 */
export function generateWeeklyCheckins(
  plan: NutritionPlan,
  startDate: number,
  endDate: number,
  heightM: number,
  currentBodyFatPercent: number | null,
  frequencyDays: number = 7
): WeeklyCheckinData[] {
  const startDayKey = localDayStartFromUtcMs(startDate);
  const endDayKey = localDayStartFromUtcMs(endDate);
  const totalCalendarDays = Math.max(
    0,
    differenceInCalendarDays(new Date(endDayKey), new Date(startDayKey))
  );

  if (totalCalendarDays <= frequencyDays) {
    return [];
  }

  const totalIntervals = Math.floor(totalCalendarDays / frequencyDays);
  const checkins: WeeklyCheckinData[] = [];

  const currentWeightKg = plan.currentWeightKg;
  const dailyWeightChangeKg = plan.weeklyWeightChangeKg / 7;
  const isCutting = plan.targetCalories < plan.tdee;
  const isBulking = plan.targetCalories > plan.tdee;

  for (let interval = 1; interval < totalIntervals; interval++) {
    const checkinDate = localDayKeyPlusCalendarDays(startDayKey, interval * frequencyDays);
    const daysElapsed = interval * frequencyDays;
    const intermediateWeight = parseFloat(
      (currentWeightKg + dailyWeightChangeKg * daysElapsed).toFixed(1)
    );

    let intermediateBodyFat = 0;
    if (currentBodyFatPercent !== null && currentBodyFatPercent > 0) {
      if (isCutting) {
        intermediateBodyFat = estimateTargetBodyFatWhenCutting(
          currentWeightKg,
          intermediateWeight,
          currentBodyFatPercent
        );
      } else if (isBulking) {
        const weightGained = intermediateWeight - currentWeightKg;
        if (weightGained > 0) {
          const currentFatKg = currentWeightKg * (currentBodyFatPercent / 100);
          const fatFraction = getGainFatFraction(plan.liftingExperience);
          const fatGainedKg = weightGained * fatFraction;

          const newFatKg = currentFatKg + fatGainedKg;
          intermediateBodyFat = parseFloat(
            Math.max(0, Math.min(100, (newFatKg / intermediateWeight) * 100)).toFixed(1)
          );
        } else {
          intermediateBodyFat = currentBodyFatPercent;
        }
      } else {
        intermediateBodyFat = currentBodyFatPercent;
      }
    }

    const intermediateBmi = bmiFromWeightAndHeightM(intermediateWeight, heightM);
    const intermediateFfmi =
      intermediateBodyFat > 0
        ? ffmiFromWeightHeightAndBodyFat(intermediateWeight, heightM, intermediateBodyFat)
        : 0;

    checkins.push({
      checkinDate,
      targetWeight: intermediateWeight,
      targetBodyFat: intermediateBodyFat,
      targetBmi: intermediateBmi,
      targetFfmi: intermediateFfmi,
    });
  }

  return checkins;
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
 * - TDEE: Empirical thermodynamic model (if tracking data provided), else Harris-Benedict
 * - Calorie adjustment: ±250–500 kcal depending on goal
 * - Macros: Percentage-split method per goal type
 * - Projection: Hall/Forbes composition-aware model
 *
 * When body fat is provided (and empirical TDEE isn't overriding), a ±4% uncertainty
 * band is applied to produce `minTargetCalories` / `maxTargetCalories`.
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
    // Empirical tracking fields
    historicalTotalCalories,
    historicalTotalDays,
    historicalInitialWeightKg,
    historicalFinalWeightKg,
    historicalInitialFatPercent,
    historicalFinalFatPercent,
  } = input;

  const useBodyFat = isValidBodyFat(bodyFatPercent);

  // Step 1 – BMR (Katch-McArdle when body fat available, else Mifflin-St Jeor)
  const bmr = useBodyFat
    ? calculateBMRKatchMcArdle(weightKg, bodyFatPercent)
    : calculateBMR(gender, weightKg, heightCm, age);

  // Step 2 – TDEE
  // Uses empirical tracking data if available, otherwise falls back to BMR + Activity Level
  const sharedTdeeParams: TDEEParams = {
    bmr,
    activityLevel,
    liftingExperience: input.liftingExperience,
    totalCalories: historicalTotalCalories,
    totalDays: historicalTotalDays,
    initialWeight: historicalInitialWeightKg,
    finalWeight: historicalFinalWeightKg,
    initialFatPercentage: historicalInitialFatPercent,
    finalFatPercentage: historicalFinalFatPercent,
  };

  const tdee = calculateTDEE(sharedTdeeParams);

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
    liftingExperience: input.liftingExperience,
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
    const tdeeLow = calculateTDEE({ ...sharedTdeeParams, bmr: bmrLow });
    minTargetCalories = calculateTargetCalories(tdeeLow, weightGoal, {
      gender,
      bmr: bmrLow,
      weightKg,
      bodyFatPercent,
    });

    // Lower body fat → higher LBM → higher BMR (optimistic / max calories)
    const lowBF = Math.max(bodyFatPercent - BODY_FAT_UNCERTAINTY, 1);
    const bmrHigh = calculateBMRKatchMcArdle(weightKg, lowBF);
    const tdeeHigh = calculateTDEE({ ...sharedTdeeParams, bmr: bmrHigh });
    maxTargetCalories = calculateTargetCalories(tdeeHigh, weightGoal, {
      gender,
      bmr: bmrHigh,
      weightKg,
      bodyFatPercent,
    });
  }

  const dailyDelta = targetCalories - tdee;
  const dailyCalorieDeficit = dailyDelta < 0 ? Math.abs(dailyDelta) : undefined;
  const dailyCalorieSurplus = dailyDelta > 0 ? dailyDelta : undefined;

  const totalWeightChangeKg = projection.projectedWeightKg - weightKg;
  let estimatedFatChangeKg: number | undefined;
  let estimatedLeanChangeKg: number | undefined;
  if (totalWeightChangeKg !== 0) {
    const initialFatMassKg = useBodyFat ? weightKg * (bodyFatPercent! / 100) : weightKg * 0.25;
    const comp = getWeightChangeComposition(
      initialFatMassKg,
      totalWeightChangeKg,
      input.liftingExperience
    );
    estimatedFatChangeKg = comp.fatChangeKg;
    estimatedLeanChangeKg = comp.leanChangeKg;
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
    ...(dailyCalorieDeficit !== undefined && { dailyCalorieDeficit }),
    ...(dailyCalorieSurplus !== undefined && { dailyCalorieSurplus }),
    ...(estimatedFatChangeKg !== undefined && { estimatedFatChangeKg }),
    ...(estimatedLeanChangeKg !== undefined && { estimatedLeanChangeKg }),
  };
}
