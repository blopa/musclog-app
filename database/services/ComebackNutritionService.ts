import type { EatingPhase } from '@/database/models';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { localDayStartMs } from '@/utils/calendarDate';
import {
  type ComebackNutritionProfile,
  type ComebackNutritionTargets,
  computeComebackTargets,
  wantsComebackDeficit,
} from '@/utils/comeback/comebackNutrition';
import type { ComebackAnswers, ComebackTrackingDepth } from '@/utils/comeback/comebackState';
import {
  binaryToSelectedMacros,
  NUTRITION_DISPLAY_ALL,
  NUTRITION_DISPLAY_PROTEIN_ONLY,
} from '@/utils/nutritionDisplay';
import { getCurrentTimezone } from '@/utils/timezone';
import { storedHeightToCm, storedWeightToKg } from '@/utils/unitConversion';

type TargetNumbers = Pick<
  ComebackNutritionTargets,
  'totalCalories' | 'protein' | 'carbs' | 'fats' | 'fiber'
>;

export type ComebackNutritionResult =
  /** The goal now holds `after`; `before` is what it held (null when there was no goal). */
  | { status: 'applied'; before: TargetNumbers | null; after: ComebackNutritionTargets }
  /** "Keep my current targets", or nothing to change. */
  | { status: 'unchanged' }
  /** No profile (weight, height, user) to calculate from. */
  | { status: 'noProfile' }
  /** The targets were changed by someone else since setup (a Weekly Review): left alone. */
  | { status: 'changedSince' };

/**
 * The nutrition half of a comeback: targets that start at maintenance and only later take a small,
 * offered deficit, and the gentler ways to track in the meantime.
 *
 * Every target write goes through `NutritionGoalService` — `updateGoal` for an existing goal, which
 * closes and creates the target period in one batch, `saveGoals` when there is none yet. Comeback
 * never writes periods itself: a second period writer is how targets end up disagreeing.
 */
export class ComebackNutritionService {
  /** What the targets are calculated from, or null when the user has no weight/height yet. */
  static async loadProfile(): Promise<ComebackNutritionProfile | null> {
    const [user, weight, height, bodyFat, useBodyFat, goal] = await Promise.all([
      UserService.getCurrentUser(),
      UserMetricService.getLatest('weight'),
      UserMetricService.getLatest('height'),
      UserMetricService.getLatest('body_fat'),
      SettingsService.getUseBfForCalculations(),
      NutritionGoalService.getCurrent(),
    ]);
    if (!user || !weight || !height) {
      return null;
    }

    const [weightValue, heightValue, bodyFatValue] = await Promise.all([
      weight.getDecrypted(),
      height.getDecrypted(),
      bodyFat && useBodyFat ? bodyFat.getDecrypted() : null,
    ]);
    const targetWeightKg = goal?.targetWeight ? goal.targetWeight : undefined;

    return {
      gender: user.gender,
      weightKg: storedWeightToKg(weightValue.value, weightValue.unit),
      heightCm: storedHeightToCm(heightValue.value, heightValue.unit),
      age: user.getAge(),
      activityLevel: (user.activityLevel || 2) as ComebackNutritionProfile['activityLevel'],
      liftingExperience: user.liftingExperience,
      fitnessGoal: user.fitnessGoal,
      bodyFatPercent: bodyFatValue?.value,
      goalWeightKg: targetWeightKg,
    };
  }

  /** The latest weigh-in in kilograms and when it was logged, for the "80 kg, 4 months ago" line. */
  static async latestWeight(): Promise<{ weightKg: number; date: number } | null> {
    const metric = await UserMetricService.getLatest('weight');
    if (!metric) {
      return null;
    }

    const value = await metric.getDecrypted();

    return { weightKg: storedWeightToKg(value.value, value.unit), date: metric.date };
  }

  /** Logs a weigh-in for today (kilograms) and returns it, so it can serve as day 1. */
  static async logTodayWeight(weightKg: number): Promise<void> {
    await UserMetricService.createMetric({
      type: 'weight',
      value: weightKg,
      unit: 'kg',
      date: Date.now(),
      timezone: getCurrentTimezone(),
    });
  }

  /** What the targets would be, without writing anything (the plan summary and the week-2 offer). */
  static async preview(
    answers: ComebackAnswers,
    options: { applyDeficit: boolean }
  ): Promise<ComebackNutritionTargets | null> {
    const profile = await this.loadProfile();

    return profile ? computeComebackTargets(profile, answers, options) : null;
  }

  /**
   * Writes the targets for `answers`. Setup calls it with `applyDeficit: false` (maintenance first);
   * the week-2 check-in calls it again with `true` once the person accepts. The second call first
   * checks the goal still holds what setup wrote, and stands down if a Weekly Review has changed it.
   */
  static async apply(
    answers: ComebackAnswers,
    { applyDeficit }: { applyDeficit: boolean }
  ): Promise<ComebackNutritionResult> {
    const profile = await this.loadProfile();
    if (!profile) {
      return { status: 'noProfile' };
    }

    const after = computeComebackTargets(profile, answers, { applyDeficit });
    if (!after) {
      return { status: 'unchanged' };
    }

    const goal = await NutritionGoalService.getCurrent();
    let before: TargetNumbers | null = null;
    if (goal) {
      const resolved = await NutritionTargetService.resolve(goal);
      before = {
        totalCalories: resolved.totalCalories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fats: resolved.fats,
        fiber: resolved.fiber,
      };
      if (applyDeficit) {
        const state = await SettingsService.getComebackState();
        const applied = state.appliedTargets;
        if (applied && Math.round(resolved.totalCalories) !== Math.round(applied.totalCalories)) {
          return { status: 'changedSince' };
        }
      }
    }

    const targets = {
      totalCalories: after.totalCalories,
      protein: after.protein,
      carbs: after.carbs,
      fats: after.fats,
      fiber: after.fiber,
      eatingPhase: (after.deficitCalories > 0 ? 'cut' : 'maintain') as EatingPhase,
    };
    if (goal) {
      await NutritionGoalService.updateGoal(goal.id, { ...targets, targetMode: 'weekly' });
    } else {
      await NutritionGoalService.saveGoals({ ...targets, targetMode: 'weekly' });
    }

    await SettingsService.updateComebackState({
      appliedTargets: { totalCalories: after.totalCalories, at: localDayStartMs(new Date()) },
    });

    return { status: 'applied', before, after };
  }

  /** Whether the answers ask for a deficit at all, i.e. whether week 2 has anything to offer. */
  static wantsDeficit(answers: ComebackAnswers): boolean {
    return wantsComebackDeficit(answers);
  }

  /**
   * One-tap tracking depth. These are plain, reversible preferences the person flips on purpose; they
   * are never switched silently and never restored automatically.
   *  - `mealsOnly`: intuitive-eating mode, so the diary lists meals without numbers.
   *  - `caloriesProtein`: numbers back on, with protein the only macro shown.
   *  - `full`: numbers on, every macro shown.
   */
  static async setTrackingDepth(depth: ComebackTrackingDepth): Promise<void> {
    if (depth === 'mealsOnly') {
      await SettingsService.setIntuitiveEatingMode(true);

      return;
    }

    await SettingsService.setIntuitiveEatingMode(false);
    await SettingsService.setNutritionDisplay(
      depth === 'caloriesProtein' ? NUTRITION_DISPLAY_PROTEIN_ONLY : NUTRITION_DISPLAY_ALL
    );
  }

  /** The depth the current settings amount to, for showing the right toggle state. */
  static async currentTrackingDepth(): Promise<ComebackTrackingDepth> {
    const [intuitive, display] = await Promise.all([
      SettingsService.getIntuitiveEatingMode(),
      SettingsService.getNutritionDisplay(),
    ]);
    if (intuitive) {
      return 'mealsOnly';
    }

    const shown = binaryToSelectedMacros(display);

    return shown.length === 1 && shown[0] === 'protein' ? 'caloriesProtein' : 'full';
  }
}
