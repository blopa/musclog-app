import { useLocalSearchParams, useRouter } from 'expo-router';
import { Play, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, View } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import { RestOverNextExercise } from '../../components/RestOverNextExercise';
import { RestOverStatusIcon } from '../../components/RestOverStatusIcon';
import { RestOverTitle } from '../../components/RestOverTitle';
import { Button } from '../../components/theme/Button';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { WorkoutTimeTracker } from '../../components/WorkoutTimeTracker';
import { database } from '../../database';
import WorkoutLog from '../../database/models/WorkoutLog';
import { WorkoutService } from '../../database/services';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { formatDisplayWeightKg } from '../../utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '../../utils/units';

export default function RestOverScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const { locale } = useFormatAppNumber();
  const formatDisplayWeight = useCallback(
    (kg: number) => formatDisplayWeightKg(locale, units, kg),
    [locale, units]
  );
  const params = useLocalSearchParams<{ workoutLogId?: string; nextSetOrder?: string }>();
  const workoutLogId = params.workoutLogId;
  const nextSetOrder = params.nextSetOrder ? parseInt(params.nextSetOrder, 10) : null;

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isWorkoutOverviewModalVisible, setIsWorkoutOverviewModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [nextExercise, setNextExercise] = useState<{
    name: string;
    weightKg: number;
    reps: number;
    set: number;
    totalSets: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pulse animation for the glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Load next set data
  useEffect(() => {
    const loadData = async () => {
      if (!workoutLogId) {
        setError('No workout ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load workout log
        const log = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
        if (log.deletedAt) {
          throw new Error('Workout has been deleted');
        }
        setWorkoutLog(log);

        // Load next set
        if (nextSetOrder !== null) {
          const next = await WorkoutService.getNextSet(workoutLogId, nextSetOrder - 1);
          if (next) {
            // Calculate set number within exercise
            const allSets = await WorkoutService.getWorkoutWithDetails(workoutLogId);
            const exerciseSets = allSets.sets.filter((s) => s.exerciseId === next.set.exerciseId);
            const setNumber = exerciseSets.findIndex((s) => s.id === next.set.id) + 1;

            setNextExercise({
              name: next.exercise.name ?? '',
              weightKg: next.set.weight ?? 0,
              reps: next.set.reps ?? 0,
              set: setNumber,
              totalSets: exerciseSets.length,
            });
          }
        } else {
          // Get current set if no next set order provided
          const current = await WorkoutService.getCurrentSet(workoutLogId);
          if (current) {
            const allSets = await WorkoutService.getWorkoutWithDetails(workoutLogId);
            const exerciseSets = allSets.sets.filter(
              (s) => s.exerciseId === current.set.exerciseId
            );
            const setNumber = exerciseSets.findIndex((s) => s.id === current.set.id) + 1;

            setNextExercise({
              name: current.exercise.name ?? '',
              weightKg: current.set.weight ?? 0,
              reps: current.set.reps ?? 0,
              set: setNumber,
              totalSets: exerciseSets.length,
            });
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading rest over data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workout data');
        setIsLoading(false);
      }
    };

    loadData();
  }, [workoutLogId, nextSetOrder]);

  const nextExerciseDisplayWeight = useMemo(() => {
    if (!nextExercise) {
      return null;
    }

    return t('restOver.weightWithUnit', {
      value: formatDisplayWeight(nextExercise.weightKg),
      unit: t(weightUnitKey),
    });
  }, [nextExercise, weightUnitKey, t, formatDisplayWeight]);

  const handleStartNextSet = () => {
    if (workoutLogId) {
      router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
    }
  };

  const handleEndWorkout = () => {
    setIsOptionsModalVisible(false);
    setIsEndWorkoutModalVisible(true);
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  if (error || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error || t('workoutSession.notFoundTitle')}
            description={t('workoutSession.notFoundDescription')}
            buttonLabel={t('workoutSession.goBack')}
            onButtonPress={() => router.replace('/workout/workouts')}
          />
        </View>
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <Animated.View
        className="absolute right-[-10%] top-[-20%] h-[50%] w-[80%] rounded-full blur-3xl"
        style={{
          backgroundColor: theme.colors.accent.primary40,
          opacity: pulseAnim,
        }}
      />
      <Animated.View
        className="absolute bottom-[-10%] left-[-20%] h-[50%] w-[90%] rounded-full blur-3xl"
        style={{
          backgroundColor: theme.colors.status.emerald20,
        }}
      />

      {/* Header */}
      <View className="relative z-20">
        <WorkoutTimeTracker
          onClose={() => router.back()}
          onOptionsPress={() => setIsOptionsModalVisible(true)}
          startTime={workoutLog.startedAt}
        />
      </View>

      {/* Main Content */}
      <View className="z-10 w-full flex-1 items-center justify-center gap-8 px-6">
        <RestOverStatusIcon />
        <RestOverTitle />
        {nextExercise ? (
          <RestOverNextExercise
            exercise={{
              ...nextExercise,
              // use memoized display weight
              weight: nextExerciseDisplayWeight ?? '',
            }}
          />
        ) : null}
      </View>

      {/* Footer */}
      <View className="z-10 w-full px-6 pb-12">
        <Button
          label={t('restOver.startNextSet')}
          icon={Play}
          variant="accent"
          size="lg"
          width="full"
          onPress={handleStartNextSet}
        />
      </View>

      {/* Workout Options Modal */}
      {isOptionsModalVisible ? (
        <WorkoutOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setIsOptionsModalVisible(false)}
          onPreviewWorkout={() => {
            setIsOptionsModalVisible(false);
            setIsWorkoutOverviewModalVisible(true);
          }}
          // TODO: uncomment once we have workout settings
          // onWorkoutSettings={() => router.navigate('/workout-settings')}
          onEndWorkout={handleEndWorkout}
        />
      ) : null}

      {/* End Workout Confirmation Modal */}
      {isEndWorkoutModalVisible ? (
        <EndWorkoutModal
          visible={isEndWorkoutModalVisible}
          onClose={() => setIsEndWorkoutModalVisible(false)}
          onFinishAndSave={async () => {
            if (workoutLogId) {
              try {
                await WorkoutService.completeWorkout(workoutLogId);
                router.replace(
                  `/workout/workout-session?workoutLogId=${workoutLogId}&showFeedback=1`
                );
              } catch (err) {
                console.error('Error completing workout:', err);
              }
            }
          }}
          onFinishAndDiscard={async () => {
            // Clear active workout from storage when discarding
            if (workoutLog) {
              await clearActiveWorkoutLogId();
            }

            // navigate to workout screen
            router.replace('/workout/workouts');
          }}
        />
      ) : null}

      {/* Workout Session Overview Modal */}
      {isWorkoutOverviewModalVisible ? (
        <WorkoutSessionOverviewModal
          visible={isWorkoutOverviewModalVisible}
          onClose={() => setIsWorkoutOverviewModalVisible(false)}
          workoutLogId={workoutLogId}
          onStartWorkout={() => {
            setIsWorkoutOverviewModalVisible(false);
            router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
          }}
          onResumeSession={() => {
            setIsWorkoutOverviewModalVisible(false);
            router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
          }}
          onSelectExercise={(exerciseId) => {
            setIsWorkoutOverviewModalVisible(false);
            router.replace(
              `/workout/workout-session?workoutLogId=${workoutLogId}&exerciseId=${exerciseId}`
            );
          }}
          onCancelWorkout={() => {
            setIsWorkoutOverviewModalVisible(false);
            setIsEndWorkoutModalVisible(true);
          }}
          onFinishWorkout={async () => {
            setIsWorkoutOverviewModalVisible(false);
            if (workoutLogId) {
              try {
                await WorkoutService.completeWorkout(workoutLogId);
                router.replace(
                  `/workout/workout-session?workoutLogId=${workoutLogId}&showFeedback=1`
                );
              } catch (err) {
                console.error('Error completing workout:', err);
              }
            }
          }}
        />
      ) : null}
    </MasterLayout>
  );
}
