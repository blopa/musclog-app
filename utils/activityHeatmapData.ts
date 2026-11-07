import type { ActivityHeatmapSource } from '@/constants/settings';
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

/** The calendar day a log belongs to, `yyyy-MM-dd`. The key is a UTC midnight, so its UTC date parts are the day. */
function mealDayIso(log: MealLogLike): string {
  return new Date(utcNormalizedDayKey(log.date, log.timezone)).toISOString().slice(0, 10);
}

/**
 * Distinct meal types logged per calendar day. The day comes from `utcNormalizedDayKey`, so a
 * log made in another timezone stays on the calendar day the person lived it, and only the
 * plaintext columns are read: nothing here decrypts.
 */
export function nutritionHeatmapDays(logs: readonly MealLogLike[]): ActivityHeatmapDay[] {
  const mealsByDay = new Map<string, Set<string>>();
  for (const log of logs) {
    const iso = mealDayIso(log);
    const meals = mealsByDay.get(iso) ?? new Set<string>();
    meals.add(log.type);
    mealsByDay.set(iso, meals);
  }

  return [...mealsByDay].map(([date, meals]) => ({ date, value: meals.size }));
}

/** The same days and meal types as `nutritionHeatmapDays`, one entry per pair instead of a count. */
export function nutritionMealEntries(
  logs: readonly MealLogLike[]
): { day: string; type: string }[] {
  const seen = new Set<string>();
  const entries: { day: string; type: string }[] = [];
  for (const log of logs) {
    const day = mealDayIso(log);
    const key = `${day}|${log.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ day, type: log.type });
    }
  }

  return entries;
}

/**
 * Everything that differs between the heatmaps, in one table: the scale a day is shaded on and
 * the wording for a day's number. The Home cards, the compact strip and the home screen widget
 * all read it, so a source is added here and nowhere else (the `Record` makes the compiler say
 * so). Whole translation keys, so `check-translations` can see each one.
 */
export const ACTIVITY_SOURCES = {
  workouts: {
    maxValue: WORKOUT_HEATMAP_MAX_VALUE,
    titleKey: 'home.heatmaps.workouts.title',
    noneKey: 'home.heatmaps.workouts.none',
    countKey: 'home.heatmaps.workouts.count',
  },
  nutrition: {
    maxValue: NUTRITION_HEATMAP_MAX_VALUE,
    titleKey: 'home.heatmaps.nutrition.title',
    noneKey: 'home.heatmaps.nutrition.none',
    countKey: 'home.heatmaps.nutrition.count',
  },
} as const satisfies Record<
  ActivityHeatmapSource,
  { maxValue: number; titleKey: string; noneKey: string; countKey: string }
>;

/** What a day's number counts, in words: "No workout", "2 workouts", "3 meals". */
export function describeActivityValue(
  t: (key: string, options?: { count: number }) => string,
  source: ActivityHeatmapSource,
  value: number
): string {
  const { noneKey, countKey } = ACTIVITY_SOURCES[source];

  return value === 0 ? t(noneKey) : t(countKey, { count: value });
}
