import type { Units } from '@/constants/settings';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import type { SessionSetValues } from '@/database/services/WorkoutSessionService';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { displayWeightKgNumeric } from '@/utils/formatDisplayWeight';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  parseStrictLocalizedNumber,
} from '@/utils/localizedDecimalInput';
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

  // A stamped draft is read in the unit and locale it was typed in, so it means the same load
  // after the user switches either mid-session.
  const parsed = parseLocalizedDecimalString(
    typed,
    getDecimalSeparator(draft?.weightLocale ?? locale)
  );
  return Number.isFinite(parsed) ? displayToKg(parsed, draft?.weightUnits ?? units) : set.weight;
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
 * Re-expresses a typed weight in the unit and locale now in effect, for display. Returns the
 * fields to show over the draft, or `null` when the draft is already current (or has no typed
 * weight / predates the stamp). It is applied when a draft is READ, never written back: the stored
 * draft keeps the text as typed with its stamp, so switching units back and forth converts from
 * the original every time instead of compounding rounding.
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

/** See `parseStrictLocalizedNumber`: an emptied weight used to complete the set at 0 kg. */
const strictNumber = (text: string | undefined, locale: string) =>
  parseStrictLocalizedNumber(text, getDecimalSeparator(locale));

/** The optional effort fields of the set-details sheet. */
export type EffortDraftField = 'rir' | 'rpe' | 'partials';

/** A field that stops a set from being completed as typed. */
export type SetDraftField = 'weight' | 'reps' | EffortDraftField;

/**
 * What each effort field accepts. RPE 1–10 and reps in reserve 0–9 are the same scale written two
 * ways (RPE = 10 − RIR), so a value one of them takes is one the other can show; partial reps share
 * the reps bound.
 */
export const EFFORT_RANGE = {
  rir: { min: 0, max: 9 },
  rpe: { min: 1, max: 10 },
} as const;

/** The most reps a set may record; matches the session writer's own bound. */
const MAX_SET_REPS = 999;

/**
 * Why a set cannot be completed with what its inputs show, or `null` when it can. Checked before
 * the save so the user is told which field to fix: an emptied reps field used to save a performed
 * set of 0 reps (`Number('')` is 0), which progression then read as a missed session, and an
 * emptied weight reached the writer as NaN and came back as a generic "not saved".
 *
 * Zero reps is refused too: a set that was not done is skipped, not completed.
 */
export function setDraftProblem(draft: SessionDraft, locale: string): SetDraftField | null {
  if (strictNumber(draft.weight, locale) == null) {
    return 'weight';
  }

  const reps = strictNumber(draft.reps, locale);
  if (reps == null || !Number.isInteger(reps) || reps <= 0 || reps > MAX_SET_REPS) {
    return 'reps';
  }

  return effortDraftProblems(draft, locale)[0] ?? null;
}

/**
 * The effort fields whose text cannot be saved. All of them are optional, so an empty field is
 * fine; a filled one must be a number in range (partial reps a whole one). Without this, any number
 * was accepted: an RPE of 400 skipped the RIR link and was stored as the set's difficulty.
 */
export function effortDraftProblems(draft: SessionDraft, locale: string): EffortDraftField[] {
  const problems: EffortDraftField[] = [];
  const outside = (text: string | undefined, min: number, max: number, integer = false) => {
    if (!text?.trim()) {
      return false;
    }

    const value = strictNumber(text, locale);
    return value == null || value < min || value > max || (integer && !Number.isInteger(value));
  };

  if (outside(draft.rir, EFFORT_RANGE.rir.min, EFFORT_RANGE.rir.max)) {
    problems.push('rir');
  }

  if (outside(draft.rpe, EFFORT_RANGE.rpe.min, EFFORT_RANGE.rpe.max)) {
    problems.push('rpe');
  }

  if (outside(draft.partials, 0, MAX_SET_REPS, true)) {
    problems.push('partials');
  }

  return problems;
}

/** The scale both effort inputs share: RPE 10 is a set with nothing left in reserve. */
const RPE_AT_FAILURE = 10;

/**
 * Keeps reps in reserve and RPE describing the same set. They are one scale written two ways
 * (RPE = 10 − RIR), and as independent fields a set could be saved as "2 in reserve, RPE 10".
 * Typing either one rewrites the other; clearing either clears both. A value that does not parse
 * is left for the user to finish typing and does not touch the other field.
 */
export function linkEffortPatch(
  patch: Partial<SessionDraft>,
  locale: string
): Partial<SessionDraft> {
  const counterpart = (text: string, min: number): string | null => {
    if (!text.trim()) {
      return '';
    }

    const value = strictNumber(text, locale);
    if (value == null || value > RPE_AT_FAILURE) {
      return null;
    }

    return formatInput(Math.max(min, RPE_AT_FAILURE - value), locale, 1);
  };

  if (patch.rir !== undefined && patch.rpe === undefined) {
    const rpe = counterpart(patch.rir, 1);
    return rpe == null ? patch : { ...patch, rpe };
  }

  if (patch.rpe !== undefined && patch.rir === undefined) {
    const rir = counterpart(patch.rpe, 0);
    return rir == null ? patch : { ...patch, rir };
  }

  return patch;
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
  const difficultyLevel = draft.rpe?.trim() ? parse(draft.rpe) : undefined;
  let repsInReserve: number | undefined;
  if (draft.rir?.trim()) {
    repsInReserve = parse(draft.rir);
  } else if (difficultyLevel != null && Number.isFinite(difficultyLevel)) {
    // RPE alone still rates the set: progression runs on reps in reserve, and a lifter who logs
    // effort as RPE must not be treated as never having rated it.
    repsInReserve = Math.max(0, RPE_AT_FAILURE - difficultyLevel);
  }

  return {
    weight: displayToKg(parse(draft.weight), units),
    reps: Number(draft.reps),
    partials: Number(draft.partials || 0),
    repsInReserve,
    difficultyLevel,
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
