import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { periodLastDay } from './periodRules';
import type { CyclePeriodInput } from './types';

/** Where a day sits relative to the user's own logged bleeding. No phase is estimated. */
export type PeriodBand = 'period' | 'before' | 'other';

/** Days before a logged start that count as "just before a period". */
export const BEFORE_PERIOD_DAYS = 5;

/**
 * Classifies a day using only what was logged: inside a logged period, in the days just before
 * the next logged start, or neither. A period with an unknown end occupies its start day only,
 * so a forgotten end never labels weeks as bleeding.
 */
export function periodBandAt(periods: CyclePeriodInput[], day: number): PeriodBand {
  for (const period of periods) {
    if (day >= period.startDate && day <= periodLastDay(period)) {
      return 'period';
    }
  }

  for (const period of periods) {
    const gap = Math.round((period.startDate - day) / MS_PER_SOLAR_DAY);
    if (gap >= 1 && gap <= BEFORE_PERIOD_DAYS) {
      return 'before';
    }
  }

  return 'other';
}
