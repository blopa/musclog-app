import type { Locale } from 'date-fns';
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { Units } from '@/constants/settings';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { UserMetricService } from '@/database/services/UserMetricService';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { type EnrichedWorkoutLogSet, WorkoutService } from '@/database/services/WorkoutService';
import { type Theme } from '@/theme';

import { isCardioActivity } from './cardioEnergy';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { displayWeightKgNumeric } from './formatDisplayWeight';
import { getWeightUnitI18nKey } from './units';
import { buildVolumeTrend, EMPTY_VOLUME_TREND, type VolumeTrend } from './volumeTrend';
import { calculateSetVolume } from './workoutCalculator';
import { getWorkoutIcon } from './workoutHistory';
import {
  isPerformedWorkoutSet,
  isSkippedWorkoutSet,
  isWarmupSet,
  isWorkingSet,
} from './workoutSetCompletion';

/**
 * Set data for workout detail display.
 * Extends WorkoutLogSet model fields with UI-specific formatting and display properties.
 */
export type WorkoutSet = Pick<WorkoutLogSet, 'reps' | 'repsInReserve' | 'rirRecorded'> & {
  setNumber: number;
  weight: string; // Formatted weight string
  partial: string; // Formatted partial reps count
  isHighlighted: boolean;
  isSkipped: boolean;
  /** Shown as "W"; warm-ups do not take a number in the working sets' numbering. */
  isWarmup: boolean;
};

/**
 * Exercise data for workout detail display.
 * Extends Exercise model fields with UI-specific properties.
 */
export type WorkoutExercise = Pick<Exercise, 'id' | 'name'> & {
  muscleGroup?: string | null;
  timeSpent: number;
  iconColor: string;
  iconBgColor: string;
  icon: LucideIcon | ComponentType<{ size: number; color: string }>;
  sets: WorkoutSet[];
  isSkipped: boolean;
};

export type WorkoutDetailData = {
  name: string;
  date: Date;
  totalTime: number;
  volume: number;
  calories: number;
  /** How the whole session went, as the user wrote it after finishing. */
  notes?: string;
  /** A quick walk/run log: distance in metres and which activity it was. */
  cardio?: { distanceM: number; durationS: number; activity: 'walk' | 'run' };
  volumeTrend: VolumeTrend;
  exercises: WorkoutExercise[];
};

function toCardioDetail(workoutLog: WorkoutLog): WorkoutDetailData['cardio'] {
  const { activity, distanceM, startedAt, completedAt } = workoutLog;
  if (!isCardioActivity(activity) || !distanceM || distanceM <= 0) {
    return undefined;
  }

  const durationS = completedAt && startedAt ? Math.max(0, (completedAt - startedAt) / 1000) : 0;
  return { distanceM, durationS, activity };
}

/**
 * Format weight for display (input in kg, output in user unit)
 */
function formatWeight(
  weight: number,
  isBodyweight: boolean,
  t: TFunction,
  units: Units,
  appNumberLocale: string
): string {
  const unitKey = getWeightUnitI18nKey(units);
  const rounded = displayWeightKgNumeric(weight, units);
  const weightStr =
    rounded % 1 === 0
      ? formatAppInteger(appNumberLocale, Math.round(rounded))
      : formatAppDecimal(appNumberLocale, rounded, 1);
  if (isBodyweight) {
    return weight > 0 ? `+${weightStr} ${t(unitKey)}` : t('workoutSession.bodyweight');
  }

  return `${weightStr} ${t(unitKey)}`;
}

/**
 * Calculate volume trend from historical workout logs
 */
async function calculateVolumeTrend(
  currentWorkoutLog: WorkoutLog,
  t: TFunction,
  locale: Locale
): Promise<VolumeTrend> {
  if (!currentWorkoutLog.templateId || !currentWorkoutLog.totalVolume) {
    return EMPTY_VOLUME_TREND;
  }

  const historicalLogs = await WorkoutService.getWorkoutLogsByTemplate(
    currentWorkoutLog.templateId,
    { limit: 10 }
  );

  if (historicalLogs.length < 2) {
    return EMPTY_VOLUME_TREND;
  }

  const allLogs = [...historicalLogs];
  const isCurrentIncluded = allLogs.some((log) => log.id === currentWorkoutLog.id);

  if (!isCurrentIncluded && currentWorkoutLog.completedAt) {
    allLogs.unshift(currentWorkoutLog);
  }

  return buildVolumeTrend(
    allLogs
      .filter((log) => log.totalVolume && log.completedAt)
      .map((log) => ({
        id: log.id,
        date: log.startedAt || log.completedAt || Date.now(),
        volume: log.totalVolume || 0,
      })),
    currentWorkoutLog.id,
    locale
  );
}

/**
 * Volume trend of ONE exercise across the sessions of the same workout, ending at this session.
 * Empty when the workout has no template or fewer than two sessions trained the exercise.
 */
export async function calculateExerciseVolumeTrend(
  workoutLogId: string,
  exerciseId: string,
  locale: Locale
): Promise<VolumeTrend> {
  const entries = await WorkoutService.getExerciseVolumeHistory(workoutLogId, exerciseId, 10);
  return buildVolumeTrend(entries, workoutLogId, locale);
}

/**
 * Transform workout log data to modal format
 */
export async function transformWorkoutToDetailData(
  workoutLog: WorkoutLog,
  sets: EnrichedWorkoutLogSet[],
  exercises: Exercise[],
  t: TFunction,
  units: Units,
  locale: Locale,
  theme: Theme,
  /** `Intl` / `formatApp*` locale string (e.g. i18n.resolvedLanguage), not date-fns Locale */
  appNumberLocale: string,
  /** exercise_order-sorted list of exerciseIds from workout_log_exercises */
  orderedExerciseIds?: string[],
  /** The unit an exercise's weights are shown in (`useExerciseUserSettings().unitsFor`). */
  unitsForExercise?: (exerciseId: string) => Units
): Promise<WorkoutDetailData> {
  const exerciseMap = new Map<string, Exercise>();
  exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

  const bodyWeightKg = await UserMetricService.getUserBodyWeightKgForVolume();

  const setsByExercise = new Map<string, EnrichedWorkoutLogSet[]>();
  sets.forEach((set) => {
    const exerciseId = set.exerciseId ?? '';
    if (!setsByExercise.has(exerciseId)) {
      setsByExercise.set(exerciseId, []);
    }

    setsByExercise.get(exerciseId)!.push(set);
  });

  const personalRecords = await WorkoutAnalytics.detectPersonalRecords(workoutLog, bodyWeightKg);
  const prSetIds = new Set<string>();
  personalRecords.forEach((pr) => {
    sets.filter(isWorkingSet).forEach((set) => {
      if (set.exerciseId === pr.exerciseId) {
        const exercise = exerciseMap.get(pr.exerciseId);
        const setVol = calculateSetVolume(
          set.weight ?? 0,
          set.reps ?? 0,
          set.repsInReserve,
          exercise?.equipmentType,
          bodyWeightKg
        );
        if (
          (pr.type === 'weight' && set.weight === pr.newRecord.weight) ||
          (pr.type === 'reps' && set.reps === pr.newRecord.reps) ||
          (pr.type === 'volume' && Math.abs(setVol - pr.newRecord.volume) < 0.01)
        ) {
          prSetIds.add(set.id);
        }
      }
    });
  });

  const exerciseOrder = new Map<string, number>();
  orderedExerciseIds?.forEach((id, index) => {
    if (!exerciseOrder.has(id)) {
      exerciseOrder.set(id, index);
    }
  });
  const unlistedOrder = orderedExerciseIds?.length ?? 0;
  const exerciseEntries = orderedExerciseIds
    ? [...setsByExercise.entries()].sort(
        (a, b) =>
          (exerciseOrder.get(a[0]) ?? unlistedOrder) - (exerciseOrder.get(b[0]) ?? unlistedOrder)
      )
    : [...setsByExercise.entries()];

  const workoutExercises: WorkoutExercise[] = exerciseEntries.map(([exerciseId, exerciseSets]) => {
    const exercise = exerciseMap.get(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise ${exerciseId} not found`);
    }

    const isBodyweight = exercise.equipmentType?.toLowerCase().includes('bodyweight') || false;
    const exerciseUnits = unitsForExercise?.(exerciseId) ?? units;

    const iconData = getWorkoutIcon(theme, exercise.name ?? '');
    const sortedSets = exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

    let workingSetNumber = 0;
    const workoutSets: WorkoutSet[] = sortedSets.map((set) => {
      const isSkipped = isSkippedWorkoutSet(set);
      const isHighlighted = !isSkipped && prSetIds.has(set.id);
      const isWarmup = isWarmupSet(set);
      if (!isWarmup) {
        workingSetNumber += 1;
      }

      return {
        setNumber: workingSetNumber,
        isWarmup,
        weight: formatWeight(set.weight ?? 0, isBodyweight, t, exerciseUnits, appNumberLocale),
        reps: set.reps ?? 0,
        partial: (set.partials ?? 0) > 0 ? (set.partials ?? 0).toString() : '-',
        repsInReserve: set.repsInReserve ?? 0,
        rirRecorded: set.rirRecorded,
        isHighlighted,
        isSkipped,
      };
    });

    const loggedSetCount = exerciseSets.filter(isPerformedWorkoutSet).length;
    const timeSpent = loggedSetCount * 2;

    return {
      id: exerciseId,
      name: exercise.name ?? '',
      muscleGroup: exercise.muscleGroup ?? null,
      timeSpent,
      iconColor: iconData.iconBgColor,
      iconBgColor: iconData.iconBgOpacity,
      icon: iconData.icon,
      sets: workoutSets,
      isSkipped: loggedSetCount === 0,
    };
  });

  const durationMinutes =
    workoutLog.completedAt && workoutLog.startedAt
      ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
      : 0;

  const workoutDate = new Date(workoutLog.startedAt || workoutLog.completedAt || Date.now());

  const volumeTrend = await calculateVolumeTrend(workoutLog, t, locale);

  return {
    name: workoutLog.workoutName ?? '',
    date: workoutDate,
    totalTime: durationMinutes,
    volume: workoutLog.totalVolume || 0,
    calories: workoutLog.caloriesBurned || 0,
    notes: workoutLog.notes ?? undefined,
    cardio: toCardioDetail(workoutLog),
    volumeTrend,
    exercises: workoutExercises,
  };
}
