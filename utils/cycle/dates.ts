import { addDays } from 'date-fns';

/**
 * `ms` moved by whole calendar days, staying on the same local wall-clock time. Adding
 * `n * 86_400_000` instead lands an hour off local midnight whenever a daylight-saving change
 * falls in between, which shifts a predicted date by a day at the edge of a range.
 */
export function addCalendarDays(ms: number, days: number): number {
  return addDays(new Date(ms), days).getTime();
}
