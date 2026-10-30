import type { Units } from '@/constants/settings';
import type { FieldKey, OnboardingAnswersDraft } from '@/utils/aiOnboarding/contract';
import { cmToDisplay, kgToDisplay } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';

/**
 * How each answer is named and shown. These are whole translation keys in tables rather than keys
 * built at the call site, so `check-translations` can see them, and so the compiler (these are
 * `Record<FieldKey, …>`) demands a decision when the contract gains an answer.
 */

export const FIELD_LABEL_KEYS: Record<FieldKey, string> = {
  fullName: 'aiOnboarding.fields.fullName',
  units: 'aiOnboarding.fields.units',
  gender: 'aiOnboarding.fields.gender',
  birthDate: 'aiOnboarding.fields.birthDate',
  heightCm: 'aiOnboarding.fields.height',
  weightKg: 'aiOnboarding.fields.weight',
  bodyFatPercent: 'aiOnboarding.fields.bodyFat',
  liftingExperience: 'aiOnboarding.fields.liftingExperience',
  activityLevel: 'aiOnboarding.fields.activityLevel',
  fitnessGoal: 'aiOnboarding.fields.fitnessGoal',
  weightGoal: 'aiOnboarding.fields.weightGoal',
  trainingLocation: 'aiOnboarding.fields.trainingLocation',
  trainingDaysPerWeek: 'aiOnboarding.fields.trainingDays',
  trainingAutonomy: 'aiOnboarding.fields.trainingAutonomy',
  breakLength: 'aiOnboarding.fields.breakLength',
};

export type ReviewSection = {
  titleKey: string;
  fields: readonly FieldKey[];
};

/** The review groups answers the way the guided screens do, in the same order. */
export const REVIEW_SECTIONS: readonly ReviewSection[] = [
  {
    titleKey: 'aiOnboarding.review.sections.aboutYou',
    fields: ['fullName', 'gender', 'birthDate', 'units'],
  },
  {
    titleKey: 'aiOnboarding.review.sections.body',
    fields: ['heightCm', 'weightKg', 'bodyFatPercent'],
  },
  {
    titleKey: 'aiOnboarding.review.sections.experience',
    fields: ['liftingExperience', 'activityLevel'],
  },
  { titleKey: 'aiOnboarding.review.sections.goals', fields: ['fitnessGoal', 'weightGoal'] },
  {
    titleKey: 'aiOnboarding.review.sections.training',
    fields: ['trainingLocation', 'trainingDaysPerWeek', 'trainingAutonomy', 'breakLength'],
  },
];

/** Answers that may be left out. Everything else must be present before setup can be applied. */
export const OPTIONAL_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'fullName',
  'bodyFatPercent',
  'trainingLocation',
  'trainingDaysPerWeek',
  'trainingAutonomy',
  'breakLength',
]);

export type Choice = { value: string | number; labelKey?: string; labelText?: string };

/** The labels the guided screens already use, reused so the two paths can never name a choice differently. */
export const FIELD_CHOICES: Partial<Record<FieldKey, readonly Choice[]>> = {
  units: [
    { value: 'metric', labelKey: 'onboarding.quickPreferences.metric' },
    { value: 'imperial', labelKey: 'onboarding.quickPreferences.imperial' },
  ],
  gender: [
    { value: 'male', labelKey: 'onboarding.quickPreferences.male' },
    { value: 'female', labelKey: 'onboarding.quickPreferences.female' },
    { value: 'other', labelKey: 'onboarding.quickPreferences.other' },
  ],
  liftingExperience: [
    { value: 'beginner', labelKey: 'onboarding.personalizedExperience.beginner' },
    { value: 'intermediate', labelKey: 'onboarding.personalizedExperience.intermediate' },
    { value: 'advanced', labelKey: 'onboarding.personalizedExperience.advanced' },
  ],
  activityLevel: [
    { value: 1, labelKey: 'onboarding.personalizedExperience.sedentary' },
    { value: 2, labelKey: 'onboarding.personalizedExperience.lightlyActive' },
    { value: 3, labelKey: 'onboarding.personalizedExperience.moderatelyActive' },
    { value: 4, labelKey: 'onboarding.personalizedExperience.veryActive' },
    { value: 5, labelKey: 'onboarding.personalizedExperience.extremelyActive' },
  ],
  fitnessGoal: [
    { value: 'hypertrophy', labelKey: 'onboarding.quickGoals.buildMuscle' },
    { value: 'strength', labelKey: 'onboarding.quickGoals.strength' },
    { value: 'endurance', labelKey: 'onboarding.quickGoals.endurance' },
    { value: 'weight_loss', labelKey: 'onboarding.quickGoals.weightLoss' },
    { value: 'general', labelKey: 'onboarding.quickGoals.general' },
  ],
  weightGoal: [
    { value: 'lose', labelKey: 'onboarding.quickGoals.lose' },
    { value: 'maintain', labelKey: 'onboarding.quickGoals.maintain' },
    { value: 'gain', labelKey: 'onboarding.quickGoals.gain' },
  ],
  trainingLocation: [
    { value: 'gym', labelKey: 'onboarding.trainingSetup.location.gym' },
    { value: 'home', labelKey: 'onboarding.trainingSetup.location.home' },
    { value: 'minimal', labelKey: 'onboarding.trainingSetup.location.minimal' },
  ],
  trainingDaysPerWeek: [
    { value: 2, labelText: '2' },
    { value: 3, labelText: '3' },
    { value: 4, labelText: '4' },
    { value: 5, labelText: '5' },
  ],
  trainingAutonomy: [
    { value: 'suggest', labelKey: 'onboarding.trainingSetup.help.suggest' },
    { value: 'manual', labelKey: 'onboarding.trainingSetup.help.manual' },
  ],
  breakLength: [
    { value: 'under1m', labelKey: 'comeback.setup.breakLength.under1m' },
    { value: '1to3m', labelKey: 'comeback.setup.breakLength.1to3m' },
    { value: '3to6m', labelKey: 'comeback.setup.breakLength.3to6m' },
    { value: 'over6m', labelKey: 'comeback.setup.breakLength.over6m' },
  ],
};

export type AnswerFormatters = {
  t: (key: string) => string;
  units: Units;
  formatDecimal: (value: number, fractionDigits?: number) => string;
  formatDate: (isoDate: string) => string;
};

/** The text shown for one answer, or null when it has not been answered. */
export function formatAnswer(
  field: FieldKey,
  draft: OnboardingAnswersDraft,
  { t, units, formatDecimal, formatDate }: AnswerFormatters
): string | null {
  const value = draft[field];
  if (value === undefined) {
    return null;
  }

  switch (field) {
    case 'heightCm':
      return `${formatDecimal(cmToDisplay(value as number, units), 1)} ${getHeightUnit(units)}`;
    case 'weightKg':
      return `${formatDecimal(kgToDisplay(value as number, units), 1)} ${getWeightUnit(units)}`;
    case 'bodyFatPercent':
      return `${formatDecimal(value as number, 1)} %`;
    case 'birthDate':
      return formatDate(value as string);
    case 'fullName':
      return value as string;
    default: {
      const choice = FIELD_CHOICES[field]?.find((candidate) => candidate.value === value);
      if (!choice) {
        return String(value);
      }

      return choice.labelKey ? t(choice.labelKey) : (choice.labelText ?? String(value));
    }
  }
}

export function choiceLabel(choice: Choice, t: (key: string) => string): string {
  return choice.labelKey ? t(choice.labelKey) : (choice.labelText ?? String(choice.value));
}
