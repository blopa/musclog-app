import { localCalendarDayPlusDays, localDayStartMs } from '@/utils/calendarDate';

export function getRollingWeeklyWorkoutRange(date: Date = new Date()): {
  startDate: number;
  endDate: number;
} {
  return {
    startDate: localDayStartMs(localCalendarDayPlusDays(date, -6)),
    endDate: localDayStartMs(localCalendarDayPlusDays(date, 1)) - 1,
  };
}
