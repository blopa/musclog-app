import type { FitnessGoal } from '@/database/models';
import type { ComebackAnswers } from '@/utils/comeback/comebackState';
import {
  calculateMacros,
  calculateNutritionPlan,
  fiberFromCalories,
  getMinCalories,
  type NutritionCalculatorInput,
} from '@/utils/nutritionCalculator';

/**
 * Nutrition targets for someone easing back in. The research this follows: eat regularly with protein
 * first, start AT maintenance, and only then take a small deficit (300–500 kcal) — never a crash diet
 * while training capacity is also being rebuilt. Pure, so the arithmetic runs in the Jest `node` project.
 *
 * Maintenance is the FORMULA TDEE for the first weeks, deliberately without the empirical estimate: the
 * weight trend interpolates across the gap from weigh-ins that can be two months old, and a detrained
 * body's expenditure is not what that history says.
 */

/** Energy is plentiful: the larger of the two deficits the research offers. */
export const COMEBACK_DEFICIT_PLENTY_KCAL = 500;
/** Some or little energy: the conservative end. */
export const COMEBACK_DEFICIT_GENTLE_KCAL = 300;
/** The week whose check-in OFFERS the deficit; before it the targets are maintenance. */
export const COMEBACK_DEFICIT_OFFER_WEEK = 2;

export type ComebackNutritionProfile = Pick<
  NutritionCalculatorInput,
  | 'gender'
  | 'weightKg'
  | 'heightCm'
  | 'age'
  | 'activityLevel'
  | 'liftingExperience'
  | 'fitnessGoal'
  | 'bodyFatPercent'
> & { goalWeightKg?: number };

export type ComebackNutritionStage = 'maintenance' | 'deficitOffer';

export type ComebackNutritionTargets = {
  stage: ComebackNutritionStage;
  maintenanceCalories: number;
  totalCalories: number;
  /** Positive kcal below maintenance; 0 at maintenance. */
  deficitCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  proteinLimited: boolean;
};

export function comebackDeficitKcal(answers: ComebackAnswers): number {
  return answers.energy === 'plenty' ? COMEBACK_DEFICIT_PLENTY_KCAL : COMEBACK_DEFICIT_GENTLE_KCAL;
}

/** Whether the person asked for fat loss at all (the only goal that ever gets a deficit). */
export function wantsComebackDeficit(answers: ComebackAnswers): boolean {
  return answers.nutritionGoal === 'loseSlowly';
}

/**
 * Where the nutrition half of the ramp is: maintenance until the week-2 check-in, then — only when
 * fat loss was asked for — a deficit that is OFFERED, never applied without a tap.
 */
export function nutritionStage(answers: ComebackAnswers, week: number): ComebackNutritionStage {
  return wantsComebackDeficit(answers) && week >= COMEBACK_DEFICIT_OFFER_WEEK
    ? 'deficitOffer'
    : 'maintenance';
}

/** 'keep' means "leave my targets alone", so there is nothing to compute or write. */
export function comebackChangesTargets(answers: ComebackAnswers): boolean {
  return answers.nutritionGoal !== 'keep';
}

function fitnessGoalFor(answers: ComebackAnswers, profile: ComebackNutritionProfile): FitnessGoal {
  if (answers.nutritionGoal === 'rebuild') {
    return 'hypertrophy';
  }

  // The weight_loss split exists for a cut; at maintenance the person's own training goal applies.
  return profile.fitnessGoal === 'weight_loss' && !wantsComebackDeficit(answers)
    ? 'general'
    : profile.fitnessGoal;
}

/**
 * The targets for one stage. `applyDeficit` is true only once the person accepted the offer; the
 * deficit is clamped to the calorie floor and silently dropped if maintenance is already at it.
 * Returns null when the answers say to keep the current targets.
 */
export function computeComebackTargets(
  profile: ComebackNutritionProfile,
  answers: ComebackAnswers,
  { applyDeficit }: { applyDeficit: boolean }
): ComebackNutritionTargets | null {
  if (!comebackChangesTargets(answers)) {
    return null;
  }

  const fitnessGoal = fitnessGoalFor(answers, profile);
  const plan = calculateNutritionPlan({
    ...profile,
    fitnessGoal,
    weightGoal: 'maintain',
  });

  let totalCalories = plan.targetCalories;
  if (applyDeficit && wantsComebackDeficit(answers)) {
    const floor = getMinCalories(profile.gender, plan.bmr);
    totalCalories = Math.min(
      plan.targetCalories,
      Math.max(floor, plan.targetCalories - comebackDeficitKcal(answers))
    );
  }

  const inDeficit = totalCalories < plan.targetCalories;
  const macros = calculateMacros(totalCalories, fitnessGoal, {
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent,
    heightCm: profile.heightCm,
    goalWeightKg: profile.goalWeightKg,
    weightGoal: inDeficit ? 'lose' : 'maintain',
  });

  return {
    stage: inDeficit ? 'deficitOffer' : 'maintenance',
    maintenanceCalories: plan.targetCalories,
    totalCalories,
    deficitCalories: plan.targetCalories - totalCalories,
    protein: macros.protein,
    carbs: macros.carbs,
    fats: macros.fats,
    fiber: fiberFromCalories(totalCalories),
    proteinLimited: macros.proteinLimited === true,
  };
}
