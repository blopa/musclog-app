import { localDayKeyPlusCalendarDays, localDayStartMs } from './calendarDate';
import { getTimezoneAt } from './timezone';

export function weeklyReviewPeriod(date: Date = new Date(), weekday = 1) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error('Invalid weekday');
  }

  const today = localDayStartMs(date);
  const daysSinceReview = (new Date(today).getDay() - weekday + 7) % 7;
  const end = localDayKeyPlusCalendarDays(today, -daysSinceReview);
  return {
    start: localDayKeyPlusCalendarDays(end, -7),
    end,
    next: localDayKeyPlusCalendarDays(end, 7),
    timezone: getTimezoneAt(new Date(end)),
  };
}
