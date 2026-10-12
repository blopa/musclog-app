import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import { localDayKeyPlusCalendarDays } from '@/utils/calendarDate';

it('reviews the seven completed calendar days before Monday and surfaces only the latest week', () => {
  const period = weeklyReviewPeriod(new Date(2026, 9, 14, 14), 1);
  expect(new Date(period.end).getDate()).toBe(12);
  expect(new Date(period.start).getDate()).toBe(5);
  expect(new Date(period.next).getDate()).toBe(19);
  expect(new Date(period.end).getHours()).toBe(0);
});
it('uses the selected weekday without altering goals and rejects invalid weekdays', () => {
  const period = weeklyReviewPeriod(new Date(2026, 9, 14, 14), 3);
  expect(new Date(period.end).getDate()).toBe(14);
  expect(() => weeklyReviewPeriod(new Date(), 8)).toThrow();
});
it.each([new Date(2026, 2, 30), new Date(2026, 9, 26)])(
  'keeps local midnights and seven calendar days across DST (%s)',
  (date) => {
    const period = weeklyReviewPeriod(date);
    expect(localDayKeyPlusCalendarDays(period.start, 7)).toBe(period.end);
    expect(new Date(period.start).getHours()).toBe(0);
    expect(new Date(period.end).getHours()).toBe(0);
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Amsterdam')
      expect((period.end - period.start) / 3600000).toBe(date.getMonth() === 2 ? 167 : 169);
  }
);
