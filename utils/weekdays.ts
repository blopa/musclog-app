/**
 * The single mapping between a weekday index and the name stored in `schedules.day_of_week`.
 *
 * Deliberately its own module rather than a section of `utils/workout.ts`: that file pulls in
 * lucide icons, the theme, i18n and the `Schedule` model, so a pure consumer — `workoutScheduleOwnership.ts`
 * runs in the Jest `node` project — cannot import it. A local copy of this array is not a type
 * error, it is a silent divergence, which is exactly what happened once already.
 *
 * Index 0 is Monday, matching `WeekdayPicker` and `workout_plan_templates.week_days_json`.
 */

import type { DayOfWeek } from '@/database/models/Schedule';

export const WEEKDAY_NAMES: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Convert a stored day name to a `WeekdayPicker` index, or -1 when it is not a day name. */
export function dayNameToIndex(dayName: DayOfWeek | string): number {
  return WEEKDAY_NAMES.indexOf(dayName as DayOfWeek);
}

/** Convert a `WeekdayPicker` index to the name stored in the database. */
export function indexToDayName(index: number): DayOfWeek {
  return (WEEKDAY_NAMES[index] || WEEKDAY_NAMES[0]) as DayOfWeek;
}

/**
 * `Notifications.scheduleNotificationAsync`'s `weekday`, which is 1 = Sunday … 7 = Saturday —
 * neither our Monday-first index nor JS `Date#getDay`.
 */
export function toExpoWeekday(dayIndex: number): number {
  return ((dayIndex + 1) % 7) + 1;
}

/** JS `Date#getDay` (0 = Sunday) as a Monday-first index. */
export function jsDayToWeekdayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}
