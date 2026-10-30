import { differenceInYears, subDays, subYears } from 'date-fns';
import { z } from 'zod';

import type { Units, WorkoutAutonomy } from '@/constants/settings';
import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '@/database/models/User';
import { formatLocalCalendarDayIso, parseLocalCalendarDate } from '@/utils/calendarDate';
import { BREAK_LENGTHS, type BreakLength } from '@/utils/comeback/comebackState';
import { BODY_FAT_MAX, BODY_FAT_MIN } from '@/utils/nutritionCalculator';
import {
  TRAINING_DAYS_OPTIONS,
  TRAINING_LOCATIONS,
  type TrainingLocation,
} from '@/utils/onboardingTraining';
import { displayToCm, displayToKg } from '@/utils/unitConversion';

/**
 * The onboarding data contract: the one shape the guided forms, the in-app AI chat and an
 * ChatGPT/Claude import all converge on. Everything that arrives from outside (a file, pasted
 * text, a model reply) is untrusted until it has been through {@link normalizeAnswers}.
 */
export const CONTRACT_SCHEMA_ID = 'musclog-onboarding';
export const CONTRACT_MAJOR = 1;
export const MAX_CONTRACT_BYTES = 64 * 1024;

export const AGE_MIN = 13;
export const AGE_MAX = 100;
export const HEIGHT_CM_RANGE = [100, 250] as const;
export const WEIGHT_KG_RANGE = [30, 300] as const;
export const FULL_NAME_MAX = 60;
export { BODY_FAT_MAX, BODY_FAT_MIN };

/** An estimated birthday sits half a year past the whole-year mark so the age reads back exactly. */
const ESTIMATED_BIRTHDAY_OFFSET_DAYS = 182;
const MIN_PLAUSIBLE_BMI = 12;
const MAX_PLAUSIBLE_BMI = 70;

const GENDERS = ['male', 'female', 'other'] as const satisfies readonly Gender[];
const EXPERIENCES = [
  'beginner',
  'intermediate',
  'advanced',
] as const satisfies readonly LiftingExperience[];
const FITNESS_GOALS = [
  'hypertrophy',
  'strength',
  'endurance',
  'weight_loss',
  'general',
] as const satisfies readonly FitnessGoal[];
const WEIGHT_GOALS = ['lose', 'gain', 'maintain'] as const satisfies readonly WeightGoal[];
const UNIT_SYSTEMS = ['metric', 'imperial'] as const satisfies readonly Units[];
const AUTONOMIES = ['manual', 'suggest'] as const satisfies readonly WorkoutAutonomy[];

export const CONTRACT_ENUMS = {
  units: UNIT_SYSTEMS,
  gender: GENDERS,
  liftingExperience: EXPERIENCES,
  fitnessGoal: FITNESS_GOALS,
  weightGoal: WEIGHT_GOALS,
  trainingLocation: TRAINING_LOCATIONS,
  trainingAutonomy: AUTONOMIES,
  breakLength: BREAK_LENGTHS,
} as const;

/** Every answer the contract knows, keyed the way the normalized draft stores it. */
export const FIELD_KEYS = [
  'fullName',
  'units',
  'gender',
  'birthDate',
  'heightCm',
  'weightKg',
  'bodyFatPercent',
  'liftingExperience',
  'activityLevel',
  'fitnessGoal',
  'weightGoal',
  'trainingLocation',
  'trainingDaysPerWeek',
  'trainingAutonomy',
  'breakLength',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const REQUIRED_FIELDS = [
  'units',
  'gender',
  'birthDate',
  'heightCm',
  'weightKg',
  'liftingExperience',
  'activityLevel',
  'fitnessGoal',
  'weightGoal',
] as const satisfies readonly FieldKey[];

/** Answers that only make sense once a training location is known. */
const TRAINING_DEPENDENT_FIELDS = [
  'trainingDaysPerWeek',
  'trainingAutonomy',
  'breakLength',
] as const satisfies readonly FieldKey[];

/** Normalized answers: metric values, ISO birthday, every field optional until reviewed. */
export type OnboardingAnswersDraft = {
  fullName?: string;
  units?: Units;
  gender?: Gender;
  /** yyyy-MM-dd, local calendar day. */
  birthDate?: string;
  /** True when {@link birthDate} was derived from an age rather than given. */
  dobEstimated?: boolean;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  liftingExperience?: LiftingExperience;
  activityLevel?: number;
  fitnessGoal?: FitnessGoal;
  weightGoal?: WeightGoal;
  trainingLocation?: TrainingLocation;
  trainingDaysPerWeek?: number;
  trainingAutonomy?: WorkoutAutonomy;
  breakLength?: BreakLength;
};

export type CompleteOnboardingAnswers = OnboardingAnswersDraft &
  Required<Pick<OnboardingAnswersDraft, (typeof REQUIRED_FIELDS)[number]>>;

export type FieldIssue = { field: FieldKey; code: 'invalid' | 'outOfRange' };
export type AnswerWarning = {
  code:
    | 'weightGoalConflictsFocus'
    | 'dobAgeMismatch'
    | 'comebackStartsAtMaintenance'
    | 'unusualBodyMeasurements';
};

const heightSchema = z.union([
  z.strictObject({ value: z.number(), unit: z.enum(['cm', 'in']) }),
  z.strictObject({
    feet: z.number().int().min(0).max(9),
    inches: z.number().min(0).max(11.99),
    unit: z.literal('ft_in'),
  }),
]);
const weightSchema = z.strictObject({ value: z.number(), unit: z.enum(['kg', 'lb']) });
const comingBackSchema = z.strictObject({ breakLength: z.enum(BREAK_LENGTHS) });
const trainingSchema = z.strictObject({
  location: z.enum(TRAINING_LOCATIONS).optional(),
  daysPerWeek: z
    .number()
    .int()
    .refine((value) => (TRAINING_DAYS_OPTIONS as readonly number[]).includes(value))
    .optional(),
  autonomy: z.enum(AUTONOMIES).optional(),
  comingBack: comingBackSchema.optional(),
});

/**
 * The document an external assistant is asked to produce. Strict on purpose, so the schema we hand
 * out forbids stray keys, while {@link normalizeAnswers} still tolerates them on the way in.
 */
export const contractDocumentSchema = z.strictObject({
  schema: z.literal(CONTRACT_SCHEMA_ID),
  version: z.literal(CONTRACT_MAJOR),
  fullName: z.string().max(FULL_NAME_MAX).optional(),
  units: z.enum(UNIT_SYSTEMS),
  gender: z.enum(GENDERS),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ageYears: z.number().int().min(AGE_MIN).max(AGE_MAX).optional(),
  height: heightSchema,
  weight: weightSchema,
  bodyFatPercent: z.number().min(BODY_FAT_MIN).max(BODY_FAT_MAX).optional(),
  liftingExperience: z.enum(EXPERIENCES),
  activityLevel: z.number().int().min(1).max(5),
  fitnessGoal: z.enum(FITNESS_GOALS),
  weightGoal: z.enum(WEIGHT_GOALS),
  training: trainingSchema.optional(),
});

/** Keys the contract recognises, used to report what was ignored. */
export const KNOWN_DOCUMENT_KEYS = {
  top: [
    'schema',
    'version',
    'fullName',
    'units',
    'gender',
    'birthDate',
    'ageYears',
    'height',
    'weight',
    'bodyFatPercent',
    'liftingExperience',
    'activityLevel',
    'fitnessGoal',
    'weightGoal',
    'training',
  ],
  height: ['value', 'unit', 'feet', 'inches'],
  weight: ['value', 'unit'],
  training: ['location', 'daysPerWeek', 'autonomy', 'comingBack'],
  comingBack: ['breakLength'],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function ageFromBirthDate(isoDate: string, today: Date): number {
  return differenceInYears(today, parseLocalCalendarDate(isoDate));
}

/** A birthday that reads back as exactly `ageYears` for at least the next half year. */
export function estimateBirthDateFromAge(ageYears: number, today: Date): string {
  return formatLocalCalendarDayIso(
    subDays(subYears(today, ageYears), ESTIMATED_BIRTHDAY_OFFSET_DAYS)
  );
}

function readBirthDate(
  value: unknown,
  today: Date
): { ok: true; value: string } | { ok: false; code: FieldIssue['code'] } {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, code: 'invalid' };
  }

  const parsed = parseLocalCalendarDate(value);
  if (Number.isNaN(parsed.getTime()) || formatLocalCalendarDayIso(parsed) !== value) {
    return { ok: false, code: 'invalid' };
  }

  const age = differenceInYears(today, parsed);
  return age < AGE_MIN || age > AGE_MAX ? { ok: false, code: 'outOfRange' } : { ok: true, value };
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Control characters and invisible separators have no place in a display name. */
function isStrippable(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e)
  );
}

function cleanName(value: string): string {
  return Array.from(value, (char) => (isStrippable(char.charCodeAt(0)) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FULL_NAME_MAX)
    .trim();
}

/**
 * Turns an untrusted contract-shaped object into a draft. Each field is judged on its own: a bad
 * value is dropped and reported, and the good ones are kept, so one wrong number never costs the
 * person the rest of a conversation. `null` and a missing key both mean "not answered".
 */
export function normalizeAnswers(
  raw: unknown,
  today: Date
): { draft: OnboardingAnswersDraft; issues: FieldIssue[]; warnings: AnswerWarning[] } {
  const draft: OnboardingAnswersDraft = {};
  const issues: FieldIssue[] = [];
  const warnings: AnswerWarning[] = [];
  const source = isRecord(raw) ? raw : {};
  const fail = (field: FieldKey, code: FieldIssue['code']) => issues.push({ field, code });
  const present = (key: string) => source[key] !== undefined && source[key] !== null;

  const pickEnum = <K extends keyof typeof CONTRACT_ENUMS>(
    key: K,
    field: FieldKey,
    value: unknown
  ): (typeof CONTRACT_ENUMS)[K][number] | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if ((CONTRACT_ENUMS[key] as readonly unknown[]).includes(value)) {
      return value as (typeof CONTRACT_ENUMS)[K][number];
    }

    fail(field, 'invalid');
    return undefined;
  };

  if (present('fullName')) {
    const name = typeof source.fullName === 'string' ? cleanName(source.fullName) : null;
    if (name === null) {
      fail('fullName', 'invalid');
    } else if (name) {
      draft.fullName = name;
    }
  }

  const units = pickEnum('units', 'units', source.units);
  if (units) {
    draft.units = units;
  }

  const gender = pickEnum('gender', 'gender', source.gender);
  if (gender) {
    draft.gender = gender;
  }

  const experience = pickEnum('liftingExperience', 'liftingExperience', source.liftingExperience);
  if (experience) {
    draft.liftingExperience = experience;
  }

  const fitnessGoal = pickEnum('fitnessGoal', 'fitnessGoal', source.fitnessGoal);
  if (fitnessGoal) {
    draft.fitnessGoal = fitnessGoal;
  }

  const weightGoal = pickEnum('weightGoal', 'weightGoal', source.weightGoal);
  if (weightGoal) {
    draft.weightGoal = weightGoal;
  }

  if (present('activityLevel')) {
    const level = readNumber(source.activityLevel);
    if (level !== null && Number.isInteger(level) && level >= 1 && level <= 5) {
      draft.activityLevel = level;
    } else {
      fail('activityLevel', level === null || !Number.isInteger(level) ? 'invalid' : 'outOfRange');
    }
  }

  // Birthday: a real date wins over an age; an age only fills in when no usable date came with it.
  const birth = present('birthDate') ? readBirthDate(source.birthDate, today) : null;
  const age = present('ageYears') ? readNumber(source.ageYears) : null;
  const ageUsable = age !== null && Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX;
  if (birth?.ok) {
    draft.birthDate = birth.value;
    if (ageUsable && Math.abs(ageFromBirthDate(birth.value, today) - age) > 1) {
      warnings.push({ code: 'dobAgeMismatch' });
    }
  } else if (ageUsable) {
    draft.birthDate = estimateBirthDateFromAge(age, today);
    draft.dobEstimated = true;
  } else if (birth) {
    fail('birthDate', birth.code);
  } else if (present('ageYears')) {
    fail('birthDate', age !== null && Number.isInteger(age) ? 'outOfRange' : 'invalid');
  }

  if (present('height')) {
    const parsed = heightSchema.safeParse(source.height);
    if (!parsed.success) {
      fail('heightCm', 'invalid');
    } else {
      const height = parsed.data;
      const cm = round1(
        'feet' in height
          ? displayToCm(height.feet * 12 + height.inches, 'imperial')
          : displayToCm(height.value, height.unit === 'in' ? 'imperial' : 'metric')
      );
      if (cm >= HEIGHT_CM_RANGE[0] && cm <= HEIGHT_CM_RANGE[1]) {
        draft.heightCm = cm;
      } else {
        fail('heightCm', 'outOfRange');
      }
    }
  }

  if (present('weight')) {
    const parsed = weightSchema.safeParse(source.weight);
    if (!parsed.success) {
      fail('weightKg', 'invalid');
    } else {
      const kg = round1(
        displayToKg(parsed.data.value, parsed.data.unit === 'lb' ? 'imperial' : 'metric')
      );
      if (kg >= WEIGHT_KG_RANGE[0] && kg <= WEIGHT_KG_RANGE[1]) {
        draft.weightKg = kg;
      } else {
        fail('weightKg', 'outOfRange');
      }
    }
  }

  if (present('bodyFatPercent')) {
    const fat = readNumber(source.bodyFatPercent);
    if (fat === null) {
      fail('bodyFatPercent', 'invalid');
    } else if (fat >= BODY_FAT_MIN && fat <= BODY_FAT_MAX) {
      draft.bodyFatPercent = round1(fat);
    } else {
      fail('bodyFatPercent', 'outOfRange');
    }
  }

  if (isRecord(source.training)) {
    const training = source.training;
    const location = pickEnum('trainingLocation', 'trainingLocation', training.location);
    if (location) {
      draft.trainingLocation = location;
    }

    const autonomy = pickEnum('trainingAutonomy', 'trainingAutonomy', training.autonomy);
    if (autonomy) {
      draft.trainingAutonomy = autonomy;
    }

    if (training.daysPerWeek !== undefined && training.daysPerWeek !== null) {
      const days = readNumber(training.daysPerWeek);
      if (days !== null && (TRAINING_DAYS_OPTIONS as readonly number[]).includes(days)) {
        draft.trainingDaysPerWeek = days;
      } else {
        fail('trainingDaysPerWeek', 'invalid');
      }
    }

    if (training.comingBack !== undefined && training.comingBack !== null) {
      const comingBack = isRecord(training.comingBack) ? training.comingBack : {};
      const length = pickEnum('breakLength', 'breakLength', comingBack.breakLength);
      if (length) {
        draft.breakLength = length;
      } else if (!issues.some((issue) => issue.field === 'breakLength')) {
        fail('breakLength', 'invalid');
      }
    }
  } else if (present('training')) {
    fail('trainingLocation', 'invalid');
  }

  warnings.push(...crossFieldWarnings(draft));
  return { draft, issues, warnings };
}

/** Consistency checks over the answers as a whole; these warn, they never block. */
export function crossFieldWarnings(draft: OnboardingAnswersDraft): AnswerWarning[] {
  const warnings: AnswerWarning[] = [];
  if (draft.fitnessGoal === 'weight_loss' && draft.weightGoal && draft.weightGoal !== 'lose') {
    warnings.push({ code: 'weightGoalConflictsFocus' });
  }

  if (draft.breakLength && draft.weightGoal && draft.weightGoal !== 'maintain') {
    warnings.push({ code: 'comebackStartsAtMaintenance' });
  }

  if (draft.heightCm && draft.weightKg) {
    const bmi = draft.weightKg / (draft.heightCm / 100) ** 2;
    if (bmi < MIN_PLAUSIBLE_BMI || bmi > MAX_PLAUSIBLE_BMI) {
      warnings.push({ code: 'unusualBodyMeasurements' });
    }
  }

  return warnings;
}

/** Required answers still missing; a training answer without a location also needs the location. */
export function missingRequiredFields(draft: OnboardingAnswersDraft): FieldKey[] {
  const missing: FieldKey[] = REQUIRED_FIELDS.filter((field) => draft[field] === undefined);
  const hasTrainingDetail = TRAINING_DEPENDENT_FIELDS.some((field) => draft[field] !== undefined);
  if (hasTrainingDetail && draft.trainingLocation === undefined) {
    missing.push('trainingLocation');
  }

  return missing;
}

/** Every required answer is present (training answers are not part of this check). */
export function hasRequiredAnswers(
  draft: OnboardingAnswersDraft
): draft is CompleteOnboardingAnswers {
  return REQUIRED_FIELDS.every((field) => draft[field] !== undefined);
}

/** Ready to apply during onboarding: everything required, and no orphaned training answers. */
export function isCompleteAnswers(
  draft: OnboardingAnswersDraft
): draft is CompleteOnboardingAnswers {
  return missingRequiredFields(draft).length === 0;
}

/**
 * The draft written back in the contract's own shape, so a stored or in-flight draft can be
 * re-validated by the exact code that validates an import. Metric values, so units are explicit.
 */
export function draftToContractShape(draft: OnboardingAnswersDraft): Record<string, unknown> {
  const training = {
    location: draft.trainingLocation,
    daysPerWeek: draft.trainingDaysPerWeek,
    autonomy: draft.trainingAutonomy,
    ...(draft.breakLength ? { comingBack: { breakLength: draft.breakLength } } : {}),
  };
  const hasTraining = Object.values(training).some((value) => value !== undefined);

  return {
    fullName: draft.fullName,
    units: draft.units,
    gender: draft.gender,
    birthDate: draft.birthDate,
    height: draft.heightCm === undefined ? undefined : { value: draft.heightCm, unit: 'cm' },
    weight: draft.weightKg === undefined ? undefined : { value: draft.weightKg, unit: 'kg' },
    bodyFatPercent: draft.bodyFatPercent,
    liftingExperience: draft.liftingExperience,
    activityLevel: draft.activityLevel,
    fitnessGoal: draft.fitnessGoal,
    weightGoal: draft.weightGoal,
    training: hasTraining ? training : undefined,
  };
}

/**
 * Re-validates a draft that came back from storage or from a restored session: anything that
 * would not pass today's rules is dropped rather than trusted.
 */
export function sanitizeDraft(raw: unknown, today: Date): OnboardingAnswersDraft {
  if (!isRecord(raw)) {
    return {};
  }

  const { draft } = normalizeAnswers(draftToContractShape(raw as OnboardingAnswersDraft), today);
  if (raw.dobEstimated === true && draft.birthDate !== undefined) {
    draft.dobEstimated = true;
  }

  return draft;
}
