import type {
  TrainingTimeBucket,
  YearInReview,
  YearInReviewInput,
  YearNutritionDayInput,
  YearWorkoutInput,
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
const DAY_MS = 86_400_000;
const MS_PER_SECOND = 1000;
const MINUTES_PER_HOUR = 60;
/** Real-world offsets run from UTC-12 to UTC+14. Anything outside is treated as malformed. */
const MAX_OFFSET_MINUTES = 14 * MINUTES_PER_HOUR;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Minutes east of UTC for a stored "±HH:MM" or "±HHMM" offset, or `null` when it is missing or
 * malformed. Malformed offsets fall back to device time, which the callers handle.
 */
export function parseOffsetMinutes(timezone: string | null): number | null {
  if (!timezone) {
    return null;
  }

  const match = OFFSET_PATTERN.exec(timezone);
  if (!match) {
    return null;
  }

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (minutes >= MINUTES_PER_HOUR) {
    return null;
  }

  const total = hours * MINUTES_PER_HOUR + minutes;
  if (total > MAX_OFFSET_MINUTES) {
    return null;
  }

  return match[1] === '-' ? -total : total;
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
  const dayNumber = Math.round(Date.UTC(year, month, day) / DAY_MS);
  const weekday = (new Date(dayNumber * DAY_MS).getUTCDay() + 6) % 7;

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

function favouriteTrainingTimeOf(sessions: YearSession[]): TrainingTimeBucket | null {
  const timed = sessions.filter(({ workout }) => workout.timeKnown);
  if (timed.length < YEAR_REVIEW_MIN_TIMED_SESSIONS) {
    return null;
  }

  const counts = new Map<TrainingTimeBucket, number>();
  for (const { workout } of timed) {
    const bucket = trainingTimeBucketForHour(
      localPartsOf(workout.startedAt, workout.timezone).hour
    );
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  let favourite: TrainingTimeBucket | null = null;
  let best = 0;
  for (const bucket of TRAINING_TIME_ORDER) {
    const count = counts.get(bucket) ?? 0;
    if (count > best) {
      best = count;
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
    favouriteTrainingTime: favouriteTrainingTimeOf(sessions),
    mealsLogged: mealsLogged > 0 ? mealsLogged : null,
    nutritionDaysLogged: nutritionDayCount > 0 ? nutritionDayCount : null,
    weightChangeKg,
    hasContent,
  };
}
