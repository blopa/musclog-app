import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BarChart3,
  CheckCircle,
  ChevronLeft,
  Clock,
  Dumbbell,
  Edit,
  Flame,
  Plus,
  Repeat,
  SkipForward,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { WorkoutStatCard } from '../../components/cards/WorkoutStatCard';
import { MasterLayout } from '../../components/MasterLayout';
import { AddExerciseToSessionModal } from '../../components/modals/AddExerciseToSessionModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { EditSetDetailsModal } from '../../components/modals/EditSetDetailsModal';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { FreeSessionExerciseCompleteModal } from '../../components/modals/FreeSessionExerciseCompleteModal';
import { LogSetPerformanceModal } from '../../components/modals/LogSetPerformanceModal';
import {
  ReplaceExerciseData,
  ReplaceExerciseModal,
} from '../../components/modals/ReplaceExerciseModal';
import { SessionFeedbackModal } from '../../components/modals/SessionFeedbackModal';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import { WorkoutSessionHistoryModal } from '../../components/modals/WorkoutSessionHistoryModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import ShowMoreButton from '../../components/ShowMoreButton';
import { Button } from '../../components/theme/Button';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { WorkoutActionButton } from '../../components/WorkoutActionButton';
import { WorkoutTimeTracker } from '../../components/WorkoutTimeTracker';
import { database } from '../../database';
import WorkoutLogExercise from '../../database/models/WorkoutLogExercise';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { useMenstrualCycle } from '../../hooks/useMenstrualCycle';
import { useSessionTotalTime } from '../../hooks/useSessionTotalTime';
import { useSettings } from '../../hooks/useSettings';
import { useWorkoutFeedback } from '../../hooks/useWorkoutFeedback';
import { useWorkoutFueling } from '../../hooks/useWorkoutFueling';
import { NotificationService } from '../../services/NotificationService';
import { theme } from '../../theme';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { displayToKg, kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';
import { formatDuration } from '../../utils/workout';

// Helper function to get hormonal insight text based on current phase
const getHormonalInsightText = (
  currentPhase: string | null,
  intensityMultiplier: number,
  t: (key: string, params?: Record<string, any>) => string
) => {
  switch (currentPhase) {
    case 'ovulation':
      return t('workoutSession.ovulationInsight');
    case 'menstrual':
      return t('workoutSession.menstrualInsight');
    default:
      return t('workoutSession.phaseInsight', {
        phase: currentPhase || 'unknown',
        multiplier: intensityMultiplier.toFixed(2),
      });
  }
};

function BlankWorkoutStats({
  startTime,
  workoutLogId,
}: {
  startTime: number;
  workoutLogId?: string;
}) {
  const { t } = useTranslation();
  const time = useSessionTotalTime({ startTime });
  const durationStr = formatDuration(time.hours, time.minutes, time.seconds);

  // Update notification with total time
  useEffect(() => {
    NotificationService.updateActiveWorkoutNotification(
      t('freeTraining.blankWorkout'),
      durationStr,
      undefined,
      workoutLogId
    );
  }, [durationStr, t, workoutLogId]);

  return (
    <View
      className="mt-10 flex-row justify-around rounded-xl border border-border-default bg-bg-card py-4"
      style={{ borderColor: theme.colors.background.white5 }}
    >
      <View className="items-center">
        <Clock size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.duration')}
        </Text>
        <Text className="mt-0.5 text-base font-bold text-text-primary">{durationStr}</Text>
      </View>
      <View className="items-center">
        <Flame size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.calories')}
        </Text>
        <Text className="mt-0.5 text-base font-bold text-text-primary">0 kcal</Text>
      </View>
      <View className="items-center">
        <BarChart3 size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.volume')}
        </Text>
        <Text className="mt-0.5 text-base font-bold text-text-primary">0 kg</Text>
      </View>
    </View>
  );
}

export default function WorkoutSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    exerciseId?: string;
    showFeedback?: string;
  }>();
  const { units } = useSettings();
  const {
    intensityMultiplier,
    currentPhase,
    isActive: isCycleTrackingActive,
  } = useMenstrualCycle();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const workoutLogId = params.workoutLogId;
  const initialExerciseId = params.exerciseId;
  const {
    workoutLog,
    sets,
    exercises,
    currentSetData,
    progress,
    isLoading,
    error,
    isWorkoutComplete,
    setCurrentExercise,
    refresh,
  } = useActiveWorkout(workoutLogId);

  const {
    status: fuelingStatus,
    totalCarbs: fuelingTotalCarbs,
    windowHours: fuelingWindowHours,
  } = useWorkoutFueling(workoutLog?.startedAt);

  const time = useSessionTotalTime({ startTime: workoutLog?.startedAt });
  const durationStr = formatDuration(time.hours, time.minutes, time.seconds);

  // Update notification with total time and current exercise
  useEffect(() => {
    if (workoutLog && !isLoading && !error) {
      NotificationService.updateActiveWorkoutNotification(
        workoutLog.workoutName || t('freeTraining.title'),
        durationStr,
        currentSetData?.exercise?.name,
        workoutLogId
      );
    }
  }, [workoutLog, isLoading, error, durationStr, currentSetData?.exercise?.name, workoutLogId, t]);

  // Dismiss notification when workout is finished or component unmounts
  useEffect(() => {
    return () => {
      NotificationService.dismissActiveWorkoutNotification();
      NotificationService.cancelWorkoutDurationWarning();
    };
  }, []);

  // Schedule 5-hour workout duration warning when workout begins
  useEffect(() => {
    if (!workoutLog) {
      return;
    }

    NotificationService.scheduleWorkoutDurationWarning(workoutLog.startedAt);
  }, [workoutLog, workoutLog?.startedAt]);

  const { completeWorkout, submitFeedback } = useWorkoutFeedback();

  // When navigated from rest-timer/rest-over after "Finish workout", show feedback modal
  useEffect(() => {
    if (params.showFeedback === '1' && workoutLog && !isLoading) {
      setIsSessionFeedbackModalVisible(true);
    }
  }, [params.showFeedback, isLoading, workoutLog]);

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [partials, setPartials] = useState(0);
  const [repsInReserve, setRepsInReserve] = useState(0);
  const [isStatsDataLoaded, setIsStatsDataLoaded] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isLogSetModalVisible, setIsLogSetModalVisible] = useState(false);
  const [isEditSetModalVisible, setIsEditSetModalVisible] = useState(false);
  const [isSkipSetModalVisible, setIsSkipSetModalVisible] = useState(false);
  const [isReplaceExerciseModalVisible, setIsReplaceExerciseModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isSessionFeedbackModalVisible, setIsSessionFeedbackModalVisible] = useState(false);
  const [isWorkoutOverviewModalVisible, setIsWorkoutOverviewModalVisible] = useState(false);
  const [isAddExerciseToSessionModalVisible, setIsAddExerciseToSessionModalVisible] =
    useState(false);
  const [isAddExerciseButtonLoading, setIsAddExerciseButtonLoading] = useState(false);
  const [isFreeSessionCompleteModalVisible, setIsFreeSessionCompleteModalVisible] = useState(false);
  const [completedExerciseForModal, setCompletedExerciseForModal] = useState<{
    exerciseId: string;
    exerciseName: string;
    exerciseImageUrl?: string | null;
    equipmentType?: string | null;
  } | null>(null);
  const hasShownFreeSessionCompleteModalRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isHormonalInsightDismissed, setIsHormonalInsightDismissed] = useState(false);
  const [isFuelingInsightDismissed, setIsFuelingInsightDismissed] = useState(false);
  const [isFuelingInsightExpanded, setIsFuelingInsightExpanded] = useState(false);

  // Update weight/reps when current set changes (weight in display unit)
  useEffect(() => {
    if (currentSetData) {
      const weightKg = currentSetData.set.weight ?? 0;
      setWeight(kgToDisplay(weightKg, units));
      setReps(currentSetData.set.reps ?? 0);
      setPartials(currentSetData.set.partials || 0);
      setRepsInReserve(currentSetData.set.repsInReserve ?? 0);
      setIsStatsDataLoaded(true);
    } else {
      setIsStatsDataLoaded(false);
    }
  }, [currentSetData, units]);

  // Redirect if no active workout
  useEffect(() => {
    if (!isLoading && !workoutLog && !workoutLogId) {
      router.replace('/workout/workouts');
    }
  }, [isLoading, workoutLog, workoutLogId, router]);

  // When workout is complete: redirect to summary for template sessions; show "add more or finish" modal for free sessions
  useEffect(() => {
    if (!workoutLog) {
      return;
    }

    if (!isWorkoutComplete()) {
      hasShownFreeSessionCompleteModalRef.current = false;
      return;
    }

    if (!isLoading && workoutLog.templateId) {
      // Don't redirect if we're showing session feedback (we navigated here to show the modal)
      if (params.showFeedback === '1' || isSessionFeedbackModalVisible) {
        return;
      }

      router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
      return;
    }
    // Free session: show "exercise complete" modal (e.g. when returning from rest-timer with no next set)
    if (!isLoading && !hasShownFreeSessionCompleteModalRef.current && sets.length > 0) {
      const completedSets = sets.filter(
        (s) => (s.difficultyLevel ?? 0) > 0 || (s.isSkipped ?? false)
      );

      const byOrder = [...completedSets].sort((a, b) => (b.setOrder ?? 0) - (a.setOrder ?? 0));
      const lastSet = byOrder[0];

      if (lastSet) {
        const exercise = exercises.find((e) => e.id === lastSet.exerciseId);
        setCompletedExerciseForModal({
          exerciseId: lastSet.exerciseId ?? '',
          exerciseName: exercise?.name ?? '',
          exerciseImageUrl: exercise?.imageUrl ?? null,
          equipmentType: exercise?.equipmentType ?? null,
        });
        setIsFreeSessionCompleteModalVisible(true);
        hasShownFreeSessionCompleteModalRef.current = true;
      }
    }
  }, [
    isLoading,
    isWorkoutComplete,
    workoutLog,
    sets,
    exercises,
    router,
    params.showFeedback,
    isSessionFeedbackModalVisible,
  ]);

  // Set initial exercise if provided in URL
  useEffect(() => {
    if (!isLoading && initialExerciseId && setCurrentExercise) {
      setCurrentExercise(initialExerciseId);
    }
  }, [isLoading, initialExerciseId, setCurrentExercise]);

  // Check from DB whether all sets are done (don't rely on React state which may be stale after updateSet)
  const checkAllSetsDoneFromDb = useCallback(async (logId: string): Promise<boolean> => {
    // First get all log exercises for this workout
    const logExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', logId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (logExercises.length === 0) {
      return false;
    }

    // Get all sets for these log exercises
    const logExerciseIds = logExercises.map((le) => le.id);
    const logSets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(logExerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (logSets.length === 0) {
      return false;
    }
    const done = logSets.filter(
      (s) => (s.difficultyLevel ?? 0) > 0 || (s.isSkipped ?? false)
    ).length;
    return done === logSets.length;
  }, []);

  const handleCompleteSet = async (rpe: number) => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    try {
      setIsSaving(true);
      // Small delay to allow React to render the loading state before closing
      await new Promise<void>((resolve) => setTimeout(resolve, 1));

      const restTime =
        currentSetData.set.restTimeAfter && currentSetData.set.restTimeAfter > 0
          ? currentSetData.set.restTimeAfter
          : 60;
      const completedSetOrder = currentSetData.set.setOrder ?? 0;

      await workoutLog.updateSet(currentSetData.set.id, {
        difficultyLevel: rpe,
        weight: displayToKg(weight, units),
        reps,
        partials,
        restTimeAfter: restTime,
      });

      // Check from DB if all sets are now done (state from refresh() may not be updated yet)
      const allSetsDone = await checkAllSetsDoneFromDb(workoutLog.id);
      await refresh();

      if (allSetsDone) {
        if (workoutLog.templateId) {
          await completeWorkout(workoutLog.id);
          router.replace(`/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`);
          setTimeout(() => setIsLogSetModalVisible(false), 0);
          return;
        }
        setCompletedExerciseForModal({
          exerciseId: currentSetData.set.exerciseId ?? '',
          exerciseName: currentSetData.exercise.name ?? '',
          exerciseImageUrl: currentSetData.exercise.imageUrl ?? null,
          equipmentType: currentSetData.exercise.equipmentType ?? null,
        });
        setIsFreeSessionCompleteModalVisible(true);
        hasShownFreeSessionCompleteModalRef.current = true;
        setTimeout(() => setIsLogSetModalVisible(false), 0);
        return;
      }

      router.push(
        `/workout/rest-timer?workoutLogId=${workoutLog.id}&completedSetOrder=${completedSetOrder}`
      );
      // Defer closing modal so navigation can run first and we avoid a flash of the session screen
      setTimeout(() => setIsLogSetModalVisible(false), 0);
    } catch (err) {
      console.error('Error completing set:', err);
      // Show error to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipSet = async () => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    try {
      setIsSaving(true);
      await workoutLog.updateSet(currentSetData.set.id, {
        isSkipped: true,
        difficultyLevel: 0,
      });

      const allSetsDone = await checkAllSetsDoneFromDb(workoutLog.id);
      await refresh();

      if (allSetsDone) {
        if (workoutLog.templateId) {
          await completeWorkout(workoutLog.id);
          router.replace(`/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`);
        } else {
          setCompletedExerciseForModal({
            exerciseId: currentSetData.set.exerciseId ?? '',
            exerciseName: currentSetData.exercise.name ?? '',
            exerciseImageUrl: currentSetData.exercise.imageUrl ?? null,
            equipmentType: currentSetData.exercise.equipmentType ?? null,
          });
          setIsFreeSessionCompleteModalVisible(true);
          hasShownFreeSessionCompleteModalRef.current = true;
        }
      } else {
        router.push(
          `/workout/rest-timer?workoutLogId=${workoutLog.id}&completedSetOrder=${currentSetData.set.setOrder ?? 0}`
        );
      }
    } catch (err) {
      console.error('Error skipping set:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSet = async (data: {
    weight: number;
    reps: number;
    partials: number;
    repsInReserve: number;
  }) => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    try {
      setIsSaving(true);
      await workoutLog.updateSet(currentSetData.set.id, {
        weight: displayToKg(data.weight, units),
        reps: data.reps,
        partials: data.partials,
        repsInReserve: data.repsInReserve,
      });

      setWeight(data.weight);
      setReps(data.reps);
      setPartials(data.partials);
      setRepsInReserve(data.repsInReserve);
      await refresh();
    } catch (err) {
      console.error('Error updating set:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceExercise = async (exercise: ReplaceExerciseData) => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    try {
      setIsSaving(true);

      // Find the log exercise that the current set belongs to and update its exerciseId
      const logExerciseId = currentSetData.set.logExerciseId;
      if (!logExerciseId) {
        console.error('No logExerciseId found for current set');
        return;
      }

      const logExercise = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .find(logExerciseId);

      // Update the log exercise's exerciseId (this affects all sets in this block)
      await database.write(async () => {
        await logExercise.update((le) => {
          le.exerciseId = exercise.id;
          le.updatedAt = Date.now();
        });
      });

      await refresh();
    } catch (err) {
      console.error('Error replacing exercise:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishWorkout = async () => {
    if (!workoutLog) {
      return;
    }

    try {
      setIsSaving(true);
      // Small delay to allow React to render the loading state before closing
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      await completeWorkout(workoutLog.id);
      setCompletedExerciseForModal(null);
      // Show feedback modal first so we don't flash the underlying screen when hiding the end-workout modal
      setIsSessionFeedbackModalVisible(true);
      setIsEndWorkoutModalVisible(false);
    } catch (err) {
      console.error('Error completing workout:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get exercise category string
  const getExerciseCategory = () => {
    if (!currentSetData) {
      return '';
    }

    const exercise = currentSetData.exercise;
    const parts = [];
    if (exercise.muscleGroup) {
      parts.push(t(exercise.muscleGroup));
    }

    if (exercise.equipmentType) {
      parts.push(exercise.equipmentType);
    }

    return parts.join(' • ') || t('exercises.manageExerciseData.unknownExercise');
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  // Blank Workout UI: free session with no sets yet
  if (workoutLog && !error && progress.totalSets === 0) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 bg-bg-primary">
          {/* Header: back + title */}
          <View className="flex-row items-center justify-between border-b border-border-default px-4 py-3">
            <Pressable
              className="h-12 w-12 items-center justify-center"
              onPress={() => setIsEndWorkoutModalVisible(true)}
            >
              <ChevronLeft size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>
            <Text
              className="text-lg font-semibold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.lg }}
            >
              {t('freeTraining.blankWorkout')}
            </Text>
            <View className="h-12 w-12" />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: theme.spacing.padding.xl,
              paddingTop: theme.spacing.padding['2xl'],
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon + title + subtitle */}
            <View className="items-center">
              <View
                className="mb-6 h-24 w-24 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary20 }}
              >
                <Dumbbell size={theme.iconSize['3xl']} color={theme.colors.accent.primary} />
              </View>
              <Text
                className="mb-2 text-center text-3xl font-bold text-text-primary"
                style={{ fontSize: theme.typography.fontSize['3xl'] }}
              >
                {t('freeTraining.title')}{' '}
                <Text style={{ color: theme.colors.accent.primary }}>
                  {t('freeTraining.titleSession')}
                </Text>
              </Text>
              <Text
                className="mb-8 text-center text-base text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.base }}
              >
                {t('freeTraining.subtitle')}
              </Text>
              <Button
                label={t('freeTraining.addFirstExercise')}
                icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.white} />}
                size="md"
                width="full"
                variant="gradientCta"
                loading={isAddExerciseButtonLoading}
                onPress={async () => {
                  setIsAddExerciseButtonLoading(true);
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                  setIsAddExerciseToSessionModalVisible(true);
                }}
              />
              <Text
                className="mt-4 text-center text-sm text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.sm }}
              >
                {t('freeTraining.tip')}
              </Text>
            </View>

            {/* Stats row */}
            <BlankWorkoutStats startTime={workoutLog.startedAt} workoutLogId={workoutLogId} />
          </ScrollView>
        </View>

        {/* End Workout Modal (reused from session) */}
        {isEndWorkoutModalVisible ? (
          <EndWorkoutModal
            visible={isEndWorkoutModalVisible}
            onClose={() => setIsEndWorkoutModalVisible(false)}
            onFinishAndSave={async () => {
              if (workoutLog) {
                try {
                  setIsSaving(true);
                  await completeWorkout(workoutLog.id);
                  setIsSessionFeedbackModalVisible(true);
                  setIsEndWorkoutModalVisible(false);
                } catch (err) {
                  console.error('Error completing workout:', err);
                } finally {
                  setIsSaving(false);
                }
              }
            }}
            onFinishAndDiscard={async () => {
              if (workoutLog) {
                await clearActiveWorkoutLogId();
              }
              router.replace('/workout/workouts');
            }}
          />
        ) : null}

        {isSessionFeedbackModalVisible && workoutLog ? (
          <SessionFeedbackModal
            visible={isSessionFeedbackModalVisible}
            onClose={() => {
              setIsSessionFeedbackModalVisible(false);
              router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
            }}
            onSubmit={async (data) => {
              try {
                await submitFeedback(workoutLog.id, data);
              } catch (err) {
                console.error('Error saving workout feedback:', err);
              } finally {
                router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
              }
            }}
          />
        ) : null}

        <AddExerciseToSessionModal
          visible={isAddExerciseToSessionModalVisible}
          onClose={() => {
            setIsAddExerciseToSessionModalVisible(false);
            setIsAddExerciseButtonLoading(false);
          }}
          onShow={() => setIsAddExerciseButtonLoading(false)}
          workoutLogId={workoutLog.id}
          onAdded={() => refresh()}
        />
      </MasterLayout>
    );
  }

  // Free session with all sets done: show "add more or finish" modal (no currentSetData when all complete).
  // Stay in this branch when Add Exercise modal or Session Feedback modal is open so those modals are rendered.
  if (
    workoutLog &&
    !error &&
    progress.totalSets > 0 &&
    progress.isComplete &&
    !workoutLog.templateId &&
    (completedExerciseForModal ||
      isAddExerciseToSessionModalVisible ||
      isSessionFeedbackModalVisible)
  ) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
          <LinearGradient
            colors={[...theme.colors.gradients.landingBackground]}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          {/* Decorative circles behind session feedback modal */}
          <View
            style={{
              position: 'absolute',
              top: '15%',
              left: '-20%',
              width: 280,
              height: 280,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: '35%',
              right: '-15%',
              width: 200,
              height: 200,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.35,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '10%',
              width: 120,
              height: 120,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.25,
            }}
          />
        </View>
        {completedExerciseForModal ? (
          <FreeSessionExerciseCompleteModal
            visible={isFreeSessionCompleteModalVisible}
            onClose={() => {
              setIsFreeSessionCompleteModalVisible(false);
              setCompletedExerciseForModal(null);
            }}
            exerciseName={completedExerciseForModal.exerciseName}
            sets={sets}
            exerciseId={completedExerciseForModal.exerciseId}
            units={units}
            exerciseImageUrl={completedExerciseForModal.exerciseImageUrl}
            equipmentType={completedExerciseForModal.equipmentType}
            onAddNextExercise={() => {
              setIsFreeSessionCompleteModalVisible(false);
              setIsAddExerciseToSessionModalVisible(true);
            }}
            onFinishWorkout={() => {
              setIsFreeSessionCompleteModalVisible(false);
              // Don't clear completedExerciseForModal here; handleFinishWorkout clears it after
              // completeWorkout() so we stay in this branch until feedback modal is shown.
              handleFinishWorkout();
            }}
            isFinishing={isSaving}
          />
        ) : null}
        <AddExerciseToSessionModal
          visible={isAddExerciseToSessionModalVisible}
          onClose={() => {
            setIsAddExerciseToSessionModalVisible(false);
            setIsFreeSessionCompleteModalVisible(true);
          }}
          workoutLogId={workoutLog.id}
          onAdded={() => refresh()}
        />
        {isSessionFeedbackModalVisible ? (
          <SessionFeedbackModal
            visible={isSessionFeedbackModalVisible}
            onClose={() => {
              setIsSessionFeedbackModalVisible(false);
              router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
            }}
            onSubmit={async (data) => {
              try {
                await submitFeedback(workoutLog.id, data);
              } catch (err) {
                console.error('Error saving workout feedback:', err);
              } finally {
                router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
              }
            }}
          />
        ) : null}
      </MasterLayout>
    );
  }

  // Template workout finished: show session feedback modal. When user taps "Finish and save"
  // we set isSessionFeedbackModalVisible(true), but the next render can have currentSetData null
  // (all sets done), which would otherwise hit the error branch below and never show the modal.
  if (isSessionFeedbackModalVisible && workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
          <LinearGradient
            colors={[...theme.colors.gradients.landingBackground]}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: '15%',
              left: '-20%',
              width: 280,
              height: 280,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: '35%',
              right: '-15%',
              width: 200,
              height: 200,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.35,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '10%',
              width: 120,
              height: 120,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.accent.primary20,
              opacity: 0.25,
            }}
          />
        </View>
        <SessionFeedbackModal
          visible={isSessionFeedbackModalVisible}
          onClose={() => {
            setIsSessionFeedbackModalVisible(false);
            router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
          }}
          onSubmit={async (data) => {
            try {
              await submitFeedback(workoutLog.id, data);
            } catch (err) {
              console.error('Error saving workout feedback:', err);
            } finally {
              router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
            }
          }}
        />
      </MasterLayout>
    );
  }

  if (error || !currentSetData || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error ? error : t('workoutSession.notFoundTitle')}
            description={t('workoutSession.notFoundDescription')}
            buttonLabel={t('workoutSession.goBack')}
            onButtonPress={() => router.replace('/workout/workouts')}
          />
        </View>
      </MasterLayout>
    );
  }

  const exerciseImage = currentSetData.exercise.imageUrl?.trim()
    ? { uri: currentSetData.exercise.imageUrl }
    : require('../../assets/exercises/fallback.png');
  const exerciseCategory = getExerciseCategory();
  const previousSet = currentSetData.previousSet;

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        <ImageBackground
          source={exerciseImage}
          className="absolute inset-0"
          style={{ height: theme.size['3xl'] * 10 }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              ...theme.colors.gradients.workoutSessionOverlay,
              theme.colors.background.primary,
            ]}
            locations={[0, 0.2, 0.5, 1]}
            style={{ flex: 1 }}
          />
        </ImageBackground>

        {/* Content */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Header */}
          <WorkoutTimeTracker
            onClose={() => setIsEndWorkoutModalVisible(true)}
            onOptionsPress={() => setIsOptionsModalVisible(true)}
            startTime={workoutLog.startedAt}
          />

          {/* Physiological Insight Card */}
          <View className="mx-6 mt-32 gap-3">
            {isCycleTrackingActive && !isHormonalInsightDismissed ? (
              <View className="rounded-2xl border-2 border-accent-primary/40 bg-accent-primary/20 p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-primary">
                    <Flame size={20} color={theme.colors.text.black} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold uppercase tracking-wider text-accent-primary">
                        {t('workoutSession.hormonalInsight')}
                      </Text>
                      <Pressable onPress={() => setIsHormonalInsightDismissed(true)}>
                        <X size={16} color={theme.colors.accent.primary} />
                      </Pressable>
                    </View>
                    <Text className="mt-0.5 font-medium text-text-primary">
                      {getHormonalInsightText(currentPhase, intensityMultiplier, t)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {fuelingStatus !== 'loading' && !isFuelingInsightDismissed ? (
              <Pressable
                onPress={() => setIsFuelingInsightExpanded(!isFuelingInsightExpanded)}
                className="rounded-2xl border-2 p-4"
                style={{
                  borderColor:
                    fuelingStatus === 'low'
                      ? `${theme.colors.status.warning}66`
                      : `${theme.colors.status.success}66`,
                  backgroundColor: `${theme.colors.background.card}95`,
                }}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor:
                        fuelingStatus === 'low'
                          ? theme.colors.status.warning
                          : theme.colors.status.success,
                    }}
                  >
                    <Flame
                      size={20}
                      color={
                        fuelingStatus === 'low' ? theme.colors.text.white : theme.colors.text.black
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-sm font-bold uppercase tracking-wider"
                        style={{
                          color:
                            fuelingStatus === 'low'
                              ? theme.colors.status.warning
                              : theme.colors.status.success,
                        }}
                      >
                        {t('workoutSession.fuelingInsight')}
                      </Text>
                      <Pressable onPress={() => setIsFuelingInsightDismissed(true)}>
                        <X
                          size={16}
                          color={
                            fuelingStatus === 'low'
                              ? theme.colors.status.warning
                              : theme.colors.status.success
                          }
                        />
                      </Pressable>
                    </View>
                    <Text
                      className="mt-0.5 font-medium text-text-primary"
                      numberOfLines={isFuelingInsightExpanded ? undefined : 1}
                      ellipsizeMode="tail"
                    >
                      {fuelingStatus === 'low'
                        ? t('workoutSession.lowFuelingMessage', {
                            carbs: Math.round(fuelingTotalCarbs),
                            hours: Math.round(fuelingWindowHours),
                          })
                        : t('workoutSession.fullyFueledMessage', {
                            carbs: Math.round(fuelingTotalCarbs),
                            hours: Math.round(fuelingWindowHours),
                          })}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>

          {/* Exercise Info */}
          <View className="mt-4 px-6">
            <Text
              className="mb-3 font-bold text-text-primary"
              style={{ fontSize: theme.typography.fontSize['40'] }}
            >
              {currentSetData.exercise.name ?? ''}
            </Text>
            <View className="mb-2 flex-row flex-wrap items-center gap-3">
              <View className="rounded-full bg-accent-primary px-4 py-1.5">
                <Text className="text-sm font-bold text-text-black">
                  {t('workoutSession.setOf', {
                    current: currentSetData.setNumber,
                    total: currentSetData.totalSetsInExercise,
                  })}
                </Text>
              </View>
              {currentSetData.setNumber === currentSetData.totalSetsInExercise ? (
                <Text className="text-sm font-medium text-accent-primary">
                  {t('workoutSession.lastSetForExercise')}
                </Text>
              ) : null}
              <Text className="text-lg text-text-secondary">{exerciseCategory}</Text>
            </View>
            {currentSetData.notes ? (
              <Pressable
                className="mt-3 rounded-lg p-3"
                style={{ backgroundColor: theme.colors.background.white5 }}
                onPress={() => setIsNotesExpanded(!isNotesExpanded)}
              >
                <Text
                  className="text-sm text-text-secondary"
                  numberOfLines={isNotesExpanded ? undefined : 1}
                  ellipsizeMode="tail"
                >
                  📝 {currentSetData.notes}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Stats Cards */}
          <View className="mt-8 flex-row gap-3 px-6">
            <WorkoutStatCard
              title={t('workoutSession.weight')}
              value={
                !isStatsDataLoaded ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  weight
                )
              }
              unit={isStatsDataLoaded ? t(weightUnitKey) : undefined}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.reps')}
              value={
                !isStatsDataLoaded ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  reps
                )
              }
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.partials')}
              value={
                !isStatsDataLoaded ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : partials === 0 ? (
                  '-'
                ) : (
                  partials
                )
              }
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
          </View>

          {/* Previous & History */}
          <View className="mt-6 flex-row items-center justify-between px-6">
            {previousSet ? (
              <Text className="text-text-secondary">
                {t('workoutSession.previous')}:{' '}
                <Text className="text-text-primary">
                  {t('workoutSession.previousSetFormat', {
                    weight: kgToDisplay(previousSet.weight ?? 0, units),
                    unit: t(weightUnitKey),
                    count: previousSet.reps,
                    repsLabel: t('workoutSession.reps'),
                  })}
                </Text>
              </Text>
            ) : (
              <Text className="text-text-secondary">{t('workoutSession.previous')}: -</Text>
            )}
            <ShowMoreButton
              onPress={() => setIsHistoryModalVisible(true)}
              label={t('workoutSession.history')}
            />
          </View>

          {/* Action Buttons */}
          <View className="mt-8 px-6 pb-8">
            <View className="mb-6 flex-row gap-6">
              <WorkoutActionButton
                icon={SkipForward}
                label={t('workoutSession.skip')}
                onPress={() => {
                  setIsSkipSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Edit}
                label={t('workoutSession.edit')}
                onPress={() => {
                  setIsEditSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Repeat}
                label={t('workoutSession.replace')}
                onPress={() => {
                  setIsReplaceExerciseModalVisible(true);
                }}
              />
            </View>

            {/* Complete Button */}
            <Button
              label={t('workoutSession.completeSet')}
              icon={CheckCircle}
              size="md"
              width="full"
              onPress={() => {
                setIsLogSetModalVisible(true);
              }}
              disabled={isSaving}
            />
          </View>
        </ScrollView>
      </View>

      {/* Workout Options Modal */}
      {isOptionsModalVisible ? (
        <WorkoutOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setIsOptionsModalVisible(false)}
          onPreviewWorkout={() => setIsWorkoutOverviewModalVisible(true)}
          // TODO: uncomment once we have workout settings
          // onWorkoutSettings={() => router.push('/workout-settings')}
          onEndWorkout={() => {
            setIsOptionsModalVisible(false);
            setIsEndWorkoutModalVisible(true);
          }}
          onAddExercise={
            workoutLog && !workoutLog.templateId
              ? () => {
                  setIsOptionsModalVisible(false);
                  setIsAddExerciseToSessionModalVisible(true);
                }
              : undefined
          }
        />
      ) : null}

      {/* End Workout Confirmation Modal */}
      {isEndWorkoutModalVisible ? (
        <EndWorkoutModal
          visible={isEndWorkoutModalVisible}
          onClose={() => setIsEndWorkoutModalVisible(false)}
          onFinishAndSave={handleFinishWorkout}
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

      {/* Session Feedback Modal */}
      {isSessionFeedbackModalVisible ? (
        <SessionFeedbackModal
          visible={isSessionFeedbackModalVisible}
          onClose={() => {
            setIsSessionFeedbackModalVisible(false);
            router.replace('/workout/workout-summary?workoutLogId=' + workoutLog.id);
          }}
          onSubmit={async (data) => {
            try {
              await submitFeedback(workoutLog.id, data);
            } catch (err) {
              console.error('Error saving workout feedback:', err);
            } finally {
              router.replace('/workout/workout-summary?workoutLogId=' + workoutLog.id);
            }
          }}
        />
      ) : null}

      {/* Log Set Performance Modal */}
      {isLogSetModalVisible ? (
        <LogSetPerformanceModal
          visible={isLogSetModalVisible}
          onClose={() => setIsLogSetModalVisible(false)}
          exerciseName={currentSetData.exercise.name ?? ''}
          setLabel={t('workoutSession.setOf', {
            current: currentSetData.setNumber,
            total: currentSetData.totalSetsInExercise,
          })}
          weight={weight}
          reps={reps}
          partials={partials}
          repsInReserve={repsInReserve}
          initialRpe={8}
          onConfirm={(data) => {
            handleCompleteSet(data.rpe);
          }}
          isSaving={isSaving}
          onEditSetDetails={(data) => {
            setWeight(data.weight);
            setReps(data.reps);
            setPartials(data.partials);
            setRepsInReserve(data.repsInReserve);
          }}
        />
      ) : null}

      {/* Edit Set Details Modal */}
      {isEditSetModalVisible ? (
        <EditSetDetailsModal
          visible={isEditSetModalVisible}
          onClose={() => setIsEditSetModalVisible(false)}
          onSave={handleEditSet}
          setLabel={t('workoutSession.setOf', {
            current: currentSetData.setNumber,
            total: currentSetData.totalSetsInExercise,
          })}
          initialWeight={weight}
          initialReps={reps}
          initialPartials={partials}
          initialRepsInReserve={repsInReserve}
        />
      ) : null}

      {/* Skip Set Confirmation Modal */}
      {isSkipSetModalVisible ? (
        <ConfirmationModal
          visible={isSkipSetModalVisible}
          onClose={() => setIsSkipSetModalVisible(false)}
          onConfirm={handleSkipSet}
          title={t('workoutSession.skipSet.title')}
          message={t('workoutSession.skipSet.message')}
          confirmLabel={t('workoutSession.skipSet.confirm')}
          cancelLabel={t('workoutSession.skipSet.cancel')}
          variant="destructive"
        />
      ) : null}

      {/* Replace Exercise Modal */}
      {isReplaceExerciseModalVisible ? (
        <ReplaceExerciseModal
          visible={isReplaceExerciseModalVisible}
          onClose={() => setIsReplaceExerciseModalVisible(false)}
          onReplace={handleReplaceExercise}
          currentExercise={currentSetData.exercise.name}
        />
      ) : null}

      {/* Workout History Modal */}
      {isHistoryModalVisible ? (
        <WorkoutSessionHistoryModal
          visible={isHistoryModalVisible}
          onClose={() => setIsHistoryModalVisible(false)}
          workoutLog={workoutLog}
          sets={sets}
          exercises={exercises}
          currentSetOrder={progress.currentSetOrder}
        />
      ) : null}

      {/* Workout Session Overview Modal */}
      {isWorkoutOverviewModalVisible ? (
        <WorkoutSessionOverviewModal
          visible={isWorkoutOverviewModalVisible}
          onClose={() => setIsWorkoutOverviewModalVisible(false)}
          workoutLogId={workoutLog.id}
          onResumeSession={() => {
            setIsWorkoutOverviewModalVisible(false);
            // Stay on current screen - already on workout session
          }}
          onSelectExercise={async (exerciseId) => {
            setIsWorkoutOverviewModalVisible(false);
            // Set the current exercise to jump to that exercise's first unlogged set
            setCurrentExercise(exerciseId);
          }}
          onCancelWorkout={() => {
            setIsWorkoutOverviewModalVisible(false);
            setIsEndWorkoutModalVisible(true);
          }}
          onFinishWorkout={() => {
            // Don't close overview first — handleFinishWorkout shows feedback modal; closing first would flash the session screen
            handleFinishWorkout();
          }}
        />
      ) : null}

      <AddExerciseToSessionModal
        visible={isAddExerciseToSessionModalVisible}
        onClose={() => setIsAddExerciseToSessionModalVisible(false)}
        workoutLogId={workoutLog.id}
        onAdded={() => refresh()}
      />

      {completedExerciseForModal ? (
        <FreeSessionExerciseCompleteModal
          visible={isFreeSessionCompleteModalVisible}
          onClose={() => {
            setIsFreeSessionCompleteModalVisible(false);
            setCompletedExerciseForModal(null);
          }}
          exerciseName={completedExerciseForModal.exerciseName}
          sets={sets}
          exerciseId={completedExerciseForModal.exerciseId}
          units={units}
          exerciseImageUrl={completedExerciseForModal.exerciseImageUrl}
          equipmentType={completedExerciseForModal.equipmentType}
          onAddNextExercise={() => {
            setIsFreeSessionCompleteModalVisible(false);
            setCompletedExerciseForModal(null);
            setIsAddExerciseToSessionModalVisible(true);
          }}
          onFinishWorkout={() => {
            setIsFreeSessionCompleteModalVisible(false);
            setCompletedExerciseForModal(null);
            handleFinishWorkout();
          }}
          isFinishing={isSaving}
        />
      ) : null}
    </MasterLayout>
  );
}
