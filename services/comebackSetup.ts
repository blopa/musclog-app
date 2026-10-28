import i18n from 'i18next';

import { getWorkoutTemplates } from '@/data/workoutTemplates';
import type { ComebackNutritionResult } from '@/database/services/ComebackNutritionService';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { refreshAllNotifications } from '@/services/notificationRefresh';
import { ensureGymForLocation } from '@/utils/applyTrainingSetup';
import { localDayStartMs } from '@/utils/calendarDate';
import { defaultTrainingWeekDays } from '@/utils/comeback/comebackSchedule';
import {
  type ComebackAnswers,
  type ComebackTrack,
  type ComebackTrackingDepth,
  tracksNutrition,
  tracksWorkouts,
} from '@/utils/comeback/comebackState';
import { startedState } from '@/utils/comeback/comebackTransitions';
import { handleError } from '@/utils/handleError';
import { shortPlanTemplateIndex } from '@/utils/onboardingTraining';

/** The steps of a setup that can fail on their own without undoing the others. */
export type ComebackSetupStep =
  'gym' | 'plan' | 'goal' | 'weight' | 'nutrition' | 'tracking' | 'notifications';

export type ComebackSetupInput = {
  track: ComebackTrack;
  answers: ComebackAnswers;
  /** A weigh-in for today (kg) that becomes day 1; skipped when absent. */
  todayWeightKg?: number | null;
  /** Make the weekly workout goal the chosen days a week (the person ticked it). */
  setWeeklyGoal?: boolean;
  /** Switch the food diary to this depth now (the person flipped the toggle); never done silently. */
  applyTrackingDepth?: ComebackTrackingDepth | null;
};

export type ComebackSetupResult = {
  /** Always true once the state is written: a failed step never stops the comeback from starting. */
  started: boolean;
  failures: ComebackSetupStep[];
  nutrition: ComebackNutritionResult | null;
  createdPlanId: string | null;
};

async function attempt<T>(
  step: ComebackSetupStep,
  failures: ComebackSetupStep[],
  work: () => Promise<T>
): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    failures.push(step);
    // The caller shows ONE summary of what failed; a snackbar per step would stack up.
    await handleError(error, `comebackSetup.${step}`, { showSnackbar: false });

    return null;
  }
}

/**
 * Starts a comeback: writes the state first (so a later failure cannot leave the person with a
 * half-configured app and no comeback), then does each part best-effort and reports what failed.
 *
 *  - workouts: a gym profile only if there is none; a weekly plan from the short template only if
 *    asked for and not already created; the weekly goal only if the person ticked it.
 *  - food: today's weigh-in as day 1, then MAINTENANCE targets (the deficit is offered later, at
 *    the week-2 check-in); "keep my targets" writes nothing.
 */
export async function startComeback(input: ComebackSetupInput): Promise<ComebackSetupResult> {
  const failures: ComebackSetupStep[] = [];
  const today = localDayStartMs(new Date());
  const { track, answers } = input;

  const previous = await SettingsService.getComebackState();
  await SettingsService.updateComebackState((current) =>
    startedState(current, { track, answers, today })
  );

  let createdPlanId: string | null = null;
  if (tracksWorkouts(track)) {
    if (answers.location) {
      await attempt('gym', failures, () => ensureGymForLocation(answers.location!));
    }

    if (answers.start === 'shortPlan' && answers.location) {
      const existing = previous.shortPlanId
        ? await WorkoutPlanService.getPlanSnapshot(previous.shortPlanId).catch(() => null)
        : null;
      if (!existing) {
        createdPlanId = await attempt('plan', failures, async () => {
          const index = shortPlanTemplateIndex(answers.location!);
          const template =
            index === null
              ? null
              : getWorkoutTemplates(i18n.resolvedLanguage ?? i18n.language)[index];
          if (!template) {
            throw new Error('Short plan template is missing');
          }

          const days =
            answers.weekDays && answers.weekDays.length > 0
              ? answers.weekDays
              : defaultTrainingWeekDays(answers.daysPerWeek ?? 2);
          const { plan } = await WorkoutTemplateService.createWorkoutsFromJsonTemplate(template, {
            cycleType: 'weekly',
            weekDays: days,
          });

          return plan?.id ?? null;
        });
        if (createdPlanId) {
          await SettingsService.updateComebackState({ shortPlanId: createdPlanId });
        }
      }
    }

    if (input.setWeeklyGoal && answers.daysPerWeek) {
      await attempt('goal', failures, () =>
        ExerciseGoalService.saveGoal({
          goalType: 'consistency',
          targetSessionsPerWeek: answers.daysPerWeek,
        })
      );
    }
  }

  let nutrition: ComebackNutritionResult | null = null;
  if (tracksNutrition(track)) {
    if (input.todayWeightKg && input.todayWeightKg > 0) {
      await attempt('weight', failures, () =>
        ComebackNutritionService.logTodayWeight(input.todayWeightKg!)
      );
    }

    nutrition = await attempt('nutrition', failures, () =>
      ComebackNutritionService.apply(answers, { applyDeficit: false })
    );

    if (input.applyTrackingDepth) {
      await attempt('tracking', failures, () =>
        ComebackNutritionService.setTrackingDepth(input.applyTrackingDepth!)
      );
    }
  }

  await attempt('notifications', failures, () => refreshAllNotifications());

  return { started: true, failures, nutrition, createdPlanId };
}
