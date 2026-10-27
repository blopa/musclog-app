import { defaultTrainingWeekDays, distributeWeekDays } from '@/utils/comeback/comebackSchedule';

describe('distributeWeekDays', () => {
  it('alternates workouts across the chosen days in weekday order', () => {
    expect(distributeWeekDays(2, [0, 2, 4])).toEqual([[0, 4], [2]]);
    expect(distributeWeekDays(2, [1, 4])).toEqual([[1], [4]]);
    expect(distributeWeekDays(2, [0, 1, 3, 4])).toEqual([
      [0, 3],
      [1, 4],
    ]);
  });

  it('gives only workout A a day when one day is chosen', () => {
    expect(distributeWeekDays(2, [3])).toEqual([[3], []]);
  });

  it('sorts and de-duplicates, and ignores impossible weekdays', () => {
    expect(distributeWeekDays(2, [4, 0, 4, 9, -1, 1.5])).toEqual([[0], [4]]);
  });

  it('handles no workouts and no days', () => {
    expect(distributeWeekDays(0, [1, 2])).toEqual([]);
    expect(distributeWeekDays(2, [])).toEqual([[], []]);
  });
});

describe('defaultTrainingWeekDays', () => {
  it('spaces sessions out and never puts the same day twice', () => {
    for (const count of [1, 2, 3, 4]) {
      const days = defaultTrainingWeekDays(count);

      expect(days).toHaveLength(count);
      expect(new Set(days).size).toBe(count);
      expect(days.every((day) => day >= 0 && day <= 6)).toBe(true);
    }
  });
});
