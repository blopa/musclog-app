import { countActiveDays } from '@/utils/comeback/activeDays';

// Monday 12 Oct 2026 to Monday 19 Oct 2026, local.
const weekStart = new Date(2026, 9, 12).getTime();
const weekEnd = new Date(2026, 9, 19).getTime();
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();

describe('countActiveDays', () => {
  it('counts a day once however many ways the person showed up on it', () => {
    expect(
      countActiveDays({
        workoutAt: [at(12, 8), at(12, 19)],
        foodDayAt: [at(12, 0)],
        minimumDays: ['2026-10-12'],
        weekStart,
        weekEnd,
      })
    ).toBe(1);
  });

  it('unions workouts, food days and minimum days', () => {
    expect(
      countActiveDays({
        workoutAt: [at(12)],
        foodDayAt: [at(14, 0)],
        minimumDays: ['2026-10-16'],
        weekStart,
        weekEnd,
      })
    ).toBe(3);
  });

  it('ignores anything outside the week, including a malformed key', () => {
    expect(
      countActiveDays({
        workoutAt: [at(11, 23), at(19, 0)],
        foodDayAt: [],
        minimumDays: ['2026-10-05', '2026-10-25', 'not-a-day'],
        weekStart,
        weekEnd,
      })
    ).toBe(0);
  });
});
