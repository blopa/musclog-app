import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { parseTimezoneOffsetMinutes } from '@/utils/timezone';
import {
  type TrainingTimeBucket,
  YEAR_MEAL_TYPES,
  type YearInReview,
  type YearInReviewInput,
  type YearMealEntryInput,
  type YearMealType,
  type YearNutritionDayInput,
  type YearNutritionTotalsInput,
  type YearWorkoutInput,
} from '@/utils/yearInReview/types';

/** A favourite training time needs this many timed sessions; two sessions are not a pattern. */
export const YEAR_REVIEW_MIN_TIMED_SESSIONS = 5;

/*
 * Time-of-day buckets, by the local hour a session started. A product choice: night wraps past
 * midnight, so 22:00-04:59 is one bucket. Ties go to the earlier bucket in TRAINING_TIME_ORDER.
 */
export const YEAR_REVIEW_NIGHT_START_HOUR = 22;
export const YEAR_REVIEW_MORNING_START_HOUR = 5;
export const YEAR_REVIEW_AFTERNOON_START_HOUR = 12;
export const YEAR_REVIEW_EVENING_START_HOUR = 17;

const TRAINING_TIME_ORDER: readonly TrainingTimeBucket[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
];

const TOP_EXERCISE_COUNT = 3;
const MS_PER_SECOND = 1000;
const MINUTES_PER_HOUR = 60;
/** Real-world offsets run from UTC-12 to UTC+14. Anything outside is treated as malformed. */
const MAX_OFFSET_MINUTES = 14 * MINUTES_PER_HOUR;
const COMPACT_OFFSET = /^([+-]\d{2})(\d{2})$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Minutes east of UTC for a stored "±HH:MM" (or compact "±HHMM") offset, or `null` when it is
 * missing or malformed. The reading itself is the app's one offset parser; this only refuses what
 * no place on Earth has (minutes past 59, or beyond UTC+14), which falls back to device time.
 */
export function parseOffsetMinutes(timezone: string | null): number | null {
  if (!timezone) {
    return null;
  }

  const withColon = timezone.replace(COMPACT_OFFSET, '$1:$2');
  const total = parseTimezoneOffsetMinutes(withColon);
  if (total === null || Number(withColon.slice(4)) >= MINUTES_PER_HOUR) {
    return null;
  }

  return Math.abs(total) > MAX_OFFSET_MINUTES ? null : total;
}

type LocalParts = {
  year: number;
  /** 0-11. */
  month: number;
  day: number;
  hour: number;
  /** Days since the epoch for this calendar day; equal days share a value, adjacent days differ by 1. */
  dayNumber: number;
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
};

function partsFromCalendar(year: number, month: number, day: number, hour: number): LocalParts {
  const dayNumber = Math.round(Date.UTC(year, month, day) / MS_PER_SOLAR_DAY);
  const weekday = (new Date(dayNumber * MS_PER_SOLAR_DAY).getUTCDay() + 6) % 7;

  return { year, month, day, hour, dayNumber, weekday };
}

/**
 * The local calendar fields of an instant. With a valid stored offset they come from shifting the
 * instant and reading UTC fields, so no DST rule can move a day. Without one, device time is used.
 */
export function localPartsOf(ms: number, timezone: string | null): LocalParts {
  const offset = parseOffsetMinutes(timezone);
  if (offset === null) {
    const date = new Date(ms);
    return partsFromCalendar(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
  }

  const shifted = new Date(ms + offset * 60_000);
  return partsFromCalendar(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours()
  );
}

function dayKeyOf(parts: LocalParts): string {
  const month = String(parts.month + 1).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

/** Time-of-day bucket for an hour 0-23. */
export function trainingTimeBucketForHour(hour: number): TrainingTimeBucket {
  if (hour >= YEAR_REVIEW_MORNING_START_HOUR && hour < YEAR_REVIEW_AFTERNOON_START_HOUR) {
    return 'morning';
  }

  if (hour >= YEAR_REVIEW_AFTERNOON_START_HOUR && hour < YEAR_REVIEW_EVENING_START_HOUR) {
    return 'afternoon';
  }

  if (hour >= YEAR_REVIEW_EVENING_START_HOUR && hour < YEAR_REVIEW_NIGHT_START_HOUR) {
    return 'evening';
  }

  return 'night';
}

type YearSession = {
  workout: YearWorkoutInput;
  local: LocalParts;
};

/** Completed sessions whose local start day falls in `year`. */
function sessionsInYear(workouts: readonly YearWorkoutInput[], year: number): YearSession[] {
  const sessions: YearSession[] = [];
  for (const workout of workouts) {
    if (workout.completedAt === null) {
      continue;
    }

    const local = localPartsOf(workout.startedAt, workout.timezone);
    if (local.year === year) {
      sessions.push({ workout, local });
    }
  }

  return sessions;
}

function workoutDaysOf(sessions: YearSession[]): { day: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const { local } of sessions) {
    const key = dayKeyOf(local);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }));
}

/**
 * Longest run of consecutive ISO weeks, counting only weeks that contain a session of this year.
 * A week is identified by its Monday's day number, so a week straddling New Year is one week.
 */
function longestWeeklyStreakOf(sessions: YearSession[]): number | null {
  if (sessions.length === 0) {
    return null;
  }

  const weekStarts = [
    ...new Set(sessions.map(({ local }) => local.dayNumber - local.weekday)),
  ].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let index = 1; index < weekStarts.length; index++) {
    run = weekStarts[index] - weekStarts[index - 1] === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return longest;
}

function positiveFinite(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function volumeOf(sessions: YearSession[]): number | null {
  let total = 0;
  for (const { workout } of sessions) {
    for (const set of workout.sets) {
      if (set.isWorkingSet) {
        total += positiveFinite(set.weightKg) * positiveFinite(set.reps);
      }
    }
  }

  return total > 0 ? total : null;
}

function trainingSecondsOf(sessions: YearSession[]): number | null {
  const timed = sessions.filter(({ workout }) => workout.durationKnown);
  if (timed.length === 0) {
    return null;
  }

  const milliseconds = timed.reduce(
    (sum, { workout }) => sum + Math.max(0, (workout.completedAt ?? 0) - workout.startedAt),
    0
  );

  return Math.round(milliseconds / MS_PER_SECOND);
}

function topExercisesOf(sessions: YearSession[]): YearInReview['topExercises'] {
  const byExercise = new Map<string, { name: string; sets: number }>();
  for (const { workout } of sessions) {
    for (const set of workout.sets) {
      if (!set.isWorkingSet) {
        continue;
      }

      const entry = byExercise.get(set.exerciseId);
      if (entry) {
        entry.sets += 1;
      } else {
        byExercise.set(set.exerciseId, { name: set.exerciseName, sets: 1 });
      }
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseId, { name, sets }]) => ({ exerciseId, name, sets }))
    .sort(
      (a, b) =>
        b.sets - a.sets || a.name.localeCompare(b.name) || a.exerciseId.localeCompare(b.exerciseId)
    )
    .slice(0, TOP_EXERCISE_COUNT);
}

function busiestMonthOf(sessions: YearSession[]): YearInReview['busiestMonth'] {
  const counts = new Array<number>(12).fill(0);
  for (const { local } of sessions) {
    counts[local.month] += 1;
  }

  let best: { month: number; sessions: number } | null = null;
  for (let month = 0; month < counts.length; month++) {
    const count = counts[month];
    // Strictly greater, so a tie keeps the earlier month.
    if (count > 0 && (best === null || count > best.sessions)) {
      best = { month, sessions: count };
    }
  }

  return best;
}

/** Sessions per time-of-day bucket, or `null` below the number of timed sessions that makes a pattern. */
function trainingTimeCountsOf(sessions: YearSession[]): Record<TrainingTimeBucket, number> | null {
  const timed = sessions.filter(({ workout }) => workout.timeKnown);
  if (timed.length < YEAR_REVIEW_MIN_TIMED_SESSIONS) {
    return null;
  }

  const counts: Record<TrainingTimeBucket, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };
  for (const { workout } of timed) {
    const bucket = trainingTimeBucketForHour(
      localPartsOf(workout.startedAt, workout.timezone).hour
    );
    counts[bucket] += 1;
  }

  return counts;
}

function favouriteTrainingTimeOf(
  counts: Record<TrainingTimeBucket, number> | null
): TrainingTimeBucket | null {
  if (counts === null) {
    return null;
  }

  let favourite: TrainingTimeBucket | null = null;
  let best = 0;
  for (const bucket of TRAINING_TIME_ORDER) {
    if (counts[bucket] > best) {
      best = counts[bucket];
      favourite = bucket;
    }
  }

  return favourite;
}

/** One total per logged day, dropping malformed keys and days outside the year. */
function mealsByDayOf(
  nutritionDays: readonly YearNutritionDayInput[],
  year: number
): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const entry of nutritionDays) {
    if (!DAY_KEY_PATTERN.test(entry.day) || !entry.day.startsWith(`${year}-`)) {
      continue;
    }

    if (!Number.isFinite(entry.meals) || entry.meals <= 0) {
      continue;
    }

    byDay.set(entry.day, (byDay.get(entry.day) ?? 0) + entry.meals);
  }

  return byDay;
}

/** Most consecutive calendar days among `days`; `null` below two, since one day is no run. */
function longestDayRunOf(days: Iterable<string>): number | null {
  const numbers = [...days]
    .map((day) => {
      const [year, month, date] = day.split('-').map(Number);
      return Math.round(Date.UTC(year, month - 1, date) / MS_PER_SOLAR_DAY);
    })
    .sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const dayNumber of numbers) {
    run = dayNumber === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = dayNumber;
  }

  return best >= 2 ? best : null;
}

/** Days on which each meal type was logged, with the favourite (ties go to the earlier type). */
function mealTypesOf(
  entries: readonly YearMealEntryInput[],
  year: number
): { counts: Record<YearMealType, number>; favourite: YearMealType } | null {
  const seen = new Set<string>();
  const counts = Object.fromEntries(YEAR_MEAL_TYPES.map((type) => [type, 0])) as Record<
    YearMealType,
    number
  >;

  for (const { day, type } of entries) {
    if (!DAY_KEY_PATTERN.test(day) || !day.startsWith(`${year}-`)) {
      continue;
    }

    const mealType = YEAR_MEAL_TYPES.find((known) => known === type) ?? 'other';
    const key = `${day}|${mealType}`;
    if (!seen.has(key)) {
      seen.add(key);
      counts[mealType] += 1;
    }
  }

  let favourite: YearMealType | null = null;
  for (const type of YEAR_MEAL_TYPES) {
    if (counts[type] > 0 && (favourite === null || counts[type] > counts[favourite])) {
      favourite = type;
    }
  }

  return favourite === null ? null : { counts, favourite };
}

/** Finite, non-negative grams of each macro; `null` when nothing was logged. */
function macroGramsOf(
  totals: YearNutritionTotalsInput | null
): { protein: number; carbs: number; fat: number } | null {
  if (!totals) {
    return null;
  }

  const clean = (grams: number) => (Number.isFinite(grams) && grams > 0 ? grams : 0);
  const macros = {
    protein: clean(totals.proteinG),
    carbs: clean(totals.carbsG),
    fat: clean(totals.fatG),
  };

  return macros.protein + macros.carbs + macros.fat > 0 ? macros : null;
}

function weightChangeOf(input: YearInReviewInput): number | null {
  const { firstWeighIn, lastWeighIn } = input;
  if (!firstWeighIn || !lastWeighIn) {
    return null;
  }

  if (!Number.isFinite(firstWeighIn.weightKg) || !Number.isFinite(lastWeighIn.weightKg)) {
    return null;
  }

  const firstDay = localPartsOf(firstWeighIn.date, null).dayNumber;
  const lastDay = localPartsOf(lastWeighIn.date, null).dayNumber;
  if (firstDay === lastDay) {
    return null;
  }

  return lastWeighIn.weightKg - firstWeighIn.weightKg;
}

export function buildYearInReview(input: YearInReviewInput): YearInReview {
  const { year } = input;
  const sessions = sessionsInYear(input.workouts, year);
  const workoutDays = workoutDaysOf(sessions);
  const mealsByDay = mealsByDayOf(input.nutritionDays, year);

  const activeDaySet = new Set<string>([
    ...workoutDays.map(({ day }) => day),
    ...mealsByDay.keys(),
  ]);

  const prsInYear = input.personalRecords.filter(
    (record) =>
      Number.isFinite(record.achievedAt) && localPartsOf(record.achievedAt, null).year === year
  ).length;

  let mealsLogged = 0;
  for (const meals of mealsByDay.values()) {
    mealsLogged += meals;
  }

  const sessionCount = sessions.length;
  const weightChangeKg = weightChangeOf(input);
  const activeDayCount = activeDaySet.size;
  const nutritionDayCount = mealsByDay.size;
  const trainingTimeCounts = trainingTimeCountsOf(sessions);
  const mealTypes = mealTypesOf(input.mealEntries, year);

  const hasContent =
    sessionCount > 0 ||
    activeDayCount > 0 ||
    prsInYear > 0 ||
    nutritionDayCount > 0 ||
    weightChangeKg !== null;

  return {
    year,
    sessions: sessionCount > 0 ? sessionCount : null,
    activeDays: activeDayCount > 0 ? activeDayCount : null,
    workoutDays,
    longestWeeklyStreak: longestWeeklyStreakOf(sessions),
    totalVolumeKg: volumeOf(sessions),
    trainingSeconds: trainingSecondsOf(sessions),
    topExercises: sessions.length > 0 ? topExercisesOf(sessions) : [],
    personalRecords: prsInYear > 0 ? prsInYear : null,
    busiestMonth: busiestMonthOf(sessions),
    favouriteTrainingTime: favouriteTrainingTimeOf(trainingTimeCounts),
    trainingTimeCounts,
    mealsLogged: mealsLogged > 0 ? mealsLogged : null,
    nutritionDaysLogged: nutritionDayCount > 0 ? nutritionDayCount : null,
    nutritionDays: [...mealsByDay]
      .map(([day, value]) => ({ day, value }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    longestFoodStreakDays: longestDayRunOf(mealsByDay.keys()),
    mealTypeDays: mealTypes?.counts ?? null,
    favouriteMealType: mealTypes?.favourite ?? null,
    macroGrams: macroGramsOf(input.nutritionTotals),
    weightChangeKg,
    hasContent,
  };
}
