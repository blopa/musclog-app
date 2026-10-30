import AsyncStorage from '@react-native-async-storage/async-storage';

import { TEMP_NUTRITION_PLAN, TRAINING_SETUP_DATA } from '@/constants/misc';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import {
  fromGuidedDrafts,
  toPersonalizedSetup,
  toPlanInput,
  toProfileWrite,
  toTrainingSetup,
} from '@/utils/aiOnboarding/answers';
import {
  type CompleteOnboardingAnswers,
  type FieldKey,
  hasRequiredAnswers,
  isActivityLevel,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import {
  type AiOnboardingMode,
  deleteAiDraft,
  readAiDraft,
  writeAiDraft,
} from '@/utils/aiOnboarding/draftStorage';
import { type ProfileSnapshot, selectKeptFields } from '@/utils/aiOnboarding/merge';
import { ensureGymForLocation } from '@/utils/applyTrainingSetup';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import { persistFitnessProfile } from '@/utils/fitnessProfilePersistence';
import { calculateNutritionPlan, type NutritionPlan } from '@/utils/nutritionCalculator';
import {
  mergePersonalizedSetup,
  pickBodyStats,
  readBodyStatsDraft,
  readPersonalizedSetup,
  writeBodyStatsDraft,
} from '@/utils/onboardingDraft';
import { PERSONALIZED_CYCLE_ROUTE, PROFILE_RESULTS_ROUTE } from '@/utils/onboardingRoutes';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';
import { parseTrainingSetup } from '@/utils/onboardingTraining';
import { storedHeightToCm, storedWeightToKg } from '@/utils/unitConversion';

/**
 * The one place confirmed onboarding answers become real data, whichever path produced them (an
 * AI chat, an imported file) and whichever mode asked (first-time onboarding, or a later profile
 * update). The guided body-stats screen shares {@link commitOnboardingProfile}, so a person who
 * moves between the forms and the AI is never saved by two different writers.
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Applying is guarded per draft: a second tap, a second screen or a retry racing the first run
 * joins the one in flight instead of starting another (which could create the user twice).
 */
function runOnce<T>(draftId: string, run: () => Promise<T>): Promise<T> {
  const running = inFlight.get(draftId) as Promise<T> | undefined;
  if (running) {
    return running;
  }

  const started = run().finally(() => inFlight.delete(draftId));
  inFlight.set(draftId, started);
  return started;
}

async function setApplyState(
  mode: AiOnboardingMode,
  draftId: string,
  applyState: 'applying' | 'applied' | undefined
): Promise<void> {
  const record = await readAiDraft(mode);
  if (record?.draftId !== draftId) {
    return;
  }

  const { applyState: _previous, ...rest } = record;
  await writeAiDraft(applyState ? { ...rest, applyState } : rest);
}

/**
 * Switching from the AI setup to the forms: hands the confirmed answers to the guided screens'
 * own drafts so each one opens prefilled. Nothing is written to the database here; the forms
 * save as they always do.
 */
export async function stageAnswersForGuided(
  draft: OnboardingAnswersDraft,
  { skipMusclogApi }: { skipMusclogApi: boolean }
): Promise<void> {
  const training = toTrainingSetup(draft);
  // Three different storage entries, so none waits for another.
  await Promise.all([
    mergePersonalizedSetup(toPersonalizedSetup(draft, { skipMusclogApi })),
    writeBodyStatsDraft(pickBodyStats(draft)),
    training ? AsyncStorage.setItem(TRAINING_SETUP_DATA, JSON.stringify(training)) : undefined,
  ]);

  await deleteAiDraft();
}

/**
 * Saves the profile and prepares the first nutrition plan. Shared by the AI apply and the guided
 * body-stats screen. Every step is an upsert or an overwrite, so running it again is safe.
 */
export async function commitOnboardingProfile(
  answers: CompleteOnboardingAnswers,
  { useBodyFat }: { useBodyFat: boolean }
): Promise<NutritionPlan> {
  await persistFitnessProfile(toProfileWrite(answers));

  const training = parseTrainingSetup(await AsyncStorage.getItem(TRAINING_SETUP_DATA));
  const plan = calculateNutritionPlan(
    toPlanInput(answers, { useBodyFat, training, today: new Date() })
  );
  await AsyncStorage.setItem(TEMP_NUTRITION_PLAN, JSON.stringify(plan));
  return plan;
}

/** The answers the guided screens have collected so far, in the contract's shape. */
export async function readGuidedAnswers(): Promise<OnboardingAnswersDraft> {
  const [personalized, body, training] = await Promise.all([
    readPersonalizedSetup(),
    readBodyStatsDraft(),
    AsyncStorage.getItem(TRAINING_SETUP_DATA),
  ]);

  return fromGuidedDrafts(personalized, body, parseTrainingSetup(training));
}

/**
 * First-time onboarding: applies the confirmed answers and returns the next screen, where the
 * guided chain takes over (cycle question, nutrition plan, first workout).
 */
export function applyOnboardingAnswers(
  answers: CompleteOnboardingAnswers,
  {
    draftId,
    skipMusclogApi,
    useBodyFat,
  }: { draftId: string; skipMusclogApi: boolean; useBodyFat: boolean }
): Promise<{ nextRoute: string }> {
  return runOnce(draftId, async () => {
    await setApplyState('onboarding', draftId, 'applying');
    try {
      const training = toTrainingSetup(answers);
      await Promise.all([
        training
          ? AsyncStorage.setItem(TRAINING_SETUP_DATA, JSON.stringify(training))
          : AsyncStorage.removeItem(TRAINING_SETUP_DATA),
        mergePersonalizedSetup({
          ...toPersonalizedSetup(answers, { skipMusclogApi }),
          skipMusclogApi,
        }),
        writeBodyStatsDraft(pickBodyStats(answers)),
      ]);
      await commitOnboardingProfile(answers, { useBodyFat });
      await setCurrentOnboardingStep(PERSONALIZED_CYCLE_ROUTE);
    } catch (error) {
      // The conversation stays so the review can offer Retry; every step above is repeatable.
      await setApplyState('onboarding', draftId, undefined);
      throw error;
    }

    await setApplyState('onboarding', draftId, 'applied');
    await deleteAiDraft();
    return { nextRoute: PERSONALIZED_CYCLE_ROUTE };
  });
}

/** What is saved now, in the draft's shape; absent values stay absent so the diff can say so. */
export async function loadProfileSnapshot(): Promise<ProfileSnapshot> {
  const [user, units, autonomy, weight, height, bodyFat] = await Promise.all([
    UserService.getCurrentUser(),
    SettingsService.getUnits(),
    SettingsService.get(SETTINGS.workoutAutonomy),
    UserMetricService.getLatest('weight'),
    UserMetricService.getLatest('height'),
    UserMetricService.getLatest('body_fat'),
  ]);
  const [weightValue, heightValue, bodyFatValue] = await Promise.all([
    weight?.getDecrypted(),
    height?.getDecrypted(),
    bodyFat?.getDecrypted(),
  ]);

  return {
    units,
    trainingAutonomy: autonomy,
    ...(weightValue ? { weightKg: storedWeightToKg(weightValue.value, weightValue.unit) } : {}),
    ...(heightValue ? { heightCm: storedHeightToCm(heightValue.value, heightValue.unit) } : {}),
    ...(bodyFatValue ? { bodyFatPercent: bodyFatValue.value } : {}),
    ...(user
      ? {
          ...(user.fullName ? { fullName: user.fullName } : {}),
          gender: user.gender,
          fitnessGoal: user.fitnessGoal,
          liftingExperience: user.liftingExperience,
          ...(user.weightGoal ? { weightGoal: user.weightGoal } : {}),
          ...(isActivityLevel(user.activityLevel) ? { activityLevel: user.activityLevel } : {}),
          ...(user.getAge() > 0
            ? { birthDate: formatLocalCalendarDayIso(new Date(user.dateOfBirth)) }
            : {}),
        }
      : {}),
  };
}

export type ProfileApplyNote =
  /** A gym already exists, so the chosen place to train created nothing. */
  | 'gymKept'
  /** Days per week is not stored outside a comeback plan, so it was not applied. */
  | 'daysNotApplied'
  /** Coming back after a break is started from Comeback, never silently from here. */
  | 'comebackNotStarted'
  /** Nutrition targets were not recalculated because the profile is missing something. */
  | 'recalculationSkipped';

/**
 * Updating an existing profile: writes only the fields the person kept, applies the coaching
 * style, and optionally prepares a recalculated nutrition plan for the results screen. It never
 * completes onboarding, never starts a comeback and never creates a gym when one exists.
 */
export function applyProfileUpdate(
  draft: OnboardingAnswersDraft,
  {
    draftId,
    kept,
    recalculateNutrition,
    useBodyFat,
  }: {
    draftId: string;
    kept: ReadonlySet<FieldKey>;
    recalculateNutrition: boolean;
    useBodyFat: boolean;
  }
): Promise<{ nextRoute: string | null; notes: ProfileApplyNote[] }> {
  return runOnce(draftId, async () => {
    await setApplyState('profile', draftId, 'applying');
    const notes: ProfileApplyNote[] = [];
    let nextRoute: string | null = null;
    try {
      const subset = selectKeptFields(draft, kept);
      await persistFitnessProfile(toProfileWrite(subset));

      if (subset.trainingAutonomy) {
        await SettingsService.set(SETTINGS.workoutAutonomy, subset.trainingAutonomy);
      }

      if (subset.trainingLocation && !(await ensureGymForLocation(subset.trainingLocation))) {
        notes.push('gymKept');
      }

      if (subset.trainingDaysPerWeek !== undefined) {
        notes.push('daysNotApplied');
      }

      if (subset.breakLength) {
        notes.push('comebackNotStarted');
      }

      if (recalculateNutrition) {
        const fresh = await loadProfileSnapshot();
        if (hasRequiredAnswers(fresh)) {
          await AsyncStorage.setItem(
            TEMP_NUTRITION_PLAN,
            JSON.stringify(
              calculateNutritionPlan(
                toPlanInput(fresh, { useBodyFat, training: null, today: new Date() })
              )
            )
          );
          nextRoute = PROFILE_RESULTS_ROUTE;
        } else {
          notes.push('recalculationSkipped');
        }
      }
    } catch (error) {
      await setApplyState('profile', draftId, undefined);
      throw error;
    }

    await deleteAiDraft();
    return { nextRoute, notes };
  });
}
