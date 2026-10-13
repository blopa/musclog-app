import type { WeeklyActivity } from '@/database/services/WeeklyReviewService';

/**
 * What one half of a Weekly Review has to show:
 * - `data`: the reviewed week has something to summarize;
 * - `weekOff`: nothing this week, but the user has logged before;
 * - `first`: nothing ever — a new user, who needs "log your first …" rather than a summary of zeros.
 */
export type ReviewHalfState = 'data' | 'weekOff' | 'first';

export function hasWeeklyActivity(activity: WeeklyActivity): boolean {
  return activity.workouts > 0 || activity.foodLogs > 0 || activity.weighIns > 0;
}

export function trainingHalfState(activity: WeeklyActivity): ReviewHalfState {
  if (activity.workouts > 0) {
    return 'data';
  }
  return activity.everWorkout ? 'weekOff' : 'first';
}

/** Food is what the nutrition half summarizes; a lone weigh-in still leaves it with no meals. */
export function nutritionHalfState(activity: WeeklyActivity): ReviewHalfState {
  if (activity.foodLogs > 0) {
    return 'data';
  }
  return activity.everFood ? 'weekOff' : 'first';
}

/**
 * The one-time welcome explains what a review is for, so it waits until there is something to
 * review: on an empty week it would explain a page that has nothing on it. Only the latest review
 * qualifies — a past week opened from history is not anyone's first look at the feature.
 */
export function shouldShowWeeklyReviewWelcome({
  seen,
  activity,
  viewingLatest,
}: {
  seen: boolean;
  activity: WeeklyActivity;
  viewingLatest: boolean;
}): boolean {
  return !seen && viewingLatest && hasWeeklyActivity(activity);
}
