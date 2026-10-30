/**
 * Spreading a program's workouts over the weekdays the person chose. Pure, so it runs in the Jest
 * `node` project; weekday indexes are Monday-first (0 = Monday), as plans store them.
 */

/**
 * Which weekdays each of `workoutCount` workouts falls on when they alternate across `weekDays`
 * (A, B, A, B … in weekday order). A workout that gets no weekday comes back with an empty list —
 * one training day a week is only workout A — and the caller leaves it out of a weekly plan, where
 * a member with no weekday would never be scheduled.
 */
export function distributeWeekDays(workoutCount: number, weekDays: readonly number[]): number[][] {
  const days = Array.from(
    new Set(weekDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
  ).sort((a, b) => a - b);
  const assigned: number[][] = Array.from({ length: Math.max(0, workoutCount) }, () => []);
  if (assigned.length === 0) {
    return assigned;
  }

  for (const [index, day] of days.entries()) {
    assigned[index % assigned.length].push(day);
  }

  return assigned;
}

/** Evenly spaced default training days for `count` sessions a week (Monday-first), e.g. 2 → Mon, Thu. */
export function defaultTrainingWeekDays(count: number): number[] {
  switch (Math.round(count)) {
    case 1:
      return [2];
    case 2:
      return [0, 3];
    case 3:
      return [0, 2, 4];
    default:
      return [0, 1, 3, 4];
  }
}
