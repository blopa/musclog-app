import type { Locale } from 'date-fns';
import { format } from 'date-fns';
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { LineChartDataPoint } from '@/components/charts/LineChart';
import type { Units } from '@/constants/settings';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { EnrichedWorkoutLogSet, WorkoutAnalytics, WorkoutService } from '@/database/services';
import { UserMetricService } from '@/database/services/UserMetricService';
import { type Theme } from '@/theme';

import { getXAxisLabels, XAxisLabel } from './chartUtils';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { displayWeightKgNumeric } from './formatDisplayWeight';
import { getWeightUnitI18nKey } from './units';
import { calculateSetVolume } from './workoutCalculator';
import { getWorkoutIcon } from './workoutHistory';
import { isLoggedWorkoutSet } from './workoutSetCompletion';

/**
 * Set data for workout detail display.
 * Extends WorkoutLogSet model fields with UI-specific formatting and display properties.
 */
export type WorkoutSet = Pick<WorkoutLogSet, 'reps' | 'repsInReserve'> & {
  setNumber: number;
  weight: string; // Formatted weight string
  partial: string; // Formatted partial reps count
  isHighlighted: boolean;
  isSkipped: boolean;
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
  volumeTrend: {
    percentage: number;
    data: LineChartDataPoint[];
    labels: XAxisLabel[];
  };
  exercises: WorkoutExercise[];
};

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
): Promise<{
  percentage: number;
  data: LineChartDataPoint[];
  labels: XAxisLabel[];
}> {
  if (!currentWorkoutLog.templateId || !currentWorkoutLog.totalVolume) {
    return {
      percentage: 0,
      data: [],
      labels: [],
    };
  }

  const historicalLogs = await WorkoutService.getWorkoutLogsByTemplate(
    currentWorkoutLog.templateId,
    10
  );

  if (historicalLogs.length < 2) {
    return {
      percentage: 0,
      data: [],
      labels: [],
    };
  }

  const allLogs = [...historicalLogs];
  const isCurrentIncluded = allLogs.some((log) => log.id === currentWorkoutLog.id);

  if (!isCurrentIncluded && currentWorkoutLog.totalVolume && currentWorkoutLog.completedAt) {
    allLogs.unshift(currentWorkoutLog);
  }

  const sortedLogs = allLogs
    .filter((log) => log.totalVolume && log.completedAt)
    .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

  if (sortedLogs.length < 2) {
    return {
      percentage: 0,
      data: [],
      labels: [],
    };
  }

  const currentVolume = currentWorkoutLog.totalVolume || 0;
  const currentIndex = sortedLogs.findIndex((log) => log.id === currentWorkoutLog.id);
  const previousVolume = currentIndex > 0 ? sortedLogs[currentIndex - 1].totalVolume || 0 : 0;
  const percentageChange =
    previousVolume > 0 && currentIndex > 0
      ? Math.round(((currentVolume - previousVolume) / previousVolume) * 100)
      : 0;

  const maxVolume = Math.max(...sortedLogs.map((log) => log.totalVolume || 0));
  const minVolume = Math.min(...sortedLogs.map((log) => log.totalVolume || 0));
  const volumeRange = maxVolume - minVolume || 1;

  const chartHeight = 100;

  const data: LineChartDataPoint[] = sortedLogs.map((log, index) => {
    const x = index; // Use index as x for getXAxisLabels
    const normalizedVolume = ((log.totalVolume || 0) - minVolume) / volumeRange;
    const y = chartHeight - normalizedVolume * chartHeight;
    return { x, y };
  });

  const labels = getXAxisLabels(
    sortedLogs.map((log, index) => ({
      x: index,
      date: new Date(log.startedAt || log.completedAt || Date.now()),
    })),
    (x) => {
      const log = sortedLogs[x];
      const date = new Date(log.startedAt || log.completedAt || Date.now());
      return format(date, 'MMM d', { locale });
    },
    locale
  );

  // LineChart can use the point indices directly for its x domain and labels.
  const chartData: LineChartDataPoint[] = data.map((d, i) => ({
    x: i,
    y: d.y,
  }));

  return {
    percentage: percentageChange,
    data: chartData,
    labels,
  };
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
  orderedExerciseIds?: string[]
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
    sets.filter(isLoggedWorkoutSet).forEach((set) => {
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

    const iconData = getWorkoutIcon(theme, exercise.name ?? '');
    const sortedSets = exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

    const workoutSets: WorkoutSet[] = sortedSets.map((set, index) => {
      const isSkipped = set.isSkipped ?? false;
      const isHighlighted = !isSkipped && prSetIds.has(set.id);
      return {
        setNumber: index + 1,
        weight: formatWeight(set.weight ?? 0, isBodyweight, t, units, appNumberLocale),
        reps: set.reps ?? 0,
        partial: (set.partials ?? 0) > 0 ? (set.partials ?? 0).toString() : '-',
        repsInReserve: set.repsInReserve ?? 0,
        isHighlighted,
        isSkipped,
      };
    });

    const loggedSetCount = exerciseSets.filter((set) => !set.isSkipped).length;
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
    volumeTrend,
    exercises: workoutExercises,
  };
}
