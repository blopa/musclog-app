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
