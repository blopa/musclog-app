import {
  ageFromBirthDate,
  FIELD_KEYS,
  type FieldKey,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';

/** Measured values within this much of each other are the same answer (rounding between units). */
const NUMBER_TOLERANCE = 0.05;

/**
 * Folds new answers into the draft: later answers win, fields the newcomer does not mention are
 * left alone. A real birthday given later clears the "estimated from age" flag.
 */
export function mergeAnswers(
  base: OnboardingAnswersDraft,
  incoming: OnboardingAnswersDraft
): { draft: OnboardingAnswersDraft; changed: FieldKey[] } {
  const draft: OnboardingAnswersDraft = { ...base };
  const changed: FieldKey[] = [];
  const target = draft as Record<string, unknown>;

  for (const field of FIELD_KEYS) {
    const value = incoming[field];
    if (value !== undefined && value !== base[field]) {
      target[field] = value;
      changed.push(field);
    }
  }

  if (incoming.birthDate !== undefined) {
    if (incoming.dobEstimated) {
      draft.dobEstimated = true;
    } else {
      delete draft.dobEstimated;
    }
  }

  return { draft, changed };
}

/** The saved profile in the draft's own shape; absent values stay absent, never defaulted. */
export type ProfileSnapshot = OnboardingAnswersDraft;

export type DiffRow = {
  field: FieldKey;
  current: OnboardingAnswersDraft[FieldKey];
  incoming: OnboardingAnswersDraft[FieldKey];
  changed: boolean;
  /** Changed answers are kept unless the person unticks them; unchanged ones start dropped. */
  keepByDefault: boolean;
};

const sameValue = (
  field: FieldKey,
  current: unknown,
  incoming: unknown,
  currentSnapshot: ProfileSnapshot,
  incomingDraft: OnboardingAnswersDraft,
  today: Date
): boolean => {
  if (typeof current === 'number' && typeof incoming === 'number') {
    return Math.abs(current - incoming) < NUMBER_TOLERANCE;
  }

  // An age-only answer must not overwrite a birthday the person already gave for the same age.
  if (
    field === 'birthDate' &&
    incomingDraft.dobEstimated &&
    typeof currentSnapshot.birthDate === 'string' &&
    typeof incomingDraft.birthDate === 'string'
  ) {
    return (
      ageFromBirthDate(currentSnapshot.birthDate, today) ===
      ageFromBirthDate(incomingDraft.birthDate, today)
    );
  }

  return current === incoming;
};

/** One row per answered field, comparing it with what is saved now. */
export function buildProfileDiff(
  current: ProfileSnapshot,
  incoming: OnboardingAnswersDraft,
  today: Date
): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const field of FIELD_KEYS) {
    const value = incoming[field];
    if (value === undefined) {
      continue;
    }

    const changed = !sameValue(field, current[field], value, current, incoming, today);
    rows.push({ field, current: current[field], incoming: value, changed, keepByDefault: changed });
  }

  return rows;
}

/** The part of a draft the person chose to keep. */
export function selectKeptFields(
  draft: OnboardingAnswersDraft,
  kept: ReadonlySet<FieldKey>
): OnboardingAnswersDraft {
  const result: OnboardingAnswersDraft = {};
  const target = result as Record<string, unknown>;
  for (const field of FIELD_KEYS) {
    if (kept.has(field) && draft[field] !== undefined) {
      target[field] = draft[field];
    }
  }

  if (result.birthDate !== undefined && draft.dobEstimated) {
    result.dobEstimated = true;
  }

  return result;
}
