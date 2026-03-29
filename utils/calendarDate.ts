/**
 * Calendar "day key" convention for the app:
 *
 * Stored numeric timestamps that represent a calendar day (nutrition_logs.date,
 * progress-style day keys, diary pickers) are **start of that calendar day in the
 * device local timezone** — same idea as DateNavigator / DatePickerModal.
 *
 * Do **not** use these helpers for wall-clock events (workout start time,
 * notifications). Use real instants (Date.now(), etc.) instead.
 *
 * For "was this goal created before end of calendar day D?" style queries, use
 * `endOfDay` from date-fns on the Date — that semantic is different from a day key.
 */

import { addDays, parseISO, startOfDay } from 'date-fns';

/**
 * Parse a date-only ISO string (yyyy-MM-dd) as that calendar day in the **local**
 * timezone. Prefer over `new Date('yyyy-MM-dd')`, which ES5 parses as UTC midnight
 * and can shift the calendar day near zone boundaries.
 */
export function parseLocalCalendarDate(isoDateOnly: string): Date {
  return parseISO(isoDateOnly);
}

/** Local day start ms from a yyyy-MM-dd string (see {@link parseLocalCalendarDate}). */
export function localDayStartMsFromIsoDateOnly(isoDateOnly: string): number {
  return localDayStartMs(parseLocalCalendarDate(isoDateOnly));
}

/** Start of the local calendar day for `date`, in milliseconds since epoch. */
export function localDayStartMs(date: Date): number {
  return startOfDay(date).getTime();
}

/**
 * Normalize any instant to the local calendar day start that contains it.
 * Use for streaks, grouping, or comparing stored day keys with "now".
 */
export function localDayStartFromUtcMs(ms: number): number {
  return startOfDay(new Date(ms)).getTime();
}

/** Exclusive upper bound: start of the local calendar day after `date`. */
export function localNextDayStartMsFromDate(date: Date): number {
  return startOfDay(addDays(date, 1)).getTime();
}

/** Half-open range [start, nextStart) for DB queries. */
export function localDayHalfOpenRange(date: Date): { start: number; nextStart: number } {
  const start = localDayStartMs(date);
  const nextStart = localNextDayStartMsFromDate(date);
  return { start, nextStart };
}

/** Max inclusive timestamp for `Q.between(start, max)` style queries. */
export function localDayClosedRangeMaxMs(date: Date): number {
  return localNextDayStartMsFromDate(date) - 1;
}

/**
 * Move a stored local day key (or any instant on that calendar day) by
 * `deltaDays` **calendar** days. Prefer this over `n * 24 * 60 * 60 * 1000` so
 * DST and month boundaries match the rest of the app.
 */
export function localDayKeyPlusCalendarDays(dayKeyMs: number, deltaDays: number): number {
  return localDayStartMs(addDays(new Date(dayKeyMs), deltaDays));
}
