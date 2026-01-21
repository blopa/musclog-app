import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import Exercise from '../database/models/Exercise';
import { WorkoutAnalytics } from '../database/services/WorkoutAnalytics';
import { getWorkoutIcon } from './workoutHistory';
import type { LineChartDataPoint } from '../components/LineChart';

export type WorkoutSet = {
  setNumber: number;
  weight: string;
  reps: number;
  partial: string;
  rest: string;
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
function formatWeight(weight: number, isBodyweight: boolean, t: (key: string) => string): string {
  if (isBodyweight) {
    return weight > 0 ? `+${weight} ${t('workoutSession.kg')}` : t('workoutSession.bodyweight');
  }
  return `${weight} ${t('workoutSession.kg')}`;
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
 * Transform workout log data to modal format
 */
export async function transformWorkoutToDetailData(
  workoutLog: WorkoutLog,
  sets: WorkoutLogSet[],
  exercises: Exercise[],
  t: (key: string) => string
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

      const isBodyweight = exercise.equipmentType
        ?.toLowerCase()
        .includes('bodyweight') || false;

      const iconData = getWorkoutIcon(exercise.name);
      const sortedSets = exerciseSets.sort((a, b) => a.setOrder - b.setOrder);

      const workoutSets: WorkoutSet[] = sortedSets.map((set, index) => {
        const isHighlighted = prSetIds.has(set.id);
        return {
          setNumber: index + 1,
          weight: formatWeight(set.weight, isBodyweight, t),
          reps: set.reps,
          partial: set.difficultyLevel > 0 ? set.difficultyLevel.toString() : '-',
          rest: formatRestTime(set.restTime),
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

  return {
    name: workoutLog.workoutName,
    date: workoutDate,
    totalTime: durationMinutes,
    volume: workoutLog.totalVolume || 0,
    calories: workoutLog.caloriesBurned || 0,
    volumeTrend: {
      percentage: 0,
      data: [],
      labels: [],
    },
    exercises: workoutExercises,
  };
}
