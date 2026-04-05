/**
 * Calendar "day key" convention for the app:
 *
 * Stored numeric timestamps that represent a calendar day (nutrition_logs.date,
 * progress-style day keys, diary pickers) are **start of that calendar day in the
 * device local timezone** — same idea as DateNavigator / DatePickerModal.
 *
 * Use {@link formatLocalCalendarDayIso} for yyyy-MM-dd strings (APIs, filenames, canonical DOB in forms).
 * Use {@link formatLocalCalendarMonthDayNumericIntl} / {@link formatLocalCalendarDayNumericIntl} with a
 * BCP-47 tag (e.g. `i18n.language`) for locale-aware numeric date display.
 * Use {@link formatLocalCalendarMonthKey} / {@link formatLocalMonthYearLongFromMonthKey} for
 * month grouping labels (e.g. workout history). Use {@link getLocalCalendarYear} for year pickers.
 * Use {@link localCalendarDayPlusDays} for prev/next calendar day navigation.
 *
 * Do **not** use these helpers for wall-clock events (workout start time,
 * notifications). Use real instants (Date.now(), etc.) instead.
 * For ~24h **duration** math between instants, {@link MS_PER_SOLAR_DAY} is the shared constant.
 *
 * Other date uses (birthday pickers, chart month labels, cycle math in ms) may
 * still use `Date`/`date-fns` directly — those are not "calendar day keys" in the
 * nutrition diary sense.
 *
 * For "was this goal created before end of calendar day D?" style queries, use
 * `endOfDay` from date-fns on the Date — that semantic is different from a day key.
 */

import type { Locale } from 'date-fns';
import { addDays, differenceInCalendarDays, format, getYear, parseISO, startOfDay } from 'date-fns';

/**
 * Mean solar day length in milliseconds (24h). Use for **approximate** durations between
 * instants (e.g. coarse spacing, tests). Do **not** use for calendar day boundaries,
 * inclusive diary ranges, or DST-aware “N calendar days” — use {@link localDayStartMs},
 * {@link localDayKeyPlusCalendarDays}, {@link localDayHalfOpenRange}, etc.
 */
export const MS_PER_SOLAR_DAY = 24 * 60 * 60 * 1000;

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
 * Same as {@link localDayStartMs} but returns a `Date` for picker state / props
 * (avoids stray time-of-day from calendar widgets).
 */
export function localCalendarDayDate(date: Date): Date {
  return new Date(localDayStartMs(date));
}

/**
 * Picker/`Date` props from a stored **local day key** (midnight ms) or any instant on that day.
 * Prefer over `localCalendarDayDate(new Date(ms))` at call sites.
 */
export function localCalendarDayDateFromDayKeyMs(dayKeyMs: number): Date {
  return localCalendarDayDate(new Date(dayKeyMs));
}

/**
 * Move a calendar `Date` by `deltaDays` in the **local** timezone (DST-safe).
 * Prefer over `date.setDate(date.getDate() ± n)` for picker state and navigation.
 */
export function localCalendarDayPlusDays(date: Date, deltaDays: number): Date {
  return localCalendarDayDate(addDays(date, deltaDays));
}

/** Local calendar yyyy-MM-dd (not UTC). Use for APIs, filenames, and coach date strings. */
export function formatLocalCalendarDayIso(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Local calendar year (for filters, pickers). Prefer over `date.getFullYear()` so formatting
 * stays aligned with date-fns / {@link formatLocalCalendarDayIso}.
 */
export function getLocalCalendarYear(date: Date): number {
  return getYear(date);
}

/**
 * Stable `yyyy-MM` key for grouping (e.g. workout history by month). Uses local calendar components.
 */
export function formatLocalCalendarMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

/**
 * Localized long month + year for a `yyyy-MM` month key (first local day of that month).
 */
export function formatLocalMonthYearLongFromMonthKey(monthKey: string, locale: Locale): string {
  return format(parseLocalCalendarDate(`${monthKey}-01`), 'MMMM yyyy', { locale });
}

/**
 * Fixed **US** `MM/dd/yyyy` (not locale-aware). Prefer {@link formatLocalCalendarDayNumericIntl}
 * or {@link formatLocalCalendarDayIso} for user-facing strings; kept for unit tests and
 * any legacy exports that must stay US-shaped.
 */
export function formatLocalCalendarDayMmDdYyyy(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return format(d, 'MM/dd/yyyy');
}

/**
 * Compact numeric month/day for chart axes — order and separators follow the user's locale
 * (e.g. `7/3` vs `03.07.`). Prefer over fixed-pattern format strings.
 */
export function formatLocalCalendarMonthDayNumericIntl(
  date: Date | number,
  localeTag: string
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'numeric' }).format(d);
}

/**
 * Locale-aware numeric date (day/month/year). Use for profile DOB display, exports, etc.
 */
export function formatLocalCalendarDayNumericIntl(date: Date | number, localeTag: string): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * @deprecated Prefer {@link formatLocalCalendarMonthDayNumericIntl} with `i18n.language`.
 * Kept as `en-US`-style numeric labels for tests and legacy call sites.
 */
export function formatLocalCalendarDayDdMm(date: Date | number): string {
  return formatLocalCalendarMonthDayNumericIntl(date, 'en-US');
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

/** Local calendar day key for today + `deltaDays` (e.g. +90 for a 90-day goal horizon). */
export function localDayKeyPlusCalendarDaysFromNow(deltaDays: number): number {
  return localDayKeyPlusCalendarDays(localDayStartMs(new Date()), deltaDays);
}

/**
 * True if both values fall on the same local calendar day.
 * Accepts a `Date` or a stored day key / instant in milliseconds.
 */
export function isSameLocalCalendarDay(a: Date | number, b: Date | number): boolean {
  const ta = typeof a === 'number' ? localDayStartFromUtcMs(a) : localDayStartMs(a);
  const tb = typeof b === 'number' ? localDayStartFromUtcMs(b) : localDayStartMs(b);
  return ta === tb;
}

/**
 * Rolling 7-**calendar**-day bucket index: 0 for the same local day as `rangeStartDayTs`,
 * 1 for the next block of 7 calendar days, etc. Uses {@link differenceInCalendarDays}
 * instead of dividing raw ms by `7 * 86400000`, so DST and variable day lengths do not
 * shift buckets. Used for empirical TDEE / historical nutrition weekly averages.
 */
export function localCalendarWeekIndexSince(dateTs: number, rangeStartDayTs: number): number {
  const a = localDayStartFromUtcMs(dateTs);
  const b = localDayStartFromUtcMs(rangeStartDayTs);
  return Math.floor(differenceInCalendarDays(new Date(a), new Date(b)) / 7);
}
