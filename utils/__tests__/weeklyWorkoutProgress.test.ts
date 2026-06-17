import { getRollingWeeklyWorkoutRange } from '@/utils/weeklyWorkoutProgress';

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
});
