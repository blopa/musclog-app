import type { Units } from '@/constants/settings';
import type { FitnessGoal } from '@/database/models';
import {
  bodyweightProtein,
  PROTEIN_G_PER_KG_BODYWEIGHT,
  PROTEIN_G_PER_KG_BODYWEIGHT_IN_DEFICIT,
} from '@/utils/nutritionCalculator';
import { displayToCm, displayToKg } from '@/utils/unitConversion';

import { isInRange, parseToolNumber } from './toolNumbers';

/** The goals the calculator offers, in the order the page lists them. */
export const PROTEIN_GOALS: readonly FitnessGoal[] = [
  'hypertrophy',
  'strength',
  'general',
  'endurance',
  'weight_loss',
];

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;

export interface ProteinInput {
  units: Units;
  weightText: string;
  heightText: string;
  goal: FitnessGoal;
  /** True when the visitor is eating in a calorie deficit (cutting). */
  deficit: boolean;
  /** Optional goal weight, in the same units as the body weight. Empty means none. */
  goalWeightText: string;
}

export type ProteinProblem = 'weight' | 'height' | 'goalWeight';

export interface ProteinPlan {
  /** Daily protein, rounded to whole grams, exactly as the app computes it. */
  grams: number;
  /** The g/kg the goal asks for (raised to the deficit minimum when cutting). */
  gramsPerKg: number;
  /** The weight the g/kg is applied to, in kg. */
  referenceWeightKg: number;
  /** The body weight the visitor typed, in kg. */
  weightKg: number;
  /** True when the body weight was capped at the BMI-30 reference (no goal weight set). */
  capped: boolean;
  /** True when a deficit raised the goal's g/kg to the deficit minimum. */
  raisedByDeficit: boolean;
  /** The g/kg each goal asks for, straight from the app's table (no deficit adjustment). */
  table: { goal: FitnessGoal; gramsPerKg: number }[];
}

export type ProteinValidation =
  { ok: true; plan: ProteinPlan } | { ok: false; problem: ProteinProblem | null };

/**
 * Reads the form and computes daily protein with the app's own `bodyweightProtein`, so the page
 * and the app cannot disagree. `problem: null` means a required field is still empty.
 */
export function proteinPlan(input: ProteinInput): ProteinValidation {
  if (input.weightText.trim() === '' || input.heightText.trim() === '') {
    return { ok: false, problem: null };
  }

  const weightDisplay = parseToolNumber(input.weightText);
  const heightDisplay = parseToolNumber(input.heightText);
  if (weightDisplay === null) {
    return { ok: false, problem: 'weight' };
  }

  if (heightDisplay === null) {
    return { ok: false, problem: 'height' };
  }

  const weightKg = displayToKg(weightDisplay, input.units);
  const heightCm = displayToCm(heightDisplay, input.units);
  if (!isInRange(weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG)) {
    return { ok: false, problem: 'weight' };
  }

  if (!isInRange(heightCm, MIN_HEIGHT_CM, MAX_HEIGHT_CM)) {
    return { ok: false, problem: 'height' };
  }

  let goalWeightKg: number | undefined;
  if (input.goalWeightText.trim() !== '') {
    const goalDisplay = parseToolNumber(input.goalWeightText);
    const goalKg = goalDisplay === null ? null : displayToKg(goalDisplay, input.units);
    if (goalKg === null || !isInRange(goalKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG)) {
      return { ok: false, problem: 'goalWeight' };
    }

    goalWeightKg = goalKg;
  }

  const weightGoal = input.deficit || input.goal === 'weight_loss' ? 'lose' : 'maintain';
  const result = bodyweightProtein(input.goal, weightKg, {
    heightCm,
    goalWeightKg,
    weightGoal,
  });

  return {
    ok: true,
    plan: {
      grams: result.grams,
      gramsPerKg: result.gramsPerKg,
      referenceWeightKg: result.referenceWeightKg,
      weightKg,
      capped: goalWeightKg === undefined && result.referenceWeightKg < weightKg,
      raisedByDeficit:
        weightGoal === 'lose' &&
        PROTEIN_G_PER_KG_BODYWEIGHT[input.goal] < PROTEIN_G_PER_KG_BODYWEIGHT_IN_DEFICIT,
      table: PROTEIN_GOALS.map((goal) => ({
        goal,
        gramsPerKg: PROTEIN_G_PER_KG_BODYWEIGHT[goal],
      })),
    },
  };
}
