import { format } from 'date-fns';

/**
 * "Active days this week" for the streak card during a comeback. A consecutive-day streak reads as a
 * hard 0 to someone returning from a break, so while a comeback runs the card counts days the person
 * showed up instead: a workout, any food logged, or their minimum. Pure — the caller hands in the
 * days it found, so this runs in the Jest `node` project.
 */

const dayKey = (ms: number) => format(new Date(ms), 'yyyy-MM-dd');

export function countActiveDays(input: {
  /** Local instants (ms) of completed workouts in the week. */
  workoutAt: readonly number[];
  /** Local-day instants (ms) of days with food logged in the week. */
  foodDayAt: readonly number[];
  /** `yyyy-MM-dd` keys from the comeback state's `minimumDays`. */
  minimumDays: readonly string[];
  /** Local midnight of the week's first day, and of the day after its last. */
  weekStart: number;
  weekEnd: number;
}): number {
  const days = new Set<string>();
  const inWeek = (ms: number) => ms >= input.weekStart && ms < input.weekEnd;
  for (const ms of [...input.workoutAt, ...input.foodDayAt]) {
    if (inWeek(ms)) {
      days.add(dayKey(ms));
    }
  }

  for (const key of input.minimumDays) {
    const ms = new Date(`${key}T00:00:00`).getTime();
    if (Number.isFinite(ms) && inWeek(ms)) {
      days.add(key);
    }
  }

  return days.size;
}
