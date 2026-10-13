import type { WeeklyActivity } from '@/database/services/WeeklyReviewService';
import {
  hasWeeklyActivity,
  nutritionHalfState,
  shouldShowWeeklyReviewWelcome,
  trainingHalfState,
} from '@/utils/weeklyReviewEmptyState';

const activity = (overrides: Partial<WeeklyActivity> = {}): WeeklyActivity => ({
  workouts: 0,
  foodLogs: 0,
  weighIns: 0,
  everWorkout: false,
  everFood: false,
  ...overrides,
});

describe('weekly review half states', () => {
  it('treats a brand-new user as a first-timer on both halves', () => {
    expect(trainingHalfState(activity())).toBe('first');
    expect(nutritionHalfState(activity())).toBe('first');
    expect(hasWeeklyActivity(activity())).toBe(false);
  });

  it('tells a week off apart from never having logged', () => {
    const weekOff = activity({ everWorkout: true, everFood: true });
    expect(trainingHalfState(weekOff)).toBe('weekOff');
    expect(nutritionHalfState(weekOff)).toBe('weekOff');
  });

  it('gives each half its own state when only one has data', () => {
    const onlyWorkouts = activity({ workouts: 2, everWorkout: true });
    expect(trainingHalfState(onlyWorkouts)).toBe('data');
    expect(nutritionHalfState(onlyWorkouts)).toBe('first');

    const onlyFood = activity({ foodLogs: 4, everFood: true });
    expect(trainingHalfState(onlyFood)).toBe('first');
    expect(nutritionHalfState(onlyFood)).toBe('data');
  });

  it('a lone weigh-in makes the week reviewable but leaves nutrition without meals', () => {
    const weighInOnly = activity({ weighIns: 1 });
    expect(hasWeeklyActivity(weighInOnly)).toBe(true);
    expect(nutritionHalfState(weighInOnly)).toBe('first');
  });
});

describe('shouldShowWeeklyReviewWelcome', () => {
  const withData = activity({ workouts: 1, foodLogs: 3, everWorkout: true, everFood: true });

  it('waits for something to review', () => {
    expect(
      shouldShowWeeklyReviewWelcome({ seen: false, activity: activity(), viewingLatest: true })
    ).toBe(false);
  });

  it('shows once there is data on either half or both', () => {
    for (const week of [withData, activity({ workouts: 1 }), activity({ foodLogs: 1 })]) {
      expect(
        shouldShowWeeklyReviewWelcome({ seen: false, activity: week, viewingLatest: true })
      ).toBe(true);
    }
  });

  it('never shows again once seen, nor over a past review', () => {
    expect(
      shouldShowWeeklyReviewWelcome({ seen: true, activity: withData, viewingLatest: true })
    ).toBe(false);
    expect(
      shouldShowWeeklyReviewWelcome({ seen: false, activity: withData, viewingLatest: false })
    ).toBe(false);
  });
});
