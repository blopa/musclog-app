import { subWeeks } from 'date-fns';

import { localCalendarDayDate } from '@/utils/calendarDate';

/** Quick-date shortcuts shown in the date picker when logging a past period. */
export function getPastPeriodQuickDates(
  t: (key: string, opts?: Record<string, unknown>) => string
): { label: string; date: Date }[] {
  const now = new Date();
  return [
    { label: t('common.weeksAgo', { count: 4 }), date: localCalendarDayDate(subWeeks(now, 4)) },
    { label: t('common.weeksAgo', { count: 8 }), date: localCalendarDayDate(subWeeks(now, 8)) },
    { label: t('common.weeksAgo', { count: 12 }), date: localCalendarDayDate(subWeeks(now, 12)) },
  ];
}
