import { format } from 'date-fns';
import type { TFunction } from 'i18next';

import type { LineChartDataPoint } from '../components/charts/LineChart';
import { getXAxisLabels, XAxisLabel } from './chartUtils';
import type { Units } from '../constants/settings';
import Exercise from '../database/models/Exercise';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { EnrichedWorkoutLogSet, WorkoutAnalytics, WorkoutService } from '../database/services';
import { kgToDisplay } from './unitConversion';
import { getWeightUnitI18nKey } from './units';
import { getWorkoutIcon } from './workoutHistory';

/**
 * Set data for workout detail display.
 * Extends WorkoutLogSet model fields with UI-specific formatting and display properties.
 */
export type WorkoutSet = Pick<WorkoutLogSet, 'reps' | 'repsInReserve'> & {
  setNumber: number;
  weight: string; // Formatted weight string
  partial: string; // Formatted difficulty level
  isHighlighted: boolean;
};

/**
 * Exercise data for workout detail display.
 * Extends Exercise model fields with UI-specific properties.
 */
export type WorkoutExercise = Pick<Exercise, 'id' | 'name'> & {
  timeSpent: number;
  iconColor: string;
  iconBgColor: string;
  icon: any;
  sets: WorkoutSet[];
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
function formatWeight(weight: number, isBodyweight: boolean, t: TFunction, units: Units): string {
  const unitKey = getWeightUnitI18nKey(units);
  const displayWeight = kgToDisplay(weight, units);
  const rounded = displayWeight % 1 === 0 ? displayWeight : Math.round(displayWeight * 10) / 10;
  if (isBodyweight) {
    return weight > 0 ? `+${rounded} ${t(unitKey)}` : t('workoutSession.bodyweight');
  }
  return `${rounded} ${t(unitKey)}`;
}

/**
 * Calculate volume trend from historical workout logs
 */
async function calculateVolumeTrend(
  currentWorkoutLog: WorkoutLog,
  t: TFunction
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
  const previousIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
  const previousVolume = sortedLogs[previousIndex].totalVolume || 0;
  const percentageChange =
    previousVolume > 0 && currentIndex > 0
      ? Math.round(((currentVolume - previousVolume) / previousVolume) * 100)
      : 0;

  const maxVolume = Math.max(...sortedLogs.map((log) => log.totalVolume || 0));
  const minVolume = Math.min(...sortedLogs.map((log) => log.totalVolume || 0));
  const volumeRange = maxVolume - minVolume || 1;

  const chartWidth = 400;
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
      return format(date, 'MMM d');
    }
  );

  // Map data x back to chartWidth scale if needed, but LineChart can handle domain [0, n-1]
  // We'll just update the data x to match the indices used for labels
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
  units: Units
): Promise<WorkoutDetailData> {
  const exerciseMap = new Map<string, Exercise>();
  exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

  const setsByExercise = new Map<string, EnrichedWorkoutLogSet[]>();
  sets.forEach((set) => {
    const exerciseId = set.exerciseId ?? '';
    if (!setsByExercise.has(exerciseId)) {
      setsByExercise.set(exerciseId, []);
    }
    setsByExercise.get(exerciseId)!.push(set);
  });

  const personalRecords = await WorkoutAnalytics.detectPersonalRecords(workoutLog);
  const prSetIds = new Set<string>();
  personalRecords.forEach((pr) => {
    sets.forEach((set) => {
      if (set.exerciseId === pr.exerciseId) {
        if (
          (pr.type === 'weight' && set.weight === pr.newRecord.weight) ||
          (pr.type === 'reps' && set.reps === pr.newRecord.reps) ||
          (pr.type === 'volume' && (set.reps ?? 0) * (set.weight ?? 0) === pr.newRecord.volume)
        ) {
          prSetIds.add(set.id);
        }
      }
    });
  });

  const workoutExercises: WorkoutExercise[] = Array.from(setsByExercise.entries()).map(
    ([exerciseId, exerciseSets]) => {
      const exercise = exerciseMap.get(exerciseId);
      if (!exercise) {
        throw new Error(`Exercise ${exerciseId} not found`);
      }

      const isBodyweight = exercise.equipmentType?.toLowerCase().includes('bodyweight') || false;

      const iconData = getWorkoutIcon(exercise.name ?? '');
      const sortedSets = exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

      const workoutSets: WorkoutSet[] = sortedSets.map((set, index) => {
        const isHighlighted = prSetIds.has(set.id);
        return {
          setNumber: index + 1,
          weight: formatWeight(set.weight ?? 0, isBodyweight, t, units),
          reps: set.reps ?? 0,
          partial: (set.difficultyLevel ?? 0) > 0 ? (set.difficultyLevel ?? 0).toString() : '-',
          repsInReserve: set.repsInReserve ?? 0,
          isHighlighted,
        };
      });

      const timeSpent = exerciseSets.length * 2;

      return {
        id: exerciseId,
        name: exercise.name ?? '',
        timeSpent,
        iconColor: iconData.iconBgColor,
        iconBgColor: iconData.iconBgOpacity,
        icon: iconData.icon,
        sets: workoutSets,
      };
    }
  );

  const durationMinutes =
    workoutLog.completedAt && workoutLog.startedAt
      ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
      : 0;

  const workoutDate = new Date(workoutLog.startedAt || workoutLog.completedAt || Date.now());

  const volumeTrend = await calculateVolumeTrend(workoutLog, t);

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
