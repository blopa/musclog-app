import {
  AGE_MAX,
  AGE_MIN,
  CONTRACT_ENUMS,
  FIELD_KEYS,
  type FieldIssue,
  type FieldKey,
  flatToDocument,
  normalizeAnswers,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import type { StructuredDialect } from '@/utils/coachAI';
import { isRecord } from '@/utils/isRecord';

/**
 * The shape of one assistant turn: what to say, what the person just told it, what it is asking
 * about, and whether it thinks the answers are ready to review. The patch is flat (a model fills
 * a flat object more reliably than the nested contract) and is turned back into the contract's
 * shape and validated by {@link parseAiTurn} before any of it is used.
 */

type PatchField = {
  type: 'string' | 'integer' | 'number';
  description: string;
  enum?: readonly string[];
};

export const TURN_PATCH_FIELDS = {
  fullName: { type: 'string', description: 'First name or nickname, only if the person gave one.' },
  units: {
    type: 'string',
    enum: CONTRACT_ENUMS.units,
    description: 'The unit system the person prefers.',
  },
  gender: {
    type: 'string',
    enum: CONTRACT_ENUMS.gender,
    description: 'Used for calorie formulas; "other" if they prefer not to say.',
  },
  birthDate: { type: 'string', description: 'Birth date as YYYY-MM-DD.' },
  ageYears: {
    type: 'integer',
    description: `Age in whole years (${AGE_MIN}-${AGE_MAX}), only when they do not give a birth date.`,
  },
  heightCm: { type: 'number', description: 'Height in centimetres, when given in centimetres.' },
  heightFeet: { type: 'integer', description: 'Feet part of a height given as feet and inches.' },
  heightInches: {
    type: 'number',
    description: 'Inches part of a height given as feet and inches.',
  },
  weightValue: { type: 'number', description: 'Body weight exactly as the person said it.' },
  weightUnit: { type: 'string', enum: ['kg', 'lb'], description: 'Unit of weightValue.' },
  bodyFatPercent: { type: 'number', description: 'Body fat percentage, only if they know it.' },
  liftingExperience: {
    type: 'string',
    enum: CONTRACT_ENUMS.liftingExperience,
    description: 'Lifting experience.',
  },
  activityLevel: {
    type: 'integer',
    description:
      'Daily activity outside workouts: 1 mostly sitting, 2 light, 3 moderate, 4 very active, 5 extremely active.',
  },
  fitnessGoal: {
    type: 'string',
    enum: CONTRACT_ENUMS.fitnessGoal,
    description: 'Main training focus.',
  },
  weightGoal: {
    type: 'string',
    enum: CONTRACT_ENUMS.weightGoal,
    description: 'Whether they want to lose, gain or keep their weight.',
  },
  trainingLocation: {
    type: 'string',
    enum: CONTRACT_ENUMS.trainingLocation,
    description: 'Where they train.',
  },
  trainingDaysPerWeek: { type: 'integer', description: 'Training days per week: 2, 3, 4 or 5.' },
  trainingAutonomy: {
    type: 'string',
    enum: CONTRACT_ENUMS.trainingAutonomy,
    description: 'suggest = the app may adjust loads itself; manual = it leaves the numbers alone.',
  },
  breakLength: {
    type: 'string',
    enum: CONTRACT_ENUMS.breakLength,
    description: 'Only if they are coming back after a break from training: how long it was.',
  },
} as const satisfies Record<string, PatchField>;

export type TurnPatchKey = keyof typeof TURN_PATCH_FIELDS;
export const TURN_PATCH_KEYS = Object.keys(TURN_PATCH_FIELDS) as TurnPatchKey[];

const MAX_ASKED_FIELDS = 4;
const MAX_REPLY_CHARS = 1200;

function patchProperty(field: PatchField, dialect: StructuredDialect): Record<string, unknown> {
  const enumValues = field.enum;
  switch (dialect) {
    case 'openai':
      // Strict mode needs every property required, so "nothing this turn" is an explicit null.
      return {
        type: [field.type, 'null'],
        ...(enumValues ? { enum: [...enumValues, null] } : {}),
        description: field.description,
      };
    case 'gemini':
      return {
        type: field.type,
        nullable: true,
        ...(enumValues ? { enum: [...enumValues] } : {}),
        description: field.description,
      };
    case 'on-device':
      return {
        type: field.type,
        ...(enumValues ? { enum: [...enumValues] } : {}),
        description: field.description,
      };
  }
}

/** The JSON Schema for one assistant turn, in the dialect the provider accepts. */
export function buildTurnJsonSchema(dialect: StructuredDialect): object {
  const patchProperties = Object.fromEntries(
    TURN_PATCH_KEYS.map((key) => [key, patchProperty(TURN_PATCH_FIELDS[key], dialect)])
  );
  const strict = dialect === 'openai';

  return {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'What to say to the person next. Plain text.' },
      patch: {
        type: 'object',
        description:
          'Only what the person stated in their latest message. Null for everything else.',
        properties: patchProperties,
        ...(strict ? { required: TURN_PATCH_KEYS, additionalProperties: false } : {}),
      },
      askedFields: {
        type: 'array',
        description: 'The answers the reply asks about, so the app can offer quick choices.',
        items: { type: 'string', enum: [...FIELD_KEYS] },
      },
      readyForReview: {
        type: 'boolean',
        description: 'True only after the person confirmed the summary of their answers.',
      },
    },
    required: ['reply', 'patch', 'askedFields', 'readyForReview'],
    ...(strict ? { additionalProperties: false } : {}),
  };
}

export type ParsedAiTurn =
  | {
      ok: true;
      reply: string;
      draftPatch: OnboardingAnswersDraft;
      askedFields: FieldKey[];
      readyForReview: boolean;
      /** Values from this turn that failed validation; the next prompt asks for them again. */
      rejected: FieldIssue[];
    }
  | { ok: false };

/** Validates one assistant turn. `null` in the patch means "nothing new", never "erase". */
export function parseAiTurn(value: unknown, today: Date): ParsedAiTurn {
  if (!isRecord(value) || typeof value.reply !== 'string' || !value.reply.trim()) {
    return { ok: false };
  }

  const { draft, issues } = normalizeAnswers(
    flatToDocument(isRecord(value.patch) ? value.patch : {}),
    today
  );
  const asked = Array.isArray(value.askedFields)
    ? [...new Set(value.askedFields)].filter((field): field is FieldKey =>
        (FIELD_KEYS as readonly unknown[]).includes(field)
      )
    : [];

  return {
    ok: true,
    reply: value.reply.trim().slice(0, MAX_REPLY_CHARS),
    draftPatch: draft,
    askedFields: asked.slice(0, MAX_ASKED_FIELDS),
    readyForReview: value.readyForReview === true,
    rejected: issues,
  };
}
