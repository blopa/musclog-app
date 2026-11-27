import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import {
  calculateNutritionPlan,
  eatingPhaseToWeightGoal,
  getMinCalories,
} from '@/utils/nutritionCalculator';

export type MealPlanMacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/** Height used for the on-the-spot plan when the person never entered one. */
const FALLBACK_HEIGHT_CM = 170;

/**
 * A generated meal plan never aims below the minimum Musclog recommends, even when a goal typed by
 * hand does, unless the person turned that minimum off in Advanced settings. Protein, carbs and fat
 * grow with the calories.
 */
async function atLeastMinimumCalories(
  targets: MealPlanMacroTargets
): Promise<MealPlanMacroTargets> {
  if (await SettingsService.getDisableMinimumCalories()) {
    return targets;
  }

  const user = await UserService.getCurrentUser();
  const minimum = getMinCalories(user?.gender ?? 'other');
  if (targets.calories >= minimum || targets.calories <= 0) {
    return targets;
  }

  const scale = minimum / targets.calories;

  return {
    calories: minimum,
    protein: Math.round(targets.protein * scale),
    carbs: Math.round(targets.carbs * scale),
    fat: Math.round(targets.fat * scale),
    fiber: targets.fiber,
  };
}

/**
 * The daily targets a generated meal plan aims for: the person's current goal as it resolves
 * today, else a plan calculated on the spot from their profile and latest weight. Undefined when
 * there is neither (no goal and no weigh-in), so the plan is generated without targets.
 */
export async function resolveMealPlanMacroTargets(): Promise<MealPlanMacroTargets | undefined> {
  const currentGoal = await NutritionGoalService.getCurrent();
  if (currentGoal) {
    const resolved = await NutritionTargetService.resolve(currentGoal, new Date());

    return atLeastMinimumCalories({
      calories: resolved?.totalCalories ?? currentGoal.totalCalories,
      protein: resolved?.protein ?? currentGoal.protein,
      carbs: resolved?.carbs ?? currentGoal.carbs,
      fat: resolved?.fats ?? currentGoal.fats,
      fiber: resolved?.fiber ?? currentGoal.fiber,
    });
  }

  const user = await UserService.getCurrentUser();
  const [latestWeight, latestHeight] = await Promise.all([
    UserMetricService.getLatest('weight'),
    UserMetricService.getLatest('height'),
  ]);
  if (!user || !latestWeight) {
    return undefined;
  }

  const disableMinimumCalories = await SettingsService.getDisableMinimumCalories();
  const { value: weightKg } = await latestWeight.getDecrypted();
  const heightCm = latestHeight ? (await latestHeight.getDecrypted()).value : FALLBACK_HEIGHT_CM;
  const plan = calculateNutritionPlan({
    gender: user.gender,
    weightKg,
    heightCm,
    age: user.getAge(),
    activityLevel: (user.activityLevel as any) || 2,
    weightGoal: user.weightGoal || eatingPhaseToWeightGoal(user.fitnessGoal as any),
    fitnessGoal: user.fitnessGoal,
    liftingExperience: user.liftingExperience,
    disableMinimumCalories,
  });

  return {
    calories: plan.targetCalories,
    protein: plan.protein,
    carbs: plan.carbs,
    fat: plan.fats,
    fiber: Math.round((plan.targetCalories / 1000) * 14),
  };
}
