import { Q } from '@nozbe/watermelondb';
import { endOfDay, startOfDay } from 'date-fns';

import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import type Exercise from '@/database/models/Exercise';
import type NutritionLog from '@/database/models/NutritionLog';
import type UserMetric from '@/database/models/UserMetric';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { fetchMapByIds } from '@/database/queryByIds';
import { toWorkoutLogSetSnapshot } from '@/database/workoutLogSetSnapshot';
import { fetchCompletedSetHistory } from '@/database/workoutSetHistory';
import { nutritionHeatmapDays, nutritionMealEntries } from '@/utils/activityHeatmapData';
import { dayKeyRange, utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { isWorkingSet } from '@/utils/workoutSetCompletion';
import {
  findPersonalRecords,
  type PersonalRecordSession,
} from '@/utils/yearInReview/personalRecords';
import type {
  YearInReviewInput,
  YearNutritionTotalsInput,
  YearSetInput,
  YearWorkoutInput,
} from '@/utils/yearInReview/types';

export interface YearInReviewLoadOptions {
  /** False skips the two weight decrypts, e.g. while the progress lock is held. */
  includeWeight: boolean;
}

/** Logs between two awaits of the macro walk, so a big year yields to the UI instead of freezing it. */
const NUTRITION_LOGS_PER_SLICE = 50;

/** Imports from these apps carry no time of day, so the session's clock time is not a fact. */
const TIMELESS_IMPORT_SOURCES = new Set(['fitnotes', 'fitnotes2']);

/**
 * Sessions are read from one day before 1 January to one day after 31 December: the engine decides
 * each session's year from its own offset, so a session near the boundary must be in the read.
 */
function yearBounds(year: number): {
  readStart: number;
  readEnd: number;
  yearStart: Date;
  yearEnd: Date;
} {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  return {
    readStart: startOfDay(new Date(year - 1, 11, 31)).getTime(),
    readEnd: endOfDay(new Date(year + 1, 0, 1)).getTime(),
    yearStart,
    yearEnd,
  };
}

/** What the weight card gets while the progress area is locked: no weigh-in is read at all. */
const NO_WEIGH_INS: Promise<Pick<YearInReviewInput, 'firstWeighIn' | 'lastWeighIn'>> =
  Promise.resolve({ firstWeighIn: null, lastWeighIn: null });

/** A set as the loader reads it: the engine's input plus what the record rule needs. */
type LoggedSet = {
  exerciseId: string;
  equipmentType: string | undefined;
  repsInReserve: number | undefined;
  set: YearSetInput;
};

/** Whether a session's duration and clock time are real, from its import source. */
function importFlags(log: WorkoutLog): { durationKnown: boolean; timeKnown: boolean } {
  const source = log.importSource;
  return {
    // A file with no end time records completion equal to the start: the length is unknown, not zero.
    durationKnown: !(source && log.completedAt === log.startedAt),
    timeKnown: !(source && TIMELESS_IMPORT_SOURCES.has(source)),
  };
}

/**
 * Reads the data for "Your year in Musclog". Everything comes from plaintext columns except the
 * two weight rows (decrypted only when the weight card can show them) and the macros of the year's
 * food logs: the protein and macro posters add those up, three decrypts per log, the one place the
 * review decrypts food. The cycle tables are never read.
 */
export class YearInReviewRepository {
  /** Whether any completed session could fall in `year`. A single-row read, for the Home card. */
  static async hasCompletedSession(year: number): Promise<boolean> {
    const { readStart, readEnd } = yearBounds(year);
    const rows = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('started_at', Q.gte(readStart)),
        Q.where('started_at', Q.lte(readEnd)),
        Q.take(1)
      )
      .fetch();

    return rows.length > 0;
  }

  static async load(
    year: number,
    options: YearInReviewLoadOptions = { includeWeight: true }
  ): Promise<YearInReviewInput> {
    const { readStart, readEnd, yearStart, yearEnd } = yearBounds(year);

    // The three reads share nothing, and the food macros are a decrypt per log: start them together.
    const [workoutData, nutritionData, weighIns] = await Promise.all([
      YearInReviewRepository.readWorkouts(readStart, readEnd),
      YearInReviewRepository.readNutrition(yearStart, yearEnd),
      options.includeWeight
        ? YearInReviewRepository.readWeighIns(yearStart, yearEnd)
        : NO_WEIGH_INS,
    ]);

    return { year, ...workoutData, ...nutritionData, ...weighIns };
  }

  /**
   * The sessions of the read window as the engine takes them, and the personal records found over
   * the whole history before it: records need every earlier session, so the walk covers all of it.
   */
  private static async readWorkouts(
    readStart: number,
    readEnd: number
  ): Promise<Pick<YearInReviewInput, 'workouts' | 'personalRecords'>> {
    const { logs, logExercises, sets } = await fetchCompletedSetHistory({
      startedTo: readEnd,
      oldestFirst: true,
    });
    const logExerciseById = new Map(logExercises.map((le) => [le.id, le]));
    // Deleted exercises included: history keeps their name, and a retired one was still trained.
    const exercises = await fetchMapByIds<Exercise>('exercises', 'id', [
      ...new Set(logExercises.map((le) => le.exerciseId)),
    ]);

    const setsByLog = new Map<string, LoggedSet[]>();
    for (const row of sets) {
      const snapshot = toWorkoutLogSetSnapshot(row);
      const logExercise = logExerciseById.get(snapshot.logExerciseId);
      if (!logExercise) {
        continue;
      }

      const exercise = exercises.get(logExercise.exerciseId);
      const entry: LoggedSet = {
        exerciseId: logExercise.exerciseId,
        equipmentType: exercise?.equipmentType,
        repsInReserve: snapshot.repsInReserve,
        set: {
          exerciseId: logExercise.exerciseId,
          exerciseName: exercise?.name ?? '',
          weightKg: snapshot.weight,
          reps: snapshot.reps,
          isWorkingSet: isWorkingSet(snapshot),
        },
      };

      const list = setsByLog.get(logExercise.workoutLogId) ?? [];
      list.push(entry);
      setsByLog.set(logExercise.workoutLogId, list);
    }

    const allSessions: PersonalRecordSession[] = [];
    const workouts: YearWorkoutInput[] = [];

    for (const log of logs) {
      const entries = setsByLog.get(log.id) ?? [];
      const completedAt = log.completedAt ?? log.startedAt;
      const working = entries.filter((entry) => entry.set.isWorkingSet);

      allSessions.push({
        achievedAt: completedAt,
        sets: working.map((entry) => ({
          exerciseId: entry.exerciseId,
          equipmentType: entry.equipmentType,
          weightKg: entry.set.weightKg,
          reps: entry.set.reps,
          repsInReserve: entry.repsInReserve,
        })),
      });

      if (log.startedAt < readStart) {
        continue;
      }

      const { durationKnown, timeKnown } = importFlags(log);
      workouts.push({
        id: log.id,
        name: log.workoutName,
        startedAt: log.startedAt,
        completedAt: log.completedAt ?? null,
        timezone: log.timezone ?? null,
        isCardio: log.type === 'cardio',
        timeKnown,
        durationKnown,
        sets: entries.map((entry) => entry.set),
      });
    }

    return { workouts, personalRecords: findPersonalRecords(allSessions) };
  }

  /** The year's food: logged days, meal types and the macro totals. */
  private static async readNutrition(
    yearStart: Date,
    yearEnd: Date
  ): Promise<Pick<YearInReviewInput, 'nutritionDays' | 'mealEntries' | 'nutritionTotals'>> {
    const foodLogs = await YearInReviewRepository.readFoodLogs(yearStart, yearEnd);

    return {
      nutritionDays: nutritionHeatmapDays(foodLogs).map((day) => ({
        day: day.date,
        meals: day.value,
      })),
      mealEntries: nutritionMealEntries(foodLogs),
      nutritionTotals: await YearInReviewRepository.sumMacros(foodLogs),
    };
  }

  /** The year's live food logs, trimmed to the days asked for (the query widens the range). */
  private static async readFoodLogs(yearStart: Date, yearEnd: Date): Promise<NutritionLog[]> {
    const range = dayKeyRange(utcDayKeyFromLocalDate(yearStart), utcDayKeyFromLocalDate(yearEnd));
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)), ...dayRangeClauses(range))
      .fetch();

    return range.filterRecords(logs);
  }

  /** Protein, carbs and fat of every log, in grams; `null` when there are no logs. */
  private static async sumMacros(
    logs: readonly NutritionLog[]
  ): Promise<YearNutritionTotalsInput | null> {
    if (logs.length === 0) {
      return null;
    }

    const totals = { proteinG: 0, carbsG: 0, fatG: 0 };
    for (let index = 0; index < logs.length; index++) {
      const { protein, carbs, fat } = await logs[index].getMacroGrams();
      totals.proteinG += protein;
      totals.carbsG += carbs;
      totals.fatG += fat;

      if ((index + 1) % NUTRITION_LOGS_PER_SLICE === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    return totals;
  }

  /** The earliest and latest weigh-in of the year. Two rows, so at most two decrypts. */
  private static async readWeighIns(
    yearStart: Date,
    yearEnd: Date
  ): Promise<Pick<YearInReviewInput, 'firstWeighIn' | 'lastWeighIn'>> {
    const inYear = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.gte(yearStart.getTime())),
        Q.where('date', Q.lte(endOfDay(yearEnd).getTime()))
      );

    const [[first], [last]] = await Promise.all([
      inYear.extend(Q.sortBy('date', Q.asc), Q.take(1)).fetch(),
      inYear.extend(Q.sortBy('date', Q.desc), Q.take(1)).fetch(),
    ]);

    return {
      firstWeighIn: first ? await toWeighIn(first) : null,
      lastWeighIn: last ? await toWeighIn(last) : null,
    };
  }
}

async function toWeighIn(metric: UserMetric): Promise<{ date: number; weightKg: number }> {
  const decrypted = await metric.getDecrypted();
  return { date: metric.date, weightKg: decrypted.value };
}
