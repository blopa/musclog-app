import { Q } from '@nozbe/watermelondb';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ExerciseTransitionScreen } from '../../components/ExerciseTransitionScreen';
import { MasterLayout } from '../../components/MasterLayout';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { database } from '../../database';
import Exercise from '../../database/models/Exercise';
import WorkoutLog from '../../database/models/WorkoutLog';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';
import { getWeightUnitI18nKey } from '../../utils/units';

type NextExercisePayload = {
  name: string;
  muscleGroups: string;
  imageUri: string;
  targetSets: number;
  targetReps: string;
  targetWeight: string;
  restTime: number;
  equipment: string[];
};

export default function NewExerciseTransitionScreen() {
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    completedExerciseId?: string;
    nextExerciseId?: string;
  }>();

  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [completedExerciseName, setCompletedExerciseName] = useState<string>('');
  const [nextExercise, setNextExercise] = useState<NextExercisePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!params.workoutLogId) {
        setError(t('exerciseTransition.noWorkoutId'));
        setIsLoading(false);
        return;
      }

      if (!params.nextExerciseId) {
        setIsLoading(false);
        router.replace(`/workout/workout-session?workoutLogId=${params.workoutLogId}`);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const log = await database.get<WorkoutLog>('workout_logs').find(params.workoutLogId);
        if (log.deletedAt) {
          throw new Error('Workout has been deleted');
        }
        setWorkoutLog(log);

        if (params.completedExerciseId) {
          const completedEx = await database
            .get<Exercise>('exercises')
            .find(params.completedExerciseId);
          setCompletedExerciseName(completedEx.name ?? '');
        }

        const nextEx = await database.get<Exercise>('exercises').find(params.nextExerciseId);
        const sets = await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('workout_log_id', params.workoutLogId),
            Q.where('exercise_id', params.nextExerciseId),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .fetch();

        const targetSets = sets.length;
        const firstSet = sets[0];
        const restTime = firstSet?.restTimeAfter ?? 60;
        const targetReps =
          firstSet?.reps != null && firstSet.reps > 0 ? String(firstSet.reps) : '—';
        const targetWeight =
          firstSet?.weight != null && firstSet.weight > 0
            ? `${firstSet.weight} ${t(weightUnitKey)}`
            : '—';

        const muscleGroupRaw = (nextEx.muscleGroup ?? 'other').toLowerCase();
        const muscleGroup = t(`exercises.muscleGroups.${muscleGroupRaw}`);
        const equipmentTypeRaw = (nextEx.equipmentType ?? 'other').toLowerCase();
        const equipmentType = t(`exercises.equipmentTypes.${equipmentTypeRaw}`);
        const muscleGroups = t('exercises.manageExerciseData.detailFormat', {
          muscleGroup,
          equipment: equipmentType,
        });

        setNextExercise({
          name: nextEx.name ?? '',
          muscleGroups,
          imageUri: nextEx.imageUrl ?? '',
          targetSets,
          targetReps,
          targetWeight,
          restTime,
          equipment: [equipmentType],
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading exercise transition data:', err);
        setError(err instanceof Error ? err.message : t('exerciseTransition.loadFailed'));
        setIsLoading(false);
      }
    };

    loadData();
  }, [
    params.workoutLogId,
    params.completedExerciseId,
    params.nextExerciseId,
    router,
    t,
    weightUnitKey,
  ]);

  const handleStartNextExercise = () => {
    if (params.workoutLogId) {
      const exerciseId = params.nextExerciseId ? `&exerciseId=${params.nextExerciseId}` : '';
      router.replace(`/workout/workout-session?workoutLogId=${params.workoutLogId}${exerciseId}`);
    }
  };

  const formatTotalTime = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  if (error || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error || t('exerciseTransition.errorTitle')}
            description={t('exerciseTransition.errorDescription')}
            buttonLabel={t('exerciseTransition.goBack')}
            onButtonPress={() => {
              if (params.workoutLogId) {
                router.replace(`/workout/workout-session?workoutLogId=${params.workoutLogId}`);
              } else {
                router.back();
              }
            }}
          />
        </View>
      </MasterLayout>
    );
  }

  if (!nextExercise) {
    if (params.workoutLogId) {
      router.replace(`/workout/workout-session?workoutLogId=${params.workoutLogId}`);
    }
    return null;
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <StatusBar style="light" />
      <ExerciseTransitionScreen
        totalTime={
          workoutLog.startedAt ? formatTotalTime(new Date(workoutLog.startedAt)) : '00:00:00'
        }
        completedExercise={completedExerciseName}
        completedMessage={t('exerciseTransition.completedMessage')}
        nextExercise={nextExercise}
        onStartNextExercise={handleStartNextExercise}
      />
    </MasterLayout>
  );
}
