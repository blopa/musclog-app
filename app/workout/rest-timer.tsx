import { Q } from '@nozbe/watermelondb';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle, ChevronRight, Dumbbell, Repeat } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Text, View } from 'react-native';

import { DetailedItemCard } from '../../components/cards/DetailedItemCard';
import { MasterLayout } from '../../components/MasterLayout';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import { RestTimer } from '../../components/RestTimer';
import { RestTimerControls } from '../../components/RestTimerControls';
import { UpNextLabel } from '../../components/UpNextLabel';
import { WorkoutTimeTracker } from '../../components/WorkoutTimeTracker';
import { database } from '../../database';
import Exercise from '../../database/models/Exercise';
import WorkoutLog from '../../database/models/WorkoutLog';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { WorkoutService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { getWeightUnitI18nKey } from '../../utils/units';

export default function RestTimerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string; completedSetOrder?: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const workoutLogId = params.workoutLogId;
  const completedSetOrder = params.completedSetOrder
    ? parseInt(params.completedSetOrder, 10)
    : null;

  const [restTime, setRestTime] = useState(90); // Will be updated from database
  const [initialRestTime, setInitialRestTime] = useState(90);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [completedSet, setCompletedSet] = useState<{
    set: WorkoutLogSet;
    exercise: Exercise;
  } | null>(null);
  const [nextSet, setNextSet] = useState<{ set: WorkoutLogSet; exercise: Exercise } | null>(null);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isWorkoutOverviewModalVisible, setIsWorkoutOverviewModalVisible] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load workout data
  useEffect(() => {
    const loadData = async () => {
      if (!workoutLogId || completedSetOrder === null) {
        setError('Missing workout data');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load workout log
        const log = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
        setWorkoutLog(log);

        // Load all sets
        const sets = await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('workout_log_id', workoutLogId),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .fetch();

        // Find completed set
        const completed = sets.find((s) => (s.setOrder ?? 0) === completedSetOrder);
        if (!completed) {
          throw new Error('Completed set not found');
        }

        // Load exercise for completed set
        const completedExercise = await database
          .get<Exercise>('exercises')
          .find(completed.exerciseId ?? '');

        setCompletedSet({ set: completed, exercise: completedExercise });

        // Get rest time from completed set, default to 60 seconds if not set
        const restTimeValue =
          completed.restTimeAfter && completed.restTimeAfter > 0 ? completed.restTimeAfter : 60;
        setRestTime(restTimeValue);
        setInitialRestTime(restTimeValue);

        // Find the next set to be done (first unlogged, non-skipped set in workout order)
        const next = sets
          .filter((s) => (s.difficultyLevel ?? 0) === 0 && !s.isSkipped)
          .sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0))[0];

        if (next) {
          const nextExercise = await database
            .get<Exercise>('exercises')
            .find(next.exerciseId ?? '');
          setNextSet({ set: next, exercise: nextExercise });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading rest timer data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setIsLoading(false);
      }
    };

    loadData();
  }, [workoutLogId, completedSetOrder]);

  // Navigate to exercise-transition when next set is a different exercise, else workout-session
  const navigateToNextScreen = () => {
    if (!workoutLogId) {
      router.back();
      return;
    }
    if (!nextSet) {
      router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
      return;
    }
    if (completedSet && nextSet.exercise.id !== completedSet.exercise.id) {
      router.replace(
        `/workout/exercise-transition?workoutLogId=${workoutLogId}&completedExerciseId=${completedSet.exercise.id}&nextExerciseId=${nextSet.exercise.id}`
      );
      return;
    }
    router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
  };

  // Rest timer countdown: run one interval when loading finishes and restTime > 0.
  // Do NOT depend on restTime so we don't clear/recreate the interval every second.
  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (restTime <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    if (countdownIntervalRef.current) {
      return;
    } // Already running
    countdownIntervalRef.current = setInterval(() => {
      setRestTime((prev) => {
        if (prev <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isLoading]); // Only when loading finishes; omit restTime so interval is not recreated every second

  // Navigate when countdown reaches 0
  useEffect(() => {
    if (restTime === 0 && !isLoading && workoutLogId) {
      const timer = setTimeout(() => {
        navigateToNextScreen();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [restTime, isLoading, workoutLogId, completedSet, nextSet, router]);

  // Spinning loader animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotationAnim]);

  const handleMinus5s = () => {
    setRestTime((prev) => {
      const next = Math.max(0, prev - 5);
      // Persist change to DB
      (async () => {
        try {
          if (workoutLog && completedSet) {
            await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: next });
          }
        } catch (err) {
          console.error('Error saving rest time:', err);
        }
      })();
      return next;
    });
  };

  const handlePlus5s = () => {
    setRestTime((prev) => {
      const next = prev + 5;
      (async () => {
        try {
          if (workoutLog && completedSet) {
            await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: next });
          }
        } catch (err) {
          console.error('Error saving rest time:', err);
        }
      })();
      return next;
    });
  };

  const handleSkipRest = () => {
    if (workoutLogId) {
      navigateToNextScreen();
    } else {
      router.back();
    }
  };

  const handleEndWorkout = () => {
    setIsOptionsModalVisible(false);
    setIsEndWorkoutModalVisible(true);
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

  if (error || !completedSet || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-primary">{error || t('errors.failedToLoadData')}</Text>
        </View>
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        <View
          className="absolute right-[-40%] top-[-20%] h-[20%] w-[110%] overflow-hidden rounded-full"
          style={{
            ...theme.shadows.purpleGlow,
            backgroundColor: theme.colors.background.purpleBlob,
          }}
        />
        <View
          className="absolute bottom-[-40%] left-[-20%] h-[50%] w-[110%] overflow-hidden rounded-full"
          style={{
            ...theme.shadows.purpleGlow,
            backgroundColor: theme.colors.background.greenBlob,
          }}
        />

        {/* Header */}
        <View className="relative z-20">
          <WorkoutTimeTracker
            onClose={() => setIsEndWorkoutModalVisible(true)}
            onOptionsPress={() => setIsOptionsModalVisible(true)}
            startTime={workoutLog.startedAt}
          />
        </View>

        {/* Main Content */}
        <View className="z-10 flex-1 items-center justify-center gap-10 px-6">
          {/* Timer */}
          <RestTimer
            restTime={restTime}
            rotationAnim={rotationAnim}
            initialRestTime={initialRestTime}
          />

          {/* Controls */}
          <RestTimerControls
            onMinus5s={handleMinus5s}
            onSkipRest={handleSkipRest}
            onPlus5s={handlePlus5s}
          />
        </View>
        <View className="z-10 mx-auto w-full max-w-lg gap-4 px-4 pb-8">
          {/* Completed Exercise */}
          <View className="flex-row items-center justify-between px-2">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={theme.iconSize.md} color={theme.colors.accent.primary} />
              <Text className="text-sm" style={{ color: theme.colors.overlay.white50 }}>
                {t('restTimer.done')}:{' '}
                <Text className="font-medium text-text-primary">
                  {completedSet.exercise.name ?? ''}
                </Text>
              </Text>
            </View>
            <Text className="font-medium" style={{ color: theme.colors.overlay.white70 }}>
              {completedSet.set.weight ?? 0} {t(weightUnitKey)}{' '}
              <Text style={{ color: theme.colors.overlay.white30 }}>×</Text>{' '}
              {completedSet.set.reps ?? 0} {t('restTimer.reps')}
            </Text>
          </View>

          {/* Next Exercise Card */}
          {nextSet ? (
            <DetailedItemCard
              item={{
                name: nextSet.exercise.name ?? '',
                media: require('../../assets/icon.png'), // Default image for now
                itemOne: {
                  value: `${nextSet.set.weight ?? 0} ${t(weightUnitKey)}`,
                  icon: Dumbbell,
                },
                itemTwo: { value: `${nextSet.set.reps ?? 0} reps`, icon: Repeat },
                itemThree: { value: `${nextSet.set.reps ?? 0} reps`, icon: ChevronRight },
              }}
              onPress={() => {
                navigateToNextScreen();
              }}
              ctaLabel={<UpNextLabel />}
            />
          ) : null}
        </View>
      </View>
      {isOptionsModalVisible ? (
        <WorkoutOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setIsOptionsModalVisible(false)}
          onPreviewWorkout={() => {
            setIsOptionsModalVisible(false);
            setIsWorkoutOverviewModalVisible(true);
          }}
          onWorkoutSettings={() => router.push('/workout-settings')}
          onEndWorkout={handleEndWorkout}
        />
      ) : null}
      {isEndWorkoutModalVisible ? (
        <EndWorkoutModal
          visible={isEndWorkoutModalVisible}
          onClose={() => setIsEndWorkoutModalVisible(false)}
          onFinishAndSave={async () => {
            if (workoutLog) {
              await WorkoutService.completeWorkout(workoutLog.id);
              router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
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
            if (workoutLog) {
              try {
                await WorkoutService.completeWorkout(workoutLog.id);
                router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
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
