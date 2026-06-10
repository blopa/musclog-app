import { Q } from '@nozbe/watermelondb';

import type { DayKeyRange } from '@/utils/calendarDate';

/**
 * WatermelonDB clauses for the widened bounds of a {@link DayKeyRange}:
 * `column >= lowerMs AND column < upperMs` (upper bound exclusive). Always pair the
 * fetched rows with `range.filterRecords(...)` (or `range.matches`) to trim the
 * timezone overscan back to the exact day range.
 */
export function dayRangeClauses(
  range: Pick<DayKeyRange, 'lowerMs' | 'upperMs'>,
  column = 'date'
): Q.Clause[] {
  return [Q.where(column, Q.gte(range.lowerMs)), Q.where(column, Q.lt(range.upperMs))];
}
