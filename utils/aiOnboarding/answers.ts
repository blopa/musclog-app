import type { WorkoutAutonomy } from '@/constants/settings';
import {
  ageFromBirthDate,
  type CompleteOnboardingAnswers,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { localDayStartMsFromIsoDateOnly } from '@/utils/calendarDate';
import type { FitnessProfileWrite } from '@/utils/fitnessProfilePersistence';
import type { NutritionCalculatorInput } from '@/utils/nutritionCalculator';
import type { BodyStatsDraft, PersonalizedSetupData } from '@/utils/onboardingDraft';
import {
  DEFAULT_TRAINING_DAYS,
  planWeightGoal,
  type TrainingSetupData,
} from '@/utils/onboardingTraining';

/**
 * Pure mappers from the contract's answers to the shapes the rest of the app already persists.
 * Nothing here reads or writes storage, so every path (forms, chat, import) maps identically.
 */

export function toProfileWrite(answers: OnboardingAnswersDraft): FitnessProfileWrite {
  return {
    fullName: answers.fullName,
    dateOfBirthMs: answers.birthDate
      ? localDayStartMsFromIsoDateOnly(answers.birthDate)
      : undefined,
    gender: answers.gender,
    fitnessGoal: answers.fitnessGoal,
    weightGoal: answers.weightGoal,
    activityLevel: answers.activityLevel as FitnessProfileWrite['activityLevel'],
    liftingExperience: answers.liftingExperience,
    weightKg: answers.weightKg,
    heightCm: answers.heightCm,
    bodyFatPercent: answers.bodyFatPercent,
    units: answers.units,
  };
}

/** Training answers need a location; without one there is no training setup to apply. */
export function toTrainingSetup(answers: OnboardingAnswersDraft): TrainingSetupData | null {
  if (!answers.trainingLocation) {
    return null;
  }

  return {
    location: answers.trainingLocation,
    daysPerWeek: answers.trainingDaysPerWeek ?? DEFAULT_TRAINING_DAYS,
    autonomy: answers.trainingAutonomy ?? 'suggest',
    ...(answers.breakLength ? { comingBack: { breakLength: answers.breakLength } } : {}),
  };
}

export function toPersonalizedSetup(
  answers: OnboardingAnswersDraft,
  { skipMusclogApi }: { skipMusclogApi: boolean }
): PersonalizedSetupData {
  return {
    ...(answers.fullName ? { fullName: answers.fullName } : {}),
    ...(answers.units ? { units: answers.units } : {}),
    ...(answers.gender ? { gender: answers.gender } : {}),
    ...(answers.liftingExperience ? { liftingExperience: answers.liftingExperience } : {}),
    ...(answers.activityLevel ? { activityLevel: answers.activityLevel } : {}),
    ...(answers.fitnessGoal ? { fitnessGoal: answers.fitnessGoal } : {}),
    ...(answers.weightGoal ? { weightGoal: answers.weightGoal } : {}),
    ...(skipMusclogApi ? { skipMusclogApi: true } : {}),
  };
}

export function toBodyStatsDraft(answers: OnboardingAnswersDraft): BodyStatsDraft {
  return {
    ...(answers.birthDate ? { birthDate: answers.birthDate } : {}),
    ...(answers.birthDate && answers.dobEstimated ? { dobEstimated: true } : {}),
    ...(answers.heightCm !== undefined ? { heightCm: answers.heightCm } : {}),
    ...(answers.weightKg !== undefined ? { weightKg: answers.weightKg } : {}),
    ...(answers.bodyFatPercent !== undefined ? { bodyFatPercent: answers.bodyFatPercent } : {}),
  };
}

/** The input to the nutrition calculator, built exactly as the guided body-stats screen builds it. */
export function toPlanInput(
  answers: CompleteOnboardingAnswers,
  {
    useBodyFat,
    training,
    today,
  }: { useBodyFat: boolean; training: Pick<TrainingSetupData, 'comingBack'> | null; today: Date }
): NutritionCalculatorInput {
  return {
    gender: answers.gender,
    weightKg: answers.weightKg,
    heightCm: answers.heightCm,
    age: Math.max(1, ageFromBirthDate(answers.birthDate, today)),
    activityLevel: answers.activityLevel as NutritionCalculatorInput['activityLevel'],
    weightGoal: planWeightGoal(training, answers.weightGoal),
    fitnessGoal: answers.fitnessGoal,
    liftingExperience: answers.liftingExperience,
    bodyFatPercent: useBodyFat ? answers.bodyFatPercent : undefined,
  };
}

/** Rebuilds contract answers from what the guided screens saved, so both paths share one pipeline. */
export function fromGuidedDrafts(
  personalized: PersonalizedSetupData,
  body: BodyStatsDraft,
  training: TrainingSetupData | null
): OnboardingAnswersDraft {
  const autonomy: WorkoutAutonomy | undefined = training?.autonomy;
  return {
    ...(personalized.fullName ? { fullName: personalized.fullName } : {}),
    ...(personalized.units ? { units: personalized.units } : {}),
    ...(personalized.gender ? { gender: personalized.gender } : {}),
    ...(personalized.liftingExperience
      ? { liftingExperience: personalized.liftingExperience }
      : {}),
    ...(personalized.activityLevel ? { activityLevel: personalized.activityLevel } : {}),
    ...(personalized.fitnessGoal ? { fitnessGoal: personalized.fitnessGoal } : {}),
    ...(personalized.weightGoal ? { weightGoal: personalized.weightGoal } : {}),
    ...(body.birthDate ? { birthDate: body.birthDate } : {}),
    ...(body.birthDate && body.dobEstimated ? { dobEstimated: true } : {}),
    ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
    ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
    ...(body.bodyFatPercent !== undefined ? { bodyFatPercent: body.bodyFatPercent } : {}),
    ...(training
      ? {
          trainingLocation: training.location,
          trainingDaysPerWeek: training.daysPerWeek,
          ...(autonomy ? { trainingAutonomy: autonomy } : {}),
          ...(training.comingBack ? { breakLength: training.comingBack.breakLength } : {}),
        }
      : {}),
  };
}
