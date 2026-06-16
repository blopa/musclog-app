import {
  countScheduledSessionsPerWeek,
  getRollingWeeklyWorkoutRange,
} from '@/utils/weeklyWorkoutProgress';

describe('weeklyWorkoutProgress', () => {
  describe('getRollingWeeklyWorkoutRange', () => {
    it('returns the rolling seven local calendar days ending on the given date', () => {
      const range = getRollingWeeklyWorkoutRange(new Date(2024, 0, 15, 12));

      expect(range).toEqual({
        startDate: new Date(2024, 0, 9).getTime(),
        endDate: new Date(2024, 0, 16).getTime() - 1,
      });
    });
  });

  describe('countScheduledSessionsPerWeek', () => {
    it('counts unique weekDaysJson entries for scheduled templates', () => {
      expect(
        countScheduledSessionsPerWeek(
          [
            { id: 'template-1', weekDaysJson: [0, 2, 2] },
            { id: 'template-2', weekDaysJson: [4] },
          ],
          []
        )
      ).toBe(3);
    });

    it('falls back to unique schedule rows for templates without weekDaysJson', () => {
      expect(
        countScheduledSessionsPerWeek(
          [{ id: 'template-1' }, { id: 'template-2', weekDaysJson: [1, 3] }],
          [
            { templateId: 'template-1', dayOfWeek: 'Monday' },
            { templateId: 'template-1', dayOfWeek: 'Wednesday' },
            { templateId: 'template-1', dayOfWeek: 'Monday' },
            { templateId: 'template-2', dayOfWeek: 'Friday' },
          ]
        )
      ).toBe(4);
    });
  });
});
