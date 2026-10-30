import { differenceInYears, subDays, subYears } from 'date-fns';
import { z } from 'zod';

import type { Units, WorkoutAutonomy } from '@/constants/settings';
import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '@/database/models/User';
import { formatLocalCalendarDayIso, parseLocalCalendarDate } from '@/utils/calendarDate';
import { BREAK_LENGTHS, type BreakLength } from '@/utils/comeback/comebackState';
import { isRecord } from '@/utils/isRecord';
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

export const GENDERS = ['male', 'female', 'other'] as const satisfies readonly Gender[];
export const EXPERIENCES = [
  'beginner',
  'intermediate',
  'advanced',
] as const satisfies readonly LiftingExperience[];
export const FITNESS_GOALS = [
  'hypertrophy',
  'strength',
  'endurance',
  'weight_loss',
  'general',
] as const satisfies readonly FitnessGoal[];
export const WEIGHT_GOALS = ['lose', 'gain', 'maintain'] as const satisfies readonly WeightGoal[];
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const satisfies readonly Units[];
export const AUTONOMIES = ['manual', 'suggest'] as const satisfies readonly WorkoutAutonomy[];
export const ACTIVITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export const isActivityLevel = (value: unknown): value is ActivityLevel =>
  (ACTIVITY_LEVELS as readonly unknown[]).includes(value);

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
  activityLevel?: ActivityLevel;
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

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One schema per answer. {@link contractDocumentSchema} (what an assistant is told to write) is
 * assembled from these same objects and {@link normalizeAnswers} judges each answer with them, so
 * the document we hand out and the document we accept are one definition. Bounds that are checked
 * here report `outOfRange`; a mismatch of any other kind reports `invalid`.
 */
const answerSchemas = {
  units: z.enum(UNIT_SYSTEMS),
  gender: z.enum(GENDERS),
  liftingExperience: z.enum(EXPERIENCES),
  fitnessGoal: z.enum(FITNESS_GOALS),
  weightGoal: z.enum(WEIGHT_GOALS),
  trainingLocation: z.enum(TRAINING_LOCATIONS),
  trainingAutonomy: z.enum(AUTONOMIES),
  breakLength: z.enum(BREAK_LENGTHS),
  birthDate: z.string().regex(BIRTH_DATE_PATTERN),
  ageYears: z.number().int().min(AGE_MIN).max(AGE_MAX),
  bodyFatPercent: z.number().min(BODY_FAT_MIN).max(BODY_FAT_MAX),
  activityLevel: z.number().int().min(ACTIVITY_LEVELS[0]).max(ACTIVITY_LEVELS[4]),
  trainingDaysPerWeek: z
    .number()
    .int()
    .refine((value) => (TRAINING_DAYS_OPTIONS as readonly number[]).includes(value)),
  fullName: z.string(),
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
const comingBackSchema = z.strictObject({ breakLength: answerSchemas.breakLength });
const trainingSchema = z.strictObject({
  location: answerSchemas.trainingLocation.optional(),
  daysPerWeek: answerSchemas.trainingDaysPerWeek.optional(),
  autonomy: answerSchemas.trainingAutonomy.optional(),
  comingBack: comingBackSchema.optional(),
});

/**
 * The document an external assistant is asked to produce. Strict on purpose, so the schema we hand
 * out forbids stray keys, while {@link normalizeAnswers} still tolerates them on the way in.
 */
export const contractDocumentSchema = z.strictObject({
  schema: z.literal(CONTRACT_SCHEMA_ID),
  version: z.literal(CONTRACT_MAJOR),
  fullName: answerSchemas.fullName.max(FULL_NAME_MAX).optional(),
  units: answerSchemas.units,
  gender: answerSchemas.gender,
  birthDate: answerSchemas.birthDate.optional(),
  ageYears: answerSchemas.ageYears.optional(),
  height: heightSchema,
  weight: weightSchema,
  bodyFatPercent: answerSchemas.bodyFatPercent.optional(),
  liftingExperience: answerSchemas.liftingExperience,
  activityLevel: answerSchemas.activityLevel,
  fitnessGoal: answerSchemas.fitnessGoal,
  weightGoal: answerSchemas.weightGoal,
  training: trainingSchema.optional(),
});

/** Keys the contract recognises, derived from the schema, used to report what was ignored. */
export const KNOWN_DOCUMENT_KEYS = {
  top: Object.keys(contractDocumentSchema.shape),
  height: [...new Set(heightSchema.options.flatMap((option) => Object.keys(option.shape)))],
  weight: Object.keys(weightSchema.shape),
  training: Object.keys(trainingSchema.shape),
  comingBack: Object.keys(comingBackSchema.shape),
};

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

type FieldRead<T> = { ok: true; value: T } | { ok: false; code: FieldIssue['code'] };

/** One answer judged by its schema: a bound that was crossed is `outOfRange`, anything else `invalid`. */
function readField<S extends z.ZodType>(schema: S, value: unknown): FieldRead<z.output<S>> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, value: result.data };
  }

  const crossedBound = result.error.issues.every(
    (issue) => issue.code === 'too_small' || issue.code === 'too_big'
  );
  return { ok: false, code: crossedBound ? 'outOfRange' : 'invalid' };
}

function readBirthDate(value: unknown, today: Date): FieldRead<string> {
  const text = readField(answerSchemas.birthDate, value);
  if (!text.ok) {
    return text;
  }

  const parsed = parseLocalCalendarDate(text.value);
  if (Number.isNaN(parsed.getTime()) || formatLocalCalendarDayIso(parsed) !== text.value) {
    return { ok: false, code: 'invalid' };
  }

  const age = differenceInYears(today, parsed);
  return age < AGE_MIN || age > AGE_MAX ? { ok: false, code: 'outOfRange' } : text;
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
  const present = (value: unknown) => value !== undefined && value !== null;

  /** Reads one answer through its schema; absent means "not answered", a mismatch is reported. */
  const read = <S extends z.ZodType>(
    field: FieldKey,
    schema: S,
    value: unknown
  ): z.output<S> | undefined => {
    if (!present(value)) {
      return undefined;
    }

    const result = readField(schema, value);
    if (result.ok) {
      return result.value;
    }

    fail(field, result.code);
    return undefined;
  };

  /** `read`, then store the answer under the same name. */
  const take = <K extends FieldKey>(
    field: K,
    schema: z.ZodType<NonNullable<OnboardingAnswersDraft[K]>>,
    value: unknown
  ) => {
    const answer = read(field, schema, value);
    if (answer !== undefined) {
      draft[field] = answer;
    }
  };

  if (present(source.fullName)) {
    const name = read('fullName', answerSchemas.fullName, source.fullName);
    if (name !== undefined && cleanName(name)) {
      draft.fullName = cleanName(name);
    }
  }

  take('units', answerSchemas.units, source.units);
  take('gender', answerSchemas.gender, source.gender);
  take('liftingExperience', answerSchemas.liftingExperience, source.liftingExperience);
  take('fitnessGoal', answerSchemas.fitnessGoal, source.fitnessGoal);
  take('weightGoal', answerSchemas.weightGoal, source.weightGoal);

  const activityLevel = read('activityLevel', answerSchemas.activityLevel, source.activityLevel);
  if (activityLevel !== undefined) {
    // The schema has just checked the integer range, which is exactly `ActivityLevel`.
    draft.activityLevel = activityLevel as ActivityLevel;
  }

  // Birthday: a real date wins over an age; an age only fills in when no usable date came with it.
  const birth = present(source.birthDate) ? readBirthDate(source.birthDate, today) : null;
  const age = present(source.ageYears) ? readField(answerSchemas.ageYears, source.ageYears) : null;
  if (birth?.ok) {
    draft.birthDate = birth.value;
    if (age?.ok && Math.abs(ageFromBirthDate(birth.value, today) - age.value) > 1) {
      warnings.push({ code: 'dobAgeMismatch' });
    }
  } else if (age?.ok) {
    draft.birthDate = estimateBirthDateFromAge(age.value, today);
    draft.dobEstimated = true;
  } else if (birth) {
    fail('birthDate', birth.code);
  } else if (age) {
    fail('birthDate', age.code);
  }

  if (present(source.height)) {
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

  if (present(source.weight)) {
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

  const bodyFat = read('bodyFatPercent', answerSchemas.bodyFatPercent, source.bodyFatPercent);
  if (bodyFat !== undefined) {
    draft.bodyFatPercent = round1(bodyFat);
  }

  if (isRecord(source.training)) {
    const training = source.training;
    take('trainingLocation', answerSchemas.trainingLocation, training.location);
    take('trainingAutonomy', answerSchemas.trainingAutonomy, training.autonomy);
    take('trainingDaysPerWeek', answerSchemas.trainingDaysPerWeek, training.daysPerWeek);

    if (present(training.comingBack)) {
      const length = readField(
        answerSchemas.breakLength,
        isRecord(training.comingBack) ? training.comingBack.breakLength : undefined
      );
      if (length.ok) {
        draft.breakLength = length.value;
      } else {
        fail('breakLength', 'invalid');
      }
    }
  } else if (present(source.training)) {
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
 * Flat answers (the draft's own names, or an assistant turn's patch) rebuilt as the contract's
 * nested document, so one validator, {@link normalizeAnswers}, judges every route in. Height comes
 * as `heightCm` or `heightFeet` + `heightInches`; weight as `weightKg` or `weightValue` +
 * `weightUnit`. A weight without its unit is ambiguous (kg vs lb), so it is left to be rejected.
 */
export function flatToDocument(flat: Record<string, unknown>): Record<string, unknown> {
  const has = (key: string) => flat[key] !== undefined && flat[key] !== null;
  const training = {
    location: flat.trainingLocation ?? undefined,
    daysPerWeek: flat.trainingDaysPerWeek ?? undefined,
    autonomy: flat.trainingAutonomy ?? undefined,
    comingBack: has('breakLength') ? { breakLength: flat.breakLength } : undefined,
  };

  let height: unknown;
  if (has('heightCm')) {
    height = { value: flat.heightCm, unit: 'cm' };
  } else if (has('heightFeet')) {
    height = { feet: flat.heightFeet, inches: flat.heightInches ?? 0, unit: 'ft_in' };
  }

  let weight: unknown;
  if (has('weightKg')) {
    weight = { value: flat.weightKg, unit: 'kg' };
  } else if (has('weightValue')) {
    weight = { value: flat.weightValue, unit: flat.weightUnit };
  }

  return {
    fullName: flat.fullName,
    units: flat.units,
    gender: flat.gender,
    birthDate: flat.birthDate,
    ageYears: flat.ageYears,
    height,
    weight,
    bodyFatPercent: flat.bodyFatPercent,
    liftingExperience: flat.liftingExperience,
    activityLevel: flat.activityLevel,
    fitnessGoal: flat.fitnessGoal,
    weightGoal: flat.weightGoal,
    training: Object.values(training).some((value) => value !== undefined) ? training : undefined,
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

  const { draft } = normalizeAnswers(flatToDocument(raw), today);
  if (raw.dobEstimated === true && draft.birthDate !== undefined) {
    draft.dobEstimated = true;
  }

  return draft;
}

/** The named answers that are present in a draft; absent ones stay absent, never defaulted. */
export function pickAnswers<K extends FieldKey>(
  draft: OnboardingAnswersDraft,
  keys: readonly K[]
): Pick<OnboardingAnswersDraft, K> {
  const picked: OnboardingAnswersDraft = {};
  for (const key of keys) {
    if (draft[key] !== undefined) {
      picked[key] = draft[key];
    }
  }

  return picked;
}
