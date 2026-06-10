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

import { parseTimezoneOffsetMinutes } from '@/utils/timezone';

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
 * Resolves the instant `ms` to the **stored** midnight of the calendar day it fell on in
 * `timezone` (i.e. the actual epoch ms of local midnight = UTC midnight − offset). Defaults
 * to device local timezone if `timezone` (±HH:MM) is omitted.
 *
 * Contrast with {@link utcNormalizedDayKey}, which returns the **offset-removed** UTC midnight
 * (a comparable key across timezones). The two differ by exactly the offset: use
 * `utcNormalizedDayKey` whenever you compare/bucket records that may come from different
 * timezones, and `dayStartInTimezone` only when you need an instant in the stored frame
 * (e.g. computing DB query bounds, or same-day comparison in a single fixed timezone).
 */
export function dayStartInTimezone(ms: number, timezone?: string): number {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (offsetMinutes === null) {
    return localDayStartFromUtcMs(ms);
  }

  const offsetMs = offsetMinutes * 60000;
  const local = new Date(ms + offsetMs);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs;
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

/**
 * Buffer added to both ends of a date-range DB query to capture records stored in any
 * timezone (UTC−14 to UTC+14). After widening, always post-filter with
 * {@link utcNormalizedDayKey} so records are counted on their original calendar day.
 */
export const TIMEZONE_QUERY_BUFFER_MS = 14 * 60 * 60 * 1000; // 14 hours

/**
 * Converts a stored `(recordDate, timezone)` pair to a UTC-midnight value representing
 * the calendar date the user **experienced** when the record was created.
 *
 * Example: Amsterdam (+01:00) log stored as Jan 14 23:00 UTC → returns Jan 15 00:00 UTC.
 * Example: Brazil (−03:00) log stored as Jan 15 03:00 UTC   → returns Jan 15 00:00 UTC.
 *
 * Because the result is a UTC midnight, format it with `{ timeZone: 'UTC' }` (or
 * {@link formatUtcNormalizedDayIntl}) to display "Jan 15" correctly on any device.
 * Falls back to device-local calendar date when `timezone` is null/undefined.
 */
export function utcNormalizedDayKey(
  recordDate: number,
  timezone: string | null | undefined
): number {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (offsetMinutes === null) {
    const d = new Date(recordDate);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const offsetMs = offsetMinutes * 60000;
  const shifted = new Date(recordDate + offsetMs);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/**
 * UTC-midnight key for the calendar day a device-local `Date` represents (the day the
 * user picked in a date picker). This is the inverse anchor of {@link utcNormalizedDayKey}:
 * use it to turn a picked `Date` into the same comparable key space as stored records.
 */
export function utcDayKeyFromLocalDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Day-key range query descriptor: widened DB bounds plus the matching post-filter,
 * derived from the **same** `[startKey, endKey]`. Bundling both halves makes the
 * widen-then-trim contract impossible to break — there's no way to widen on one
 * window and filter on another. This is the only public entry point for
 * timezone-aware day-range reads; the widen and trim halves are intentionally
 * not exported separately.
 *
 * `lowerMs`/`upperMs` are widened by {@link TIMEZONE_QUERY_BUFFER_MS} on both ends to
 * capture records stored in any timezone (UTC−14…UTC+14). Build DB clauses with
 * `dayRangeClauses` from `database/dayKeyQuery.ts` (or `Q.gte(lowerMs)` + `Q.lt(upperMs)`
 * — the upper bound is exclusive), then trim the overscan with `filterRecords` (or
 * `matches` per record). For a single target day, pass the same value for `startKey`
 * and `endKey`; pass `inclusiveEnd: false` for half-open `[startKey, endKey)` ranges.
 */
export interface DayKeyRange {
  lowerMs: number;
  upperMs: number;
  matches: (recordDate: number, timezone?: string | null) => boolean;
  /** Trim a widened fetch back to the exact day range, by each record's own timezone. */
  filterRecords: <T extends { date: number; timezone?: string | null }>(records: T[]) => T[];
}

export function dayKeyRange(
  startKey: number,
  endKey: number,
  opts?: { inclusiveEnd?: boolean }
): DayKeyRange {
  const inclusiveEnd = opts?.inclusiveEnd ?? true;
  const matches = (recordDate: number, timezone?: string | null): boolean => {
    const key = utcNormalizedDayKey(recordDate, timezone);
    return key >= startKey && (inclusiveEnd ? key <= endKey : key < endKey);
  };

  return {
    lowerMs: startKey - TIMEZONE_QUERY_BUFFER_MS,
    upperMs: endKey + MS_PER_SOLAR_DAY + TIMEZONE_QUERY_BUFFER_MS,
    matches,
    filterRecords: (records) => records.filter((r) => matches(r.date, r.timezone)),
  };
}

/** {@link dayKeyRange} for a single device-local picked day (the common diary case). */
export function dayKeyRangeForLocalDate(date: Date): DayKeyRange {
  const key = utcDayKeyFromLocalDate(date);
  return dayKeyRange(key, key);
}

/**
 * Rolling 7-day bucket index in UTC-normalized-key space: 0 for `utcStartKey`'s week,
 * 1 for the next block of 7 days, etc. Both arguments must be UTC-midnight day keys
 * (from {@link utcNormalizedDayKey} / {@link utcDayKeyFromLocalDate}). Shared by the
 * empirical-TDEE and historical-nutrition weekly-average bucketing.
 */
export function utcWeekIndex(utcDayKey: number, utcStartKey: number): number {
  return Math.floor((utcDayKey - utcStartKey) / (7 * MS_PER_SOLAR_DAY));
}

/**
 * Groups dated points into rolling 7-day buckets keyed by {@link utcWeekIndex}, normalizing
 * each point's `date` by its own stored `timezone`. Shared by the empirical-TDEE and
 * historical-nutrition weekly-average paths (weight, body-fat, …).
 */
export function bucketPointsByUtcWeek<T extends { date: number; timezone?: string | null }>(
  points: T[],
  utcStartKey: number
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const p of points) {
    const week = utcWeekIndex(utcNormalizedDayKey(p.date, p.timezone), utcStartKey);
    const bucket = map.get(week);
    if (bucket) {
      bucket.push(p);
    } else {
      map.set(week, [p]);
    }
  }

  return map;
}

/**
 * Converts a stored `(recordDate, timezone)` day pair into a device-local Date
 * carrying the same calendar fields. This is intended for date-picker state,
 * where the picker expects local `Date` objects but the stored day belongs to
 * the record's captured offset.
 */
export function calendarDateFromRecordDay(
  recordDate: number,
  timezone: string | null | undefined
): Date {
  const dayKey = utcNormalizedDayKey(recordDate, timezone);
  const d = new Date(dayKey);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Builds the stored midnight timestamp for `date` in a fixed offset timezone.
 * Falls back to the device-local day key when the timezone is missing/invalid.
 */
export function dayKeyForCalendarDateInTimezone(
  date: Date,
  timezone: string | null | undefined
): number {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (offsetMinutes === null) {
    return localDayStartMs(date);
  }

  const offsetMs = offsetMinutes * 60000;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - offsetMs;
}

/**
 * Combines the calendar day of `dayDate` with the wall-clock time of `timeDate`
 * into a single device-local `Date`. Used when a record's stored timestamp must
 * carry the actual time-of-day a thing happened (e.g. nutrition_logs.date), not
 * just the calendar day. Unlike a day key, the time-of-day is preserved.
 */
export function combineLocalDateAndTime(dayDate: Date, timeDate: Date): Date {
  return new Date(
    dayDate.getFullYear(),
    dayDate.getMonth(),
    dayDate.getDate(),
    timeDate.getHours(),
    timeDate.getMinutes(),
    timeDate.getSeconds()
  );
}

/**
 * Time-aware sibling of {@link dayKeyForCalendarDateInTimezone}: builds the stored
 * instant for the calendar day of `dayDate` at the wall-clock time of `timeDate`,
 * anchored to a fixed offset timezone. Falls back to a device-local combine when
 * the timezone is missing/invalid. Because it adds a within-day time-of-day, the
 * UTC-normalized day key (see {@link utcNormalizedDayKey}) is unchanged.
 */
export function instantForDateTimeInTimezone(
  dayDate: Date,
  timeDate: Date,
  timezone: string | null | undefined
): number {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (offsetMinutes === null) {
    return combineLocalDateAndTime(dayDate, timeDate).getTime();
  }

  const offsetMs = offsetMinutes * 60000;
  return (
    Date.UTC(
      dayDate.getFullYear(),
      dayDate.getMonth(),
      dayDate.getDate(),
      timeDate.getHours(),
      timeDate.getMinutes(),
      timeDate.getSeconds()
    ) - offsetMs
  );
}

/**
 * Returns the calendar day of `dayDate` stamped with the **current** device-local
 * time-of-day. Used by non-interactive callers that only have a target day but
 * should record "now" as the time (e.g. applying a saved group to a chosen day).
 */
export function withCurrentTimeOnDay(dayDate: Date): Date {
  return combineLocalDateAndTime(dayDate, new Date());
}

/**
 * Milliseconds elapsed since the start of the calendar day that `ms` falls on, in
 * the record's `timezone` (device-local when omitted). Always in `[0, 86_400_000)`.
 * A return of `0` means `ms` sits exactly on local midnight — used to detect legacy
 * day-key timestamps that carry no time-of-day.
 */
export function timeOfDayMsInTimezone(ms: number, timezone?: string | null): number {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (offsetMinutes === null) {
    return ms - localDayStartFromUtcMs(ms);
  }

  const offsetMs = offsetMinutes * 60000;
  return (((ms + offsetMs) % MS_PER_SOLAR_DAY) + MS_PER_SOLAR_DAY) % MS_PER_SOLAR_DAY;
}

/**
 * A device-local `Date` that **renders** (via local `getHours`/`getMinutes`/… or
 * date-fns `format`) as the wall-clock time that instant `ms` had in `timezone`.
 * Use to seed time pickers / formatters that read local fields but must show a
 * record's original recording-timezone time. Falls back to `new Date(ms)` when the
 * timezone is missing/invalid.
 */
export function wallClockDateInTimezone(ms: number, timezone?: string | null): Date {
  const recordingOffset = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  if (recordingOffset === null) {
    return new Date(ms);
  }

  const deviceOffset = -new Date(ms).getTimezoneOffset();
  return new Date(ms + (recordingOffset - deviceOffset) * 60000);
}

/**
 * Locale-aware time-of-day of instant `ms` as it appeared on the wall clock in
 * `timezone`. Shifts by the stored offset and renders as UTC so it doesn't depend on
 * Intl fixed-offset zone support (unreliable on older Android). Falls back to
 * device-local time when the timezone is missing/invalid.
 */
export function formatTimeInTimezone(
  ms: number,
  timezone: string | null | undefined,
  localeTag: string
): string {
  const offsetMinutes = timezone ? parseTimezoneOffsetMinutes(timezone) : null;
  const displayDate = offsetMinutes !== null ? new Date(ms + offsetMinutes * 60000) : new Date(ms);
  return new Intl.DateTimeFormat(localeTag, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: offsetMinutes !== null ? 'UTC' : undefined,
  }).format(displayDate);
}

/**
 * Formats a UTC-normalized day key (from {@link utcNormalizedDayKey}) as a locale-aware
 * numeric month/day string. Always uses `timeZone: 'UTC'` so the displayed date matches
 * the original recording timezone, not the viewer's current device timezone.
 */
export function formatUtcNormalizedDayIntl(dayKeyMs: number, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(dayKeyMs);
}
