/**
 * Inputs and output of the "Your year in Musclog" engine. The engine is pure: a loader reads the
 * database and hands over plain values, and the engine never sees ciphertext or cycle data.
 */

export interface YearWorkoutInput {
  id: string;
  name: string;
  /** Session start, ms since epoch. The session belongs to the year of its local start day. */
  startedAt: number;
  /** Completion, ms since epoch; `null` for an unfinished session, which is excluded. */
  completedAt: number | null;
  /** Stored UTC offset of the session, e.g. '-05:00'; `null` (or malformed) = device zone. */
  timezone: string | null;
  isCardio: boolean;
  /** `false` for a session imported from a file with no time of day. */
  timeKnown: boolean;
  /** `false` for an imported session with no duration. */
  durationKnown: boolean;
  sets: YearSetInput[];
}

export interface YearSetInput {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  /** The caller applied `isWorkingSet`: performed and not a warm-up. */
  isWorkingSet: boolean;
}

export interface YearPersonalRecordInput {
  exerciseId: string;
  achievedAt: number;
}

/** `day` is `yyyy-MM-dd` in the device's local calendar, already resolved by the loader. */
export interface YearNutritionDayInput {
  day: string;
  meals: number;
}

/** The meal types the diary offers; a stored type that is none of these counts as `other`. */
export const YEAR_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type YearMealType = (typeof YEAR_MEAL_TYPES)[number];

/**
 * One meal type logged on one local day (`yyyy-MM-dd`). Several rows of the same type on a day are
 * one entry, as in the Home heatmap: one AI meal that expands into twelve ingredients is one lunch.
 */
export interface YearMealEntryInput {
  day: string;
  type: string;
}

/**
 * The macro grams of every food log in the year, already summed by the loader (the only part of the
 * review that decrypts food logs). Grams, never converted: the UI shows them in the account's units.
 */
export interface YearNutritionTotalsInput {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface YearWeighInInput {
  date: number;
  /** Kilograms. The engine never converts units; the UI does. */
  weightKg: number;
}

export interface YearInReviewInput {
  year: number;
  workouts: readonly YearWorkoutInput[];
  personalRecords: readonly YearPersonalRecordInput[];
  nutritionDays: readonly YearNutritionDayInput[];
  /** Distinct meal types per logged day. Plaintext columns only. */
  mealEntries: readonly YearMealEntryInput[];
  /** `null` when the totals were not read (or there was nothing to add up). */
  nutritionTotals: YearNutritionTotalsInput | null;
  firstWeighIn: YearWeighInInput | null;
  lastWeighIn: YearWeighInInput | null;
}

export type TrainingTimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

export interface YearInReview {
  year: number;
  /** Completed sessions in the year; `null` when zero. */
  sessions: number | null;
  /** Distinct local days with a session or a logged meal; `null` when zero. */
  activeDays: number | null;
  /** One entry per local day trained, ascending; `value` is that day's completed session count. */
  workoutDays: { day: string; value: number }[];
  /** Most consecutive ISO weeks (Monday-first) with at least one session; `null` when zero. */
  longestWeeklyStreak: number | null;
  /** Sum of weight x reps over working sets, in kg; `null` when zero. */
  totalVolumeKg: number | null;
  /** Sum of durations over sessions with a known duration, in seconds; `null` when none. */
  trainingSeconds: number | null;
  /** Up to three exercises by working sets, ties by name. */
  topExercises: { exerciseId: string; name: string; sets: number }[];
  /** Personal records achieved in the year; `null` when zero. */
  personalRecords: number | null;
  /** Month index 0-11; ties go to the earlier month. */
  busiestMonth: { month: number; sessions: number } | null;
  favouriteTrainingTime: TrainingTimeBucket | null;
  /** Sessions started in each bucket; `null` exactly when `favouriteTrainingTime` is. */
  trainingTimeCounts: Record<TrainingTimeBucket, number> | null;
  /** Sum of meals across the year's logged days; `null` when zero. */
  mealsLogged: number | null;
  /** Days in the year with at least one logged meal; `null` when zero. */
  nutritionDaysLogged: number | null;
  /** One entry per local day with food logged, ascending; `value` is that day's meal count. */
  nutritionDays: { day: string; value: number }[];
  /** Most consecutive local days with food logged; `null` below two, since one day is no run. */
  longestFoodStreakDays: number | null;
  /** Days each meal type was logged; `null` when no meal was. */
  mealTypeDays: Record<YearMealType, number> | null;
  /** The meal type logged on the most days; ties go to the earlier type in `YEAR_MEAL_TYPES`. */
  favouriteMealType: YearMealType | null;
  /** Grams of each macro in the year's food logs; `null` unless any were found. */
  macroGrams: { protein: number; carbs: number; fat: number } | null;
  /** Last weigh-in minus first, in kg; `null` unless both exist on different days. */
  weightChangeKg: number | null;
  /** `false` for an empty year: the UI then shows nothing. */
  hasContent: boolean;
}
