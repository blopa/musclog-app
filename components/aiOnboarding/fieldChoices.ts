import type { Units, WorkoutAutonomy } from '@/constants/settings';
import type { WeightGoal } from '@/database/models/User';
import {
  ACTIVITY_LEVELS,
  CONTRACT_ENUMS,
  type FieldKey,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { TRAINING_DAYS_OPTIONS } from '@/utils/onboardingTraining';
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

/** The choices of an answer picked from a fixed list, in the contract's own order. */
function choicesFor<V extends string | number>(
  values: readonly V[],
  labelKeys: Record<V, string>
): Choice[] {
  return values.map((value) => ({ value, labelKey: labelKeys[value] }));
}

/**
 * The offered values come from the contract's enumerations and the labels are the ones the guided
 * screens already use, so the two paths can never offer or name a choice differently.
 */
export const FIELD_CHOICES: Partial<Record<FieldKey, readonly Choice[]>> = {
  units: choicesFor(CONTRACT_ENUMS.units, {
    metric: 'onboarding.quickPreferences.metric',
    imperial: 'onboarding.quickPreferences.imperial',
  }),
  gender: choicesFor(CONTRACT_ENUMS.gender, {
    male: 'onboarding.quickPreferences.male',
    female: 'onboarding.quickPreferences.female',
    other: 'onboarding.quickPreferences.other',
  }),
  liftingExperience: choicesFor(CONTRACT_ENUMS.liftingExperience, {
    beginner: 'onboarding.personalizedExperience.beginner',
    intermediate: 'onboarding.personalizedExperience.intermediate',
    advanced: 'onboarding.personalizedExperience.advanced',
  }),
  activityLevel: choicesFor(ACTIVITY_LEVELS, {
    1: 'onboarding.personalizedExperience.sedentary',
    2: 'onboarding.personalizedExperience.lightlyActive',
    3: 'onboarding.personalizedExperience.moderatelyActive',
    4: 'onboarding.personalizedExperience.veryActive',
    5: 'onboarding.personalizedExperience.extremelyActive',
  }),
  fitnessGoal: choicesFor(CONTRACT_ENUMS.fitnessGoal, {
    hypertrophy: 'onboarding.quickGoals.buildMuscle',
    strength: 'onboarding.quickGoals.strength',
    endurance: 'onboarding.quickGoals.endurance',
    weight_loss: 'onboarding.quickGoals.weightLoss',
    general: 'onboarding.quickGoals.general',
  }),
  // Offered in the order the guided screen shows them, not the enumeration's.
  weightGoal: choicesFor(['lose', 'maintain', 'gain'] as const satisfies readonly WeightGoal[], {
    lose: 'onboarding.quickGoals.lose',
    maintain: 'onboarding.quickGoals.maintain',
    gain: 'onboarding.quickGoals.gain',
  }),
  trainingLocation: choicesFor(CONTRACT_ENUMS.trainingLocation, {
    gym: 'onboarding.trainingSetup.location.gym',
    home: 'onboarding.trainingSetup.location.home',
    minimal: 'onboarding.trainingSetup.location.minimal',
  }),
  trainingDaysPerWeek: TRAINING_DAYS_OPTIONS.map((days) => ({
    value: days,
    labelText: String(days),
  })),
  trainingAutonomy: choicesFor(
    ['suggest', 'manual'] as const satisfies readonly WorkoutAutonomy[],
    {
      suggest: 'onboarding.trainingSetup.help.suggest',
      manual: 'onboarding.trainingSetup.help.manual',
    }
  ),
  breakLength: choicesFor(CONTRACT_ENUMS.breakLength, {
    under1m: 'comeback.setup.breakLength.under1m',
    '1to3m': 'comeback.setup.breakLength.1to3m',
    '3to6m': 'comeback.setup.breakLength.3to6m',
    over6m: 'comeback.setup.breakLength.over6m',
  }),
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
  const { heightCm, weightKg, bodyFatPercent, birthDate, fullName } = draft;

  switch (field) {
    case 'heightCm':
      return heightCm === undefined
        ? null
        : `${formatDecimal(cmToDisplay(heightCm, units), 1)} ${getHeightUnit(units)}`;
    case 'weightKg':
      return weightKg === undefined
        ? null
        : `${formatDecimal(kgToDisplay(weightKg, units), 1)} ${getWeightUnit(units)}`;
    case 'bodyFatPercent':
      return bodyFatPercent === undefined ? null : `${formatDecimal(bodyFatPercent, 1)} %`;
    case 'birthDate':
      return birthDate === undefined ? null : formatDate(birthDate);
    case 'fullName':
      return fullName ?? null;
    default: {
      const value = draft[field];
      if (value === undefined) {
        return null;
      }

      const choice = FIELD_CHOICES[field]?.find((candidate) => candidate.value === value);
      return choice ? choiceLabel(choice, t) : String(value);
    }
  }
}

export function choiceLabel(choice: Choice, t: (key: string) => string): string {
  return choice.labelKey ? t(choice.labelKey) : (choice.labelText ?? String(choice.value));
}
