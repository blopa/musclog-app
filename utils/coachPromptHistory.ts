import type { Units } from '@/constants/settings';
import { NutritionService, SettingsService, WorkoutService } from '@/database/services';
import {
  localCalendarDayPlusDays,
  localDayClosedRangeMaxMs,
  localDayStartMs,
  utcNormalizedDayKey,
  wallClockDateInTimezone,
} from '@/utils/calendarDate';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';

/**
 * Hard cap on how many nutrition log entries are sent to the LLM, regardless of
 * the configured day range. Keeps the prompt bounded for heavy loggers.
 */
const NUTRITION_LOG_HISTORY_MAX_ENTRIES = 250;

/**
 * Hard cap on how many workouts are sent to the LLM, regardless of the
 * configured day range.
 */
const WORKOUT_HISTORY_MAX_WORKOUTS = 60;

type NutritionLogHistoryItem = {
  name: string;
  kcal: number;
  p: string;
  c: string;
  f: string;
  time: string;
};

type NutritionLogBucket = {
  dayKey: number;
  name: string;
  timestamp: number;
  timezone?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type WorkoutHistorySet = {
  weight: string;
  reps: number;
};

type WorkoutHistoryExercise = {
  name: string;
  sets: WorkoutHistorySet[];
};

type WorkoutHistoryItem = {
  name: string;
  duration: string;
  volume: string;
  exercises: WorkoutHistoryExercise[];
};

type WorkoutHistoryEntry = {
  dayKey: string;
  item: WorkoutHistoryItem;
};

function formatNutritionLogDayKey(dayKeyMs: number): string {
  const d = new Date(dayKeyMs);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
  return `${mm}/${dd}/${yy}`;
}

function formatNutritionLogTime(ms: number, timezone?: string): string {
  const wallClock = wallClockDateInTimezone(ms, timezone);
  return `${String(wallClock.getHours()).padStart(2, '0')}:${String(
    wallClock.getMinutes()
  ).padStart(2, '0')}`;
}

/** Local-calendar MM/DD/YY for the day an instant `ms` falls on (device timezone). */
function formatLocalMmDdYy(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${mm}/${dd}/${yy}`;
}

/** Compact weight label in the user's unit, e.g. "200kg" / "82.5kg" / "441lbs". */
function formatWorkoutWeight(kg: number, units: Units): string {
  const display = kgToDisplay(kg, units);
  const rounded = Math.round(display * 10) / 10;
  return `${rounded}${getWeightUnit(units)}`;
}

async function mergeNutritionLogIntoBuckets(
  log: Awaited<ReturnType<typeof NutritionService.getNutritionLogsForDateRange>>[number],
  buckets: Map<string, NutritionLogBucket>
) {
  const dayKey = utcNormalizedDayKey(log.date, log.timezone);
  const bucketKey = log.groupId ? `g:${dayKey}:${log.groupId}` : `l:${log.id}`;
  const existing = buckets.get(bucketKey);

  if (!existing && buckets.size >= NUTRITION_LOG_HISTORY_MAX_ENTRIES) {
    return;
  }

  const nutrients = await log.getNutrients();
  if (existing) {
    existing.calories += nutrients.calories;
    existing.protein += nutrients.protein;
    existing.carbs += nutrients.carbs;
    existing.fat += nutrients.fat;
    existing.timestamp = Math.min(existing.timestamp, log.date);
    return;
  }

  const name = log.groupId && log.loggedMealName ? log.loggedMealName : await log.getDisplayName();

  buckets.set(bucketKey, {
    dayKey,
    name,
    timestamp: log.date,
    timezone: log.timezone,
    calories: nutrients.calories,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fat: nutrients.fat,
  });
}

function groupNutritionHistory(
  entries: NutritionLogBucket[]
): Record<string, NutritionLogHistoryItem[]> {
  const dayOrder = Array.from(new Set(entries.map((entry) => entry.dayKey))).sort((a, b) => a - b);

  const grouped: Record<string, NutritionLogHistoryItem[]> = {};
  for (const dayKey of dayOrder) {
    const dayEntries = entries
      .filter((entry) => entry.dayKey === dayKey)
      .sort((a, b) => a.timestamp - b.timestamp);

    grouped[formatNutritionLogDayKey(dayKey)] = dayEntries.map((entry) => ({
      name: entry.name,
      kcal: Math.round(entry.calories),
      p: `${Math.round(entry.protein)}g`,
      c: `${Math.round(entry.carbs)}g`,
      f: `${Math.round(entry.fat)}g`,
      time: formatNutritionLogTime(entry.timestamp, entry.timezone),
    }));
  }

  return grouped;
}

async function buildWorkoutHistoryEntry(
  log: Awaited<ReturnType<typeof WorkoutService.getWorkoutHistory>>[number],
  units: Units
): Promise<WorkoutHistoryEntry | null> {
  try {
    const { workoutLog, sets, exercises } = await WorkoutService.getWorkoutWithDetails(log.id);
    const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex]));

    const exercisesByName = new Map<string, WorkoutHistorySet[]>();
    for (const set of sets) {
      const exercise = exerciseMap.get(set.exerciseId ?? '');
      if (!exercise) {
        continue;
      }

      const name = exercise.name ?? 'Unknown';
      if (!exercisesByName.has(name)) {
        exercisesByName.set(name, []);
      }

      exercisesByName.get(name)!.push({
        weight: formatWorkoutWeight(set.weight ?? 0, units),
        reps: set.reps ?? 0,
      });
    }

    if (exercisesByName.size === 0) {
      return null;
    }

    const durationMin = workoutLog.completedAt
      ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
      : 0;

    return {
      dayKey: formatLocalMmDdYy(workoutLog.startedAt),
      item: {
        name: workoutLog.workoutName,
        duration: `${durationMin}min`,
        volume: formatWorkoutWeight(workoutLog.totalVolume ?? 0, units),
        exercises: Array.from(exercisesByName.entries()).map(([name, exSets]) => ({
          name,
          sets: exSets,
        })),
      },
    };
  } catch (error) {
    console.error('[coachPromptHistory] Error building workout history entry:', error);
    return null;
  }
}

/**
 * Compact nutrition log history for the AI coach, gated by
 * `SettingsService.getNutritionLogHistoryDays()` ('none' disables this entirely).
 * Entries sharing a `group_id` (a saved/AI-generated meal) are merged into one
 * item with summed macros, matching how the diary groups them for the user.
 * Returns '' when the setting is 'none' or there is no nutrition history to send.
 */
export const getNutritionLogHistoryPrompt = async (): Promise<string> => {
  try {
    const daysSetting = await SettingsService.getNutritionLogHistoryDays();
    if (daysSetting === 'none') {
      return '';
    }

    const days = parseInt(daysSetting, 10) || 0;
    if (days <= 0) {
      return '';
    }

    const endDate = new Date();
    const startDate = localCalendarDayPlusDays(endDate, -(days - 1));
    const logs = await NutritionService.getNutritionLogsForDateRange(startDate, endDate);

    if (logs.length === 0) {
      return '';
    }

    const buckets = new Map<string, NutritionLogBucket>();
    const newestFirstLogs = [...logs].sort((a, b) => b.date - a.date);
    for (const log of newestFirstLogs) {
      await mergeNutritionLogIntoBuckets(log, buckets);
    }

    const entries = Array.from(buckets.values()).sort((a, b) => b.timestamp - a.timestamp);
    if (entries.length === 0) {
      return '';
    }

    return [
      "The user's recent nutrition log history, grouped by day (MM/DD/YY, oldest first). " +
        'kcal=calories, p=protein, c=carbs (includes fiber), f=fat, time=24h local time logged.',
      '```json',
      JSON.stringify(groupNutritionHistory(entries)),
      '```',
    ].join('\n');
  } catch (error) {
    console.error('[coachPromptHistory] Error fetching nutrition log history:', error);
    return '';
  }
};

/**
 * Compact workout history for the AI coach, gated by
 * `SettingsService.getWorkoutHistoryDays()` ('none' disables this entirely).
 * Each workout lists its name, duration, total volume, and exercises with their
 * sets ({ weight, reps }), grouped by local calendar day (MM/DD/YY, oldest first).
 * Weights are formatted in the user's unit. Returns '' when the setting is 'none'
 * or there is no workout history to send.
 */
export const getWorkoutLogHistoryPrompt = async (): Promise<string> => {
  try {
    const daysSetting = await SettingsService.getWorkoutHistoryDays();
    if (daysSetting === 'none') {
      return '';
    }

    const days = parseInt(daysSetting, 10) || 0;
    if (days <= 0) {
      return '';
    }

    const units = await SettingsService.getUnits();
    const now = new Date();
    const startTs = localDayStartMs(localCalendarDayPlusDays(now, -(days - 1)));
    const endTs = localDayClosedRangeMaxMs(now);

    const logs = await WorkoutService.getWorkoutHistory(
      { startDate: startTs, endDate: endTs },
      WORKOUT_HISTORY_MAX_WORKOUTS
    );
    if (logs.length === 0) {
      return '';
    }

    const entries = (
      await Promise.all([...logs].reverse().map((log) => buildWorkoutHistoryEntry(log, units)))
    ).filter((entry): entry is WorkoutHistoryEntry => entry != null);

    if (entries.length === 0) {
      return '';
    }

    const grouped: Record<string, WorkoutHistoryItem[]> = {};
    for (const { dayKey, item } of entries) {
      grouped[dayKey] ??= [];
      grouped[dayKey].push(item);
    }

    return [
      "The user's recent workout history, grouped by day (MM/DD/YY, oldest first). " +
        'Each workout has its name, duration, total volume, and exercises with their sets ' +
        `(weight and reps). Weights are in the user's preferred unit (${getWeightUnit(units)}).`,
      '```json',
      JSON.stringify(grouped),
      '```',
    ].join('\n');
  } catch (error) {
    console.error('[coachPromptHistory] Error fetching workout history:', error);
    return '';
  }
};
