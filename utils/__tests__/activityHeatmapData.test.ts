import { activityLevel } from '@/utils/activityHeatmap';
import {
  NUTRITION_HEATMAP_MAX_VALUE,
  nutritionHeatmapDays,
  WORKOUT_HEATMAP_MAX_VALUE,
  workoutHeatmapDays,
} from '@/utils/activityHeatmapData';

const byDate = (days: { date: string; value: number }[]) =>
  Object.fromEntries(days.map((day) => [day.date, day.value]));

describe('workoutHeatmapDays', () => {
  it('counts workouts on the local day they started', () => {
    const days = workoutHeatmapDays([
      new Date(2026, 9, 12, 7, 30).getTime(),
      new Date(2026, 9, 12, 19, 0).getTime(),
      new Date(2026, 9, 14, 6, 0).getTime(),
    ]);

    expect(byDate(days)).toEqual({ '2026-10-12': 2, '2026-10-14': 1 });
  });

  it('keeps a workout that runs past midnight on the day it began', () => {
    const days = workoutHeatmapDays([new Date(2026, 9, 12, 23, 40).getTime()]);

    expect(byDate(days)).toEqual({ '2026-10-12': 1 });
  });

  it('is empty without workouts', () => {
    expect(workoutHeatmapDays([])).toEqual([]);
  });
});

describe('nutritionHeatmapDays', () => {
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

  it('counts distinct meal types, not food rows', () => {
    const days = nutritionHeatmapDays([
      { date: at(12, 8), type: 'breakfast' },
      // One AI meal expanded into many ingredient rows is still one lunch.
      { date: at(12, 13), type: 'lunch' },
      { date: at(12, 13), type: 'lunch' },
      { date: at(12, 13), type: 'lunch' },
      { date: at(13, 20), type: 'dinner' },
    ]);

    expect(byDate(days)).toEqual({ '2026-10-12': 2, '2026-10-13': 1 });
  });

  it("buckets a log by the timezone it was recorded in, not the device's", () => {
    // 2026-10-12 23:30 in UTC+02:00 is 21:30 UTC the same day; stored with its offset it must stay
    // on the 12th however the viewing device is configured.
    const days = nutritionHeatmapDays([
      { date: Date.UTC(2026, 9, 12, 21, 30), timezone: '+02:00', type: 'dinner' },
      // 2026-10-12 23:30 in UTC-05:00 is the 13th 04:30 UTC, yet still the 12th for the person.
      { date: Date.UTC(2026, 9, 13, 4, 30), timezone: '-05:00', type: 'snack' },
    ]);

    expect(byDate(days)).toEqual({ '2026-10-12': 2 });
  });
});

describe('heatmap scales', () => {
  it('reads one workout as a solid step and two as the darkest', () => {
    expect(activityLevel(1, WORKOUT_HEATMAP_MAX_VALUE)).toBe(3);
    expect(activityLevel(2, WORKOUT_HEATMAP_MAX_VALUE)).toBe(4);
    expect(activityLevel(3, WORKOUT_HEATMAP_MAX_VALUE)).toBe(4);
  });

  it('gives every extra meal type its own step, up to four', () => {
    expect(
      [1, 2, 3, 4, 5].map((meals) => activityLevel(meals, NUTRITION_HEATMAP_MAX_VALUE))
    ).toEqual([1, 2, 3, 4, 4]);
  });
});
