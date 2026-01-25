import { format } from 'date-fns';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import Exercise from '../database/models/Exercise';
import { WorkoutAnalytics } from '../database/services/WorkoutAnalytics';
import { WorkoutService } from '../database/services/WorkoutService';
import { getWorkoutIcon } from './workoutHistory';
import type { LineChartDataPoint } from '../components/LineChart';
import type { Units } from '../constants/settings';
import { getWeightUnitI18nKey } from './units';

export type WorkoutSet = {
  setNumber: number;
  weight: string;
  reps: number;
  partial: string;
  repsInReserve: number;
  isHighlighted: boolean;
};

export type WorkoutExercise = {
  id: string;
  name: string;
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
    labels: string[];
  };
  exercises: WorkoutExercise[];
};

/**
 * Format weight for display
 */
function formatWeight(
  weight: number,
  isBodyweight: boolean,
  t: (key: string) => string,
  units: Units
): string {
  const unitKey = getWeightUnitI18nKey(units);
  if (isBodyweight) {
    return weight > 0 ? `+${weight} ${t(unitKey)}` : t('workoutSession.bodyweight');
  }
  return `${weight} ${t(unitKey)}`;
}

/**
 * Format rest time in seconds to readable format
 */
function formatRestTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/**
 * Calculate volume trend from historical workout logs
 */
async function calculateVolumeTrend(
  currentWorkoutLog: WorkoutLog,
  t: (key: string) => string
): Promise<{
  percentage: number;
  data: LineChartDataPoint[];
  labels: string[];
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
    const x = (index / (sortedLogs.length - 1)) * chartWidth;
    const normalizedVolume = ((log.totalVolume || 0) - minVolume) / volumeRange;
    const y = chartHeight - normalizedVolume * chartHeight;
    return { x, y };
  });

  const labels: string[] = [];
  if (sortedLogs.length >= 4) {
    const firstDate = new Date(sortedLogs[0].startedAt || sortedLogs[0].completedAt || Date.now());
    const midDate = new Date(
      sortedLogs[Math.floor(sortedLogs.length / 2)].startedAt ||
        sortedLogs[Math.floor(sortedLogs.length / 2)].completedAt ||
        Date.now()
    );
    const lastDate = new Date(
      sortedLogs[sortedLogs.length - 1].startedAt ||
        sortedLogs[sortedLogs.length - 1].completedAt ||
        Date.now()
    );

    labels.push(format(firstDate, 'MMM d'));
    labels.push(format(midDate, 'MMM d'));
    labels.push(format(lastDate, 'MMM d'));
    labels.push(t('common.today') || 'TODAY');
  } else {
    sortedLogs.forEach((log) => {
      const date = new Date(log.startedAt || log.completedAt || Date.now());
      labels.push(format(date, 'MMM d'));
    });
  }

  return {
    percentage: percentageChange,
    data,
    labels,
  };
}

/**
 * Transform workout log data to modal format
 */
export async function transformWorkoutToDetailData(
  workoutLog: WorkoutLog,
  sets: WorkoutLogSet[],
  exercises: Exercise[],
  t: (key: string) => string,
  units: Units
): Promise<WorkoutDetailData> {
  const exerciseMap = new Map<string, Exercise>();
  exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

  const setsByExercise = new Map<string, WorkoutLogSet[]>();
  sets.forEach((set) => {
    if (!setsByExercise.has(set.exerciseId)) {
      setsByExercise.set(set.exerciseId, []);
    }
    setsByExercise.get(set.exerciseId)!.push(set);
  });

  const personalRecords = await WorkoutAnalytics.detectPersonalRecords(workoutLog);
  const prSetIds = new Set<string>();
  personalRecords.forEach((pr) => {
    sets.forEach((set) => {
      if (set.exerciseId === pr.exerciseId) {
        if (
          (pr.type === 'weight' && set.weight === pr.newRecord.weight) ||
          (pr.type === 'reps' && set.reps === pr.newRecord.reps) ||
          (pr.type === 'volume' && set.reps * set.weight === pr.newRecord.volume)
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

      const iconData = getWorkoutIcon(exercise.name);
      const sortedSets = exerciseSets.sort((a, b) => a.setOrder - b.setOrder);

      const workoutSets: WorkoutSet[] = sortedSets.map((set, index) => {
        const isHighlighted = prSetIds.has(set.id);
        return {
          setNumber: index + 1,
          weight: formatWeight(set.weight, isBodyweight, t, units),
          reps: set.reps,
          partial: set.difficultyLevel > 0 ? set.difficultyLevel.toString() : '-',
          repsInReserve: set.repsInReserve ?? 0,
          isHighlighted,
        };
      });

      const timeSpent = exerciseSets.length * 2;

      return {
        id: exerciseId,
        name: exercise.name,
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
    name: workoutLog.workoutName,
    date: workoutDate,
    totalTime: durationMinutes,
    volume: workoutLog.totalVolume || 0,
    calories: workoutLog.caloriesBurned || 0,
    volumeTrend,
    exercises: workoutExercises,
  };
}
