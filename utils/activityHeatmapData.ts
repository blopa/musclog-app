import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { formatLocalCalendarDayIso, utcNormalizedDayKey } from '@/utils/calendarDate';

/**
 * Turns stored records into the per-day values `ActivityHeatmap` draws. Pure, so the bucketing
 * rules (which calendar day a record belongs to, what a day's value is) run in the Jest `node`
 * project without a database.
 */

/**
 * A nutrition day's top level is four different meals logged (breakfast, lunch, dinner and a
 * snack). Counting meals rather than food rows keeps one AI meal that expands into twelve
 * ingredients from reading as twelve times as much logging as a plain lunch.
 */
export const NUTRITION_HEATMAP_MAX_VALUE = 4;

/**
 * The workout count that earns the darkest step. Below 2 on purpose: one workout, by far the most
 * common training day, reads as the third of four steps and a double day as the fourth, so the
 * shade of a day means the same thing whether or not the window happens to hold a double.
 * Left to the busiest day shown, a window with no double day painted every workout the darkest.
 */
export const WORKOUT_HEATMAP_MAX_VALUE = 1.5;

/**
 * Completed workouts per local calendar day. A day is the one the workout STARTED on, as the
 * workout history groups it, so one that runs past midnight stays on its own day.
 */
export function workoutHeatmapDays(startedAtMs: readonly number[]): ActivityHeatmapDay[] {
  const counts = new Map<string, number>();
  for (const startedAt of startedAtMs) {
    const iso = formatLocalCalendarDayIso(new Date(startedAt));
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }

  return [...counts].map(([date, value]) => ({ date, value }));
}

type MealLogLike = {
  /** The consumed datetime, not a day key. */
  date: number;
  timezone?: string | null;
  type: string;
};

/**
 * Distinct meal types logged per calendar day. The day comes from `utcNormalizedDayKey`, so a
 * log made in another timezone stays on the calendar day the person lived it, and only the
 * plaintext columns are read: nothing here decrypts.
 */
export function nutritionHeatmapDays(logs: readonly MealLogLike[]): ActivityHeatmapDay[] {
  const mealsByDay = new Map<string, Set<string>>();
  for (const log of logs) {
    // The key is a UTC midnight, so its UTC date parts are the calendar day.
    const iso = new Date(utcNormalizedDayKey(log.date, log.timezone)).toISOString().slice(0, 10);
    const meals = mealsByDay.get(iso) ?? new Set<string>();
    meals.add(log.type);
    mealsByDay.set(iso, meals);
  }

  return [...mealsByDay].map(([date, meals]) => ({ date, value: meals.size }));
}
