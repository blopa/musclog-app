import type { Units } from '@/constants/settings';
import {
  CONTRACT_ENUMS,
  type FieldIssue,
  type FieldKey,
  flatToDocument,
  normalizeAnswers,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { mergeAnswers } from '@/utils/aiOnboarding/merge';
import { displayToCm, displayToKg } from '@/utils/unitConversion';

/**
 * Edits made on the review screen. They go through the same validator as an import or an assistant
 * reply, so a value the person types can never reach the profile by a route the others cannot.
 */

export type FieldEdit =
  | { field: 'fullName' | 'bodyFatPercent'; text: string }
  | { field: 'heightCm' | 'weightKg'; text: string; units: Units }
  | { field: 'birthDate'; isoDate: string }
  | { field: 'activityLevel' | 'trainingDaysPerWeek'; value: number }
  /** The answers picked from a fixed list: exactly the contract's enumerations. */
  | { field: keyof typeof CONTRACT_ENUMS; value: string };

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

/** The edit as flat answers in metric, which `flatToDocument` nests into the contract's shape. */
function toFlat(edit: FieldEdit): Record<string, unknown> | null {
  switch (edit.field) {
    case 'fullName':
      return { fullName: edit.text };
    case 'bodyFatPercent':
    case 'heightCm':
    case 'weightKg': {
      const typed = parseDecimalInput(edit.text);
      if (typed === null) {
        return null;
      }

      if (edit.field === 'heightCm') {
        return { heightCm: displayToCm(typed, edit.units) };
      }

      if (edit.field === 'weightKg') {
        return { weightKg: displayToKg(typed, edit.units) };
      }

      return { bodyFatPercent: typed };
    }

    case 'birthDate':
      return { birthDate: edit.isoDate };
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

  const flat = toFlat(edit);
  if (flat === null) {
    return { ok: false, code: 'invalid' };
  }

  const { draft: normalized, issues } = normalizeAnswers(flatToDocument(flat), today);
  if (issues.length > 0) {
    return { ok: false, code: issues[0].code };
  }

  // A name that cleaned down to nothing leaves no answer to merge; that is a rejection, not a no-op.
  if (edit.field === 'fullName' && normalized.fullName === undefined) {
    return { ok: false, code: 'invalid' };
  }

  return { ok: true, draft: mergeAnswers(draft, normalized).draft };
}
