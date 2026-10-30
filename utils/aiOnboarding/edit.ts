import type { Units } from '@/constants/settings';
import {
  type FieldIssue,
  type FieldKey,
  normalizeAnswers,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { mergeAnswers } from '@/utils/aiOnboarding/merge';

/**
 * Edits made on the review screen. They go through the same validator as an import or an assistant
 * reply, so a value the person types can never reach the profile by a route the others cannot.
 */

export type FieldEdit =
  | { field: 'fullName' | 'bodyFatPercent'; text: string }
  | { field: 'heightCm' | 'weightKg'; text: string; units: Units }
  | { field: 'birthDate'; isoDate: string }
  | { field: 'activityLevel' | 'trainingDaysPerWeek'; value: number }
  | {
      field: Exclude<
        FieldKey,
        | 'fullName'
        | 'bodyFatPercent'
        | 'heightCm'
        | 'weightKg'
        | 'birthDate'
        | 'activityLevel'
        | 'trainingDaysPerWeek'
      >;
      value: string;
    };

export type FieldEditResult =
  { ok: true; draft: OnboardingAnswersDraft } | { ok: false; code: FieldIssue['code'] };

/** Reads a typed number, accepting a decimal comma; null when it is not a plain number. */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

/** Removes an optional answer, and the "estimated" flag that went with a birthday. */
export function clearField(draft: OnboardingAnswersDraft, field: FieldKey): OnboardingAnswersDraft {
  const { [field]: _removed, ...rest } = draft;
  if (field === 'birthDate') {
    const { dobEstimated: _estimated, ...withoutFlag } = rest;
    return withoutFlag;
  }

  return rest;
}

function toRaw(edit: FieldEdit): Record<string, unknown> | null {
  switch (edit.field) {
    case 'fullName':
      return { fullName: edit.text };
    case 'bodyFatPercent': {
      const value = parseDecimalInput(edit.text);
      return value === null ? null : { bodyFatPercent: value };
    }

    case 'heightCm': {
      const value = parseDecimalInput(edit.text);
      return value === null
        ? null
        : { height: { value, unit: edit.units === 'imperial' ? 'in' : 'cm' } };
    }

    case 'weightKg': {
      const value = parseDecimalInput(edit.text);
      return value === null
        ? null
        : { weight: { value, unit: edit.units === 'imperial' ? 'lb' : 'kg' } };
    }

    case 'birthDate':
      return { birthDate: edit.isoDate };
    case 'activityLevel':
      return { activityLevel: edit.value };
    case 'trainingDaysPerWeek':
      return { training: { daysPerWeek: edit.value } };
    case 'trainingLocation':
      return { training: { location: edit.value } };
    case 'trainingAutonomy':
      return { training: { autonomy: edit.value } };
    case 'breakLength':
      return { training: { comingBack: { breakLength: edit.value } } };
    default:
      return { [edit.field]: edit.value };
  }
}

/** Applies one edit to the draft, or says why the value was not accepted. */
export function editField(
  draft: OnboardingAnswersDraft,
  edit: FieldEdit,
  today: Date
): FieldEditResult {
  // An emptied optional text field means "remove this answer".
  if ((edit.field === 'fullName' || edit.field === 'bodyFatPercent') && !edit.text.trim()) {
    return { ok: true, draft: clearField(draft, edit.field) };
  }

  const raw = toRaw(edit);
  if (raw === null) {
    return { ok: false, code: 'invalid' };
  }

  const { draft: normalized, issues } = normalizeAnswers(raw, today);
  if (issues.length > 0) {
    return { ok: false, code: issues[0].code };
  }

  // A name that cleaned down to nothing leaves no answer to merge; that is a rejection, not a no-op.
  if (edit.field === 'fullName' && normalized.fullName === undefined) {
    return { ok: false, code: 'invalid' };
  }

  return { ok: true, draft: mergeAnswers(draft, normalized).draft };
}
