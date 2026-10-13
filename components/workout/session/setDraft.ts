import type { Units } from '@/constants/settings';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import type { SessionSetValues } from '@/database/services/WorkoutSessionService';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { displayWeightKgNumeric } from '@/utils/formatDisplayWeight';
import { getDecimalSeparator, parseLocalizedDecimalString } from '@/utils/localizedDecimalInput';
import { displayToKg } from '@/utils/unitConversion';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

const formatInput = (value: number, locale: string, maximumFractionDigits: number) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits }).format(value);

/**
 * What a set's inputs show when the user has not typed anything: its current numbers, in the
 * exercise's unit and the locale's decimal separator. A set whose effort was never rated shows an
 * empty RIR, not a 0 that would read as "to failure".
 */
export function draftFromSet(
  set: EnrichedWorkoutLogSet,
  units: Units,
  locale: string
): SessionDraft {
  const rated = set.rirRecorded || (set.rirRecorded == null && isPerformedWorkoutSet(set));
  return {
    weight: formatInput(displayWeightKgNumeric(set.weight, units), locale, 2),
    reps: String(set.reps),
    rir: rated ? String(set.repsInReserve) : '',
    rpe: set.difficultyLevel ? String(set.difficultyLevel) : '',
    partials: String(set.partials ?? 0),
  };
}

/**
 * Copies last time's weight and reps into a set's inputs (tapping the "Last time" cell), keeping
 * whatever effort and partials the user already entered for this set.
 */
export function draftFromPrevious(
  current: SessionDraft,
  previous: { weightKg: number; reps: number },
  units: Units,
  locale: string
): SessionDraft {
  return {
    ...current,
    weight: formatInput(displayWeightKgNumeric(previous.weightKg, units), locale, 2),
    reps: String(previous.reps),
  };
}

/**
 * The weight a set currently shows, in kilograms: the typed draft when there is one, otherwise
 * the saved value. Anything that reasons about "the weight on the bar" (the plate calculator)
 * must read this, not the persisted set, or it disagrees with the form.
 */
export function liveWeightKg(
  set: EnrichedWorkoutLogSet,
  draft: Partial<SessionDraft> | undefined,
  units: Units,
  locale: string
): number {
  const typed = draft?.weight;
  if (typed === undefined || !typed.trim()) {
    return set.weight;
  }

  const parsed = parseLocalizedDecimalString(typed, getDecimalSeparator(locale));
  return Number.isFinite(parsed) ? displayToKg(parsed, units) : set.weight;
}

/** Tags a patch that types a weight with the unit and locale it was typed in. */
export function stampWeightPatch(
  patch: Partial<SessionDraft>,
  units: Units,
  locale: string
): Partial<SessionDraft> {
  return patch.weight === undefined
    ? patch
    : { ...patch, weightUnits: units, weightLocale: locale };
}

/**
 * Re-expresses a typed weight in the unit and locale now in effect. Returns the patch to apply, or
 * `null` when the draft is already current (or has no typed weight / predates the stamp).
 */
export function reconcileWeightDraft(
  draft: Partial<SessionDraft> | undefined,
  units: Units,
  locale: string
): Partial<SessionDraft> | null {
  if (
    !draft?.weight?.trim() ||
    !draft.weightUnits ||
    !draft.weightLocale ||
    (draft.weightUnits === units && draft.weightLocale === locale)
  ) {
    return null;
  }

  const parsed = parseLocalizedDecimalString(draft.weight, getDecimalSeparator(draft.weightLocale));
  if (!Number.isFinite(parsed)) {
    return { weight: '', weightUnits: units, weightLocale: locale };
  }

  const kg = displayToKg(parsed, draft.weightUnits);
  return {
    weight: formatInput(displayWeightKgNumeric(kg, units), locale, 2),
    weightUnits: units,
    weightLocale: locale,
  };
}

/** The values a completion saves, converted back to kilograms. */
export function valuesFromDraft(
  draft: SessionDraft,
  units: Units,
  locale: string,
  manual: boolean
): SessionSetValues {
  const separator = getDecimalSeparator(locale);
  const parse = (value?: string) => parseLocalizedDecimalString(value ?? '', separator);
  return {
    weight: displayToKg(parse(draft.weight), units),
    reps: Number(draft.reps),
    partials: Number(draft.partials || 0),
    repsInReserve: draft.rir?.trim() ? parse(draft.rir) : undefined,
    difficultyLevel: draft.rpe?.trim() ? parse(draft.rpe) : undefined,
    manual,
  };
}

/**
 * Moves a numeric input by `delta`, never below zero. `fractionDigits` keeps a stepped weight on
 * the step's own precision (62.5 + 2.5 must not print as 64.99999).
 */
export function stepInput(
  value: string,
  delta: number,
  locale: string,
  fractionDigits: number
): string {
  const current = parseLocalizedDecimalString(value, getDecimalSeparator(locale));
  const next = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
  const factor = 10 ** fractionDigits;
  return formatInput(Math.round(next * factor) / factor, locale, fractionDigits);
}
