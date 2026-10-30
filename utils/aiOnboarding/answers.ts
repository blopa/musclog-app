import {
  ageFromBirthDate,
  type CompleteOnboardingAnswers,
  type OnboardingAnswersDraft,
  pickAnswers,
} from '@/utils/aiOnboarding/contract';
import { localDayStartMsFromIsoDateOnly } from '@/utils/calendarDate';
import type { FitnessProfileWrite } from '@/utils/fitnessProfilePersistence';
import type { NutritionCalculatorInput } from '@/utils/nutritionCalculator';
import {
  type BodyStatsDraft,
  PERSONALIZED_SETUP_KEYS,
  type PersonalizedSetupData,
} from '@/utils/onboardingDraft';
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
    activityLevel: answers.activityLevel,
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
    ...pickAnswers(answers, PERSONALIZED_SETUP_KEYS),
    ...(skipMusclogApi ? { skipMusclogApi: true } : {}),
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
    activityLevel: answers.activityLevel,
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
  const { skipMusclogApi: _carriedSeparately, ...answers } = personalized;

  return {
    ...answers,
    ...body,
    ...(training
      ? {
          trainingLocation: training.location,
          trainingDaysPerWeek: training.daysPerWeek,
          ...(training.autonomy ? { trainingAutonomy: training.autonomy } : {}),
          ...(training.comingBack ? { breakLength: training.comingBack.breakLength } : {}),
        }
      : {}),
  };
}
