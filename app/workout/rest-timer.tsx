import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle, ChevronRight, Dumbbell, Repeat } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { WorkoutService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useWorkoutSessionState } from '../../hooks/useWorkoutSessionState';
import { NotificationService } from '../../services/NotificationService';
import { theme } from '../../theme';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';

export default function RestTimerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string; completedSetOrder?: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const workoutLogId = params.workoutLogId;
  const completedSetOrder =
    params.completedSetOrder != null ? parseInt(params.completedSetOrder, 10) : null;

  const sessionState = useWorkoutSessionState(
    workoutLogId && completedSetOrder !== null ? workoutLogId : undefined
  );
  const {
    workoutLog,
    sets,
    exercises,
    currentSet: nextSetFromHook,
    isLoading: sessionLoading,
    error: sessionError,
  } = sessionState;

  const completedSet = useMemo(() => {
    if (completedSetOrder === null || sets.length === 0) {
      return null;
    }

    const set = sets.find((s) => (s.setOrder ?? 0) === completedSetOrder);
    if (!set) {
      return null;
    }

    const exercise = exercises.find((e) => e.id === set.exerciseId);
    if (!exercise) {
      return null;
    }

    return { set, exercise };
  }, [sets, exercises, completedSetOrder]);

  const nextSet = useMemo(() => {
    if (!nextSetFromHook) {
      return null;
    }

    const exercise = exercises.find((e) => e.id === nextSetFromHook.exerciseId);
    if (!exercise) {
      return null;
    }

    return { set: nextSetFromHook, exercise };
  }, [nextSetFromHook, exercises]);

  const [restTime, setRestTime] = useState(90);
  const [initialRestTime, setInitialRestTime] = useState(90);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isWorkoutOverviewModalVisible, setIsWorkoutOverviewModalVisible] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRequiredParams = Boolean(workoutLogId && completedSetOrder !== null);
  const isLoading = hasRequiredParams ? sessionLoading : false;

  // Helper function to determine error state
  const getRestTimerError = (): string | null => {
    if (!hasRequiredParams) {
      return t('restTimer.missingWorkoutData');
    }

    if (sessionError) {
      return sessionError;
    }

    if (!sessionLoading && sets.length > 0 && !completedSet) {
      return t('restTimer.completedSetNotFound');
    }

    return null;
  };

  const error = getRestTimerError();

  // Sync rest time from completed set when session data is ready
  useEffect(() => {
    if (!completedSet) {
      return;
    }

    const value =
      completedSet.set.restTimeAfter && completedSet.set.restTimeAfter > 0
        ? completedSet.set.restTimeAfter
        : 60;

    setRestTime(value);
    setInitialRestTime(value);
  }, [completedSet]);

  // Schedule rest timer notification when rest begins, cancel on unmount (covers skip, auto-navigate, end workout)
  useEffect(() => {
    if (isLoading || !completedSet || initialRestTime <= 0) {
      return;
    }

    NotificationService.scheduleRestTimerNotification(initialRestTime);

    return () => {
      NotificationService.cancelRestTimerNotification();
    };
  }, [isLoading, completedSet, initialRestTime]);

  // Navigate after rest: skip exercise-transition when next set is in same superset group
  const navigateToNextScreen = useCallback(() => {
    if (!workoutLogId) {
      router.back();
      return;
    }

    if (!nextSet) {
      router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
      return;
    }

    const sameSupersetGroup =
      completedSet &&
      nextSet.set.groupId &&
      completedSet.set.groupId &&
      nextSet.set.groupId === completedSet.set.groupId;

    const differentExercise = completedSet && nextSet.exercise.id !== completedSet.exercise.id;

    // Only show exercise-transition when switching to a different exercise that is NOT in the same superset
    if (differentExercise && !sameSupersetGroup) {
      router.replace(
        `/workout/exercise-transition?workoutLogId=${workoutLogId}&completedExerciseId=${completedSet.exercise.id}&nextExerciseId=${nextSet.exercise.id}`
      );

      return;
    }

    router.replace(
      `/workout/workout-session?workoutLogId=${workoutLogId}&exerciseId=${nextSet.exercise.id}`
    );
  }, [completedSet, nextSet, router, workoutLogId]);

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
  }, [isLoading, restTime]); // Only when loading finishes; omit restTime so interval is not recreated every second

  // Navigate when countdown reaches 0
  useEffect(() => {
    if (restTime === 0 && !isLoading && workoutLogId) {
      const timer = setTimeout(() => {
        navigateToNextScreen();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [restTime, isLoading, workoutLogId, completedSet, nextSet, router, navigateToNextScreen]);

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
      const doTask = async () => {
        try {
          if (workoutLog && completedSet) {
            await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: next });
          }
        } catch (err) {
          console.error('Error saving rest time:', err);
        }
      };

      doTask();

      return next;
    });
  };

  const handlePlus5s = () => {
    setRestTime((prev) => {
      const next = prev + 5;
      const doTask = async () => {
        try {
          if (workoutLog && completedSet) {
            await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: next });
          }
        } catch (err) {
          console.error('Error saving rest time:', err);
        }
      };

      doTask();

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
              {kgToDisplay(completedSet.set.weight ?? 0, units)} {t(weightUnitKey)}{' '}
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
                  value: `${kgToDisplay(nextSet.set.weight ?? 0, units)} ${t(weightUnitKey)}`,
                  icon: Dumbbell,
                },
                itemTwo: {
                  value: t('restTimer.repsWithCount', {
                    count: nextSet.set.reps ?? 0,
                  }),
                  icon: Repeat,
                },
                itemThree: {
                  value: t('restTimer.repsWithCount', {
                    count: nextSet.set.reps ?? 0,
                  }),
                  icon: ChevronRight,
                },
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
          // TODO: uncomment once we have workout settings
          // onWorkoutSettings={() => router.push('/workout-settings')}
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
              router.replace(
                `/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`
              );
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
                router.replace(
                  `/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`
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
