import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, ChevronRight, Dumbbell, Repeat } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Text, View } from 'react-native';

import { DetailedItemCard } from '@/components/cards/DetailedItemCard';
import { MasterLayout } from '@/components/MasterLayout';
import { EndWorkoutModal } from '@/components/modals/EndWorkoutModal';
import { WorkoutOptionsModal } from '@/components/modals/WorkoutOptionsModal';
import WorkoutSessionOverviewModal from '@/components/modals/WorkoutSessionOverviewModal';
import { RestTimer } from '@/components/RestTimer';
import { RestTimerControls } from '@/components/RestTimerControls';
import { UpNextLabel } from '@/components/UpNextLabel';
import { WorkoutTimeTracker } from '@/components/WorkoutTimeTracker';
import { isStaticExport } from '@/constants/platform';
import { WorkoutService } from '@/database/services';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutSessionState } from '@/hooks/useWorkoutSessionState';
import { NotificationService } from '@/services/NotificationService';
import {
  clearActiveWorkoutLogId,
  clearRestTimerEndAt,
  getRestTimerEndAt,
  setRestTimerEndAt,
} from '@/utils/activeWorkoutStorage';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

export default function RestTimerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string; completedSetOrder?: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const { locale } = useFormatAppNumber();
  const formatDisplayWeight = useCallback(
    (kg: number) => formatDisplayWeightKg(locale, units, kg),
    [locale, units]
  );

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
  const [isTimerReady, setIsTimerReady] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isWorkoutOverviewModalVisible, setIsWorkoutOverviewModalVisible] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Wall-clock timestamp (ms) when the rest period should end.
  // Stored in a ref so interval callbacks always read the latest value without re-creating the interval.
  const endAtRef = useRef<number>(0);

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

  // Resolve rest timer from AsyncStorage (resumed session) or calculate fresh from the completed set.
  // Uses wall-clock end timestamp so the countdown is immune to app backgrounding.
  useEffect(() => {
    if (!completedSet || !workoutLogId) {
      return;
    }

    const init = async () => {
      const storedEndAt = await getRestTimerEndAt(workoutLogId);

      if (storedEndAt !== null) {
        // Resumed: recalculate from the persisted end timestamp.
        const remaining = Math.ceil((storedEndAt - Date.now()) / 1000);
        endAtRef.current = storedEndAt;

        if (remaining <= 0) {
          // Timer already elapsed while the app was closed — navigate immediately.
          navigateToNextScreen();
          return;
        }

        const duration =
          completedSet.set.restTimeAfter && completedSet.set.restTimeAfter > 0
            ? completedSet.set.restTimeAfter
            : 60;
        setInitialRestTime(duration);
        setRestTime(remaining);
        setIsTimerReady(true);
      } else {
        // Fresh timer: compute the end timestamp and persist it.
        const duration =
          completedSet.set.restTimeAfter && completedSet.set.restTimeAfter > 0
            ? completedSet.set.restTimeAfter
            : 60;
        const endAt = Date.now() + duration * 1000;
        endAtRef.current = endAt;
        setRestTimerEndAt(workoutLogId, endAt);
        setInitialRestTime(duration);
        setRestTime(duration);
        setIsTimerReady(true);
      }
    };

    init();
    // Only run once when completedSet first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSet, workoutLogId]);

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
  const navigateToNextScreen = useCallback(async () => {
    await clearRestTimerEndAt();

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

  // Wall-clock countdown: recalculates remaining time from endAtRef on every tick.
  // Survives app backgrounding because it uses Date.now() instead of state decrement.
  useEffect(() => {
    if (isStaticExport || isLoading || !isTimerReady) {
      return;
    }
    if (countdownIntervalRef.current) {
      return;
    } // Already running

    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRestTime(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isLoading, isTimerReady]); // Start once when timer is ready; endAtRef is a ref so no need to list it

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
    // Shift the end timestamp back by 5 s (floor at 1 s from now so we don't go negative)
    endAtRef.current = Math.max(Date.now() + 1_000, endAtRef.current - 5_000);
    const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRestTime(remaining);

    if (workoutLogId) {
      setRestTimerEndAt(workoutLogId, endAtRef.current);
    }

    // Persist change to DB
    const doTask = async () => {
      try {
        if (workoutLog && completedSet) {
          await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: remaining });
        }
      } catch (err) {
        console.error('Error saving rest time:', err);
      }
    };

    doTask();
  };

  const handlePlus5s = () => {
    // Shift the end timestamp forward by 5 s
    endAtRef.current += 5_000;
    const remaining = Math.ceil((endAtRef.current - Date.now()) / 1000);
    setRestTime(remaining);

    if (workoutLogId) {
      setRestTimerEndAt(workoutLogId, endAtRef.current);
    }

    const doTask = async () => {
      try {
        if (workoutLog && completedSet) {
          await workoutLog.updateSet(completedSet.set.id, { restTimeAfter: remaining });
        }
      } catch (err) {
        console.error('Error saving rest time:', err);
      }
    };

    doTask();
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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  if (error || !completedSet || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
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
              {formatDisplayWeight(completedSet.set.weight ?? 0)} {t(weightUnitKey)}{' '}
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
                  value: `${formatDisplayWeight(nextSet.set.weight ?? 0)} ${t(weightUnitKey)}`,
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
          // onWorkoutSettings={() => router.navigate('/workout-settings')}
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
