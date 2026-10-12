import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TFunction } from 'i18next';
import {
  BarChart3,
  Bluetooth,
  CheckCircle,
  ChevronLeft,
  Circle,
  Dumbbell,
  Edit,
  Flame,
  Moon,
  Plus,
  Repeat,
  SkipForward,
  WifiOff,
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

import { InfoCard } from '@/components/cards/InfoCard';
import { WorkoutStatCard } from '@/components/cards/WorkoutStatCard';
import { MasterLayout } from '@/components/MasterLayout';
import { AddExerciseToSessionModal } from '@/components/modals/AddExerciseToSessionModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { EditSetDetailsModal } from '@/components/modals/EditSetDetailsModal';
import { EndWorkoutModal } from '@/components/modals/EndWorkoutModal';
import { FreeSessionExerciseCompleteModal } from '@/components/modals/FreeSessionExerciseCompleteModal';
import { LogSetPerformanceModal } from '@/components/modals/LogSetPerformanceModal';
import { ReplaceExerciseModal } from '@/components/modals/ReplaceExerciseModal';
import { SessionFeedbackModal } from '@/components/modals/SessionFeedbackModal';
import { WorkoutOptionsModal } from '@/components/modals/WorkoutOptionsModal';
import { WorkoutSessionHistoryModal } from '@/components/modals/WorkoutSessionHistoryModal';
import WorkoutSessionOverviewModal from '@/components/modals/WorkoutSessionOverviewModal';
import { WorkoutSettingsModal } from '@/components/modals/WorkoutSettingsModal';
import ShowMoreButton from '@/components/ShowMoreButton';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { BlankWorkoutStats } from '@/components/workout/BlankWorkoutStats';
import { ExerciseNotesSheet } from '@/components/workout/ExerciseNotesSheet';
import { PlateCalculatorSheet } from '@/components/workout/PlateCalculatorSheet';
import { SessionExerciseNotes } from '@/components/workout/SessionExerciseNotes';
import { SessionGymHelpers } from '@/components/workout/SessionGymHelpers';
import { SetAdjustmentNotice } from '@/components/workout/SetAdjustmentNotice';
import { WorkoutActionButton } from '@/components/WorkoutActionButton';
import { WorkoutTimeTracker } from '@/components/WorkoutTimeTracker';
import { database } from '@/database';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useExerciseImageSource } from '@/hooks/useExerciseImageSource';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSessionBleTracking } from '@/hooks/useSessionBleTracking';
import { useSessionExerciseActions } from '@/hooks/useSessionExerciseActions';
import { useSessionSetForm } from '@/hooks/useSessionSetForm';
import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutFeedback } from '@/hooks/useWorkoutFeedback';
import { useWorkoutFueling } from '@/hooks/useWorkoutFueling';
import i18n from '@/lang/lang';
import { NotificationService } from '@/services/NotificationService';
import {
  clearActiveWorkoutLogId,
  getDismissedInsights,
  setInsightDismissed,
} from '@/utils/activeWorkoutStorage';
import {
  getExerciseTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { formatAppDecimal } from '@/utils/formatAppNumber';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { isBarLoadedEquipment } from '@/utils/gym';
import { handleError } from '@/utils/handleError';
import { weightInputStep } from '@/utils/loadIncrement';
import { resolveRestSeconds } from '@/utils/restTimer';
import { adjustedFields } from '@/utils/setAdjustment';
import { displayToKg } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import { warmupOfferFor } from '@/utils/warmupSets';
import { formatDuration } from '@/utils/workout';
import { isResolvedWorkoutSet, isWarmupSet } from '@/utils/workoutSetCompletion';

// Helper function to get hormonal insight text based on current phase
const getHormonalInsightText = (
  currentPhase: string | null,
  intensityMultiplier: number,
  t: TFunction
) => {
  switch (currentPhase) {
    case 'ovulatory':
      return t('workoutSession.ovulationInsight');
    case 'menstrual':
      return t('workoutSession.menstrualInsight');
    default:
      return t('workoutSession.phaseInsight', {
        phase: currentPhase || 'unknown',
        multiplier: formatAppDecimal(
          i18n.resolvedLanguage ?? i18n.language,
          intensityMultiplier,
          2
        ),
      });
  }
};

export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  useKeepScreenAwake('workout-session');
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    exerciseId?: string;
    showFeedback?: string;
  }>();
  const { bleGenerateChartPayload, autoStartRestTimer, defaultRestSeconds } = useSettings();
  const { gym } = useActiveGym();
  const { unitsFor, get: getExerciseSettings } = useExerciseUserSettings();
  const {
    intensityMultiplier,
    currentPhase,
    isActive: isCycleTrackingActive,
  } = useMenstrualCycle();

  const formatWeightStatDisplay = useCallback(
    (displayUnit: number) =>
      displayUnit % 1 === 0
        ? formatInteger(displayUnit, { useGrouping: false })
        : formatDecimal(displayUnit, 1),
    [formatDecimal, formatInteger]
  );

  const workoutLogId = params.workoutLogId;
  const initialExerciseId = params.exerciseId;
  const {
    workoutLog,
    sets,
    exercises,
    logExercises: activeLogExercises,
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

  const currentExerciseImage = useExerciseImageSource(currentSetData?.exercise.imageUrl);

  // Weights are shown and entered in the unit of the exercise in front of the user: its own
  // override, else the gym's, else the account's. Storage stays metric whichever is shown.
  const units = unitsFor(currentSetData?.exercise.id);
  const weightUnitKey = getWeightUnitI18nKey(units);
  const exerciseNote = getExerciseSettings(currentSetData?.exercise.id).note;
  const currentLogExercise = activeLogExercises.find(
    (logExercise) => logExercise.id === currentSetData?.set.logExerciseId
  );

  // One tap on +/- moves to the next load this exercise's equipment can really be set to.
  const weightStep = weightInputStep(currentSetData?.exercise.equipmentType, gym, units);

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

  const [isSessionFeedbackExplicitlyOpen, setIsSessionFeedbackExplicitlyOpen] = useState(false);
  // Derive: show when explicitly opened OR when navigated here with showFeedback=1 and data ready
  const isSessionFeedbackModalVisible =
    isSessionFeedbackExplicitlyOpen || (params.showFeedback === '1' && !!workoutLog && !isLoading);
  const setIsSessionFeedbackModalVisible = (open: boolean) => {
    setIsSessionFeedbackExplicitlyOpen(open);
  };

  const {
    weight,
    setWeight,
    reps,
    setReps,
    partials,
    setPartials,
    repsInReserve,
    setRepsInReserve,
    isStatsDataLoaded,
  } = useSessionSetForm(currentSetData, units);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isLogSetModalVisible, setIsLogSetModalVisible] = useState(false);
  const [isEditSetModalVisible, setIsEditSetModalVisible] = useState(false);
  const [isSkipSetModalVisible, setIsSkipSetModalVisible] = useState(false);
  const [isReplaceExerciseModalVisible, setIsReplaceExerciseModalVisible] = useState(false);
  const [isPlateCalculatorVisible, setIsPlateCalculatorVisible] = useState(false);
  // With auto-start off, the set just finished waits here for a tap on "Start rest".
  const [pendingRest, setPendingRest] = useState<{ setOrder: number; seconds: number } | null>(
    null
  );
  const [isWorkoutSettingsVisible, setIsWorkoutSettingsVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
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
  // Derive: only show the completed-exercise modal when the workout is actually complete
  const effectiveCompletedExerciseForModal = isWorkoutComplete() ? completedExerciseForModal : null;
  const hasShownFreeSessionCompleteModalRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotesSheetVisible, setIsNotesSheetVisible] = useState(false);
  const [isHormonalInsightDismissed, setIsHormonalInsightDismissed] = useState(false);
  const [isFuelingInsightDismissed, setIsFuelingInsightDismissed] = useState(false);
  const ble = useSessionBleTracking({
    workoutLogId,
    workoutLog,
    currentSetData,
    reps,
    bleGenerateChartPayload,
  });
  const exerciseActions = useSessionExerciseActions({
    currentSetData,
    gym,
    exerciseNote,
    refresh,
    setIsSaving,
  });

  // Load dismissed insights from storage
  useEffect(() => {
    if (workoutLogId) {
      getDismissedInsights(workoutLogId).then((dismissed) => {
        setIsHormonalInsightDismissed(!!dismissed.hormonal);
        setIsFuelingInsightDismissed(!!dismissed.fueling);
      });
    }
  }, [workoutLogId]);

  // Redirect if no active workout
  useEffect(() => {
    if (!isLoading && !workoutLog && !workoutLogId) {
      router.replace('/app/workout/workouts');
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

      router.replace(`/app/workout/workout-summary?workoutLogId=${workoutLog.id}`);
      return;
    }

    // Free session: show "exercise complete" modal (e.g. when returning from rest-timer with no next set, or resuming a finished one)
    if (
      !isLoading &&
      !currentSetData &&
      !hasShownFreeSessionCompleteModalRef.current &&
      sets.length > 0 &&
      !isSessionFeedbackModalVisible &&
      params.showFeedback !== '1'
    ) {
      const byOrder = [...sets].sort((a, b) => (b.setOrder ?? 0) - (a.setOrder ?? 0));
      const lastSet = byOrder[0];

      const showCompletionModal = () => {
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
        } else {
          // Fallback for empty/weird states
          setIsAddExerciseToSessionModalVisible(true);
          hasShownFreeSessionCompleteModalRef.current = true;
        }
      };
      showCompletionModal();
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
    currentSetData,
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
    const done = logSets.filter(isResolvedWorkoutSet).length;
    return done === logSets.length;
  }, []);

  const handleCompleteSet = async (data: {
    rpe: number;
    weight: number;
    reps: number;
    partials: number;
    repsInReserve: number;
  }) => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    await ble.finishSetRecording();

    try {
      setIsSaving(true);
      // Small delay to allow React to render the loading state before closing
      await new Promise<void>((resolve) => setTimeout(resolve, 1));

      const restTime = resolveRestSeconds(currentSetData.set.restTimeAfter, defaultRestSeconds);
      const completedSetOrder = currentSetData.set.setOrder ?? 0;

      const completedSetId = currentSetData.set.id;
      await workoutLog.updateSet(completedSetId, {
        completionStatus: 'performed',
        difficultyLevel: data.rpe,
        weight: displayToKg(data.weight, units),
        reps: data.reps,
        partials: data.partials,
        repsInReserve: data.repsInReserve,
        restTimeAfter: restTime,
      });

      ble.attachRecordingToSet(completedSetId, data.reps);

      // Check from DB if all sets are now done (state from refresh() may not be updated yet)
      const allSetsDone = await checkAllSetsDoneFromDb(workoutLog.id);
      await refresh();

      if (allSetsDone) {
        if (workoutLog.templateId) {
          await completeWorkout(workoutLog.id);
          router.replace(
            `/app/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`
          );
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

      if (autoStartRestTimer) {
        router.replace(
          `/app/workout/rest-timer?workoutLogId=${workoutLog.id}&completedSetOrder=${completedSetOrder}`
        );
      } else {
        // The user turned off auto-start: stay here and offer a "Start rest" button instead.
        setPendingRest({ setOrder: completedSetOrder, seconds: restTime });
      }
      // Defer closing modal so navigation can run first and we avoid a flash of the session screen
      setTimeout(() => setIsLogSetModalVisible(false), 0);
    } catch (err) {
      handleError(err, 'workout-session.handleCompleteSet', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipSet = async () => {
    if (!currentSetData || !workoutLog) {
      return;
    }

    setIsSaving(true);
    await flushLoadingPaint();
    try {
      await workoutLog.updateSet(currentSetData.set.id, {
        completionStatus: 'skipped',
        difficultyLevel: null,
      });

      const allSetsDone = await checkAllSetsDoneFromDb(workoutLog.id);
      await refresh();

      if (allSetsDone) {
        if (workoutLog.templateId) {
          await completeWorkout(workoutLog.id);
          router.replace(
            `/app/workout/workout-session?workoutLogId=${workoutLog.id}&showFeedback=1`
          );
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
      } else if (autoStartRestTimer) {
        router.replace(
          `/app/workout/rest-timer?workoutLogId=${workoutLog.id}&completedSetOrder=${currentSetData.set.setOrder ?? 0}`
        );
      }
    } catch (err) {
      handleError(err, 'workout-session.handleSkipSet', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
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
      handleError(err, 'workout-session.handleEditSet', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
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
      handleError(err, 'workout-session.handleFinishWorkout', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
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
      parts.push(t(getMuscleGroupTranslationKey(exercise.muscleGroup)));
    }

    if (exercise.equipmentType) {
      parts.push(t(getExerciseTypeTranslationKey(exercise.equipmentType)));
    }

    return parts.join(' • ') || t('exercises.manageExerciseData.unknownExercise');
  };

  let content;

  if (isLoading) {
    content = (
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  } else if (workoutLog && !error && progress.totalSets === 0) {
    content = (
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
              icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.primary} />}
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
    );
  } else if (
    (isSessionFeedbackModalVisible && workoutLog) ||
    (workoutLog && !error && progress.totalSets > 0 && progress.isComplete)
  ) {
    content = (
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
    );
  } else if (error || !workoutLog) {
    content = (
      <View className="flex-1 items-center justify-center px-6">
        <ErrorStateCard
          icon={WifiOff}
          title={error ? error : t('workoutSession.notFoundTitle')}
          description={t('workoutSession.notFoundDescription')}
          buttonLabel={t('workoutSession.goBack')}
          onButtonPress={() => router.replace('/app/workout/workouts')}
        />
      </View>
    );
  } else if (!currentSetData && !progress.isComplete) {
    // This happens if exercises are missing or all sets are done but isComplete is somehow false
    content = (
      <View className="flex-1 bg-bg-primary">
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
            {workoutLog.workoutName || t('freeTraining.title')}
          </Text>
          <Pressable
            className="h-12 w-12 items-center justify-center"
            onPress={() => setIsWorkoutOverviewModalVisible(true)}
          >
            <BarChart3 size={theme.iconSize.lg} color={theme.colors.text.primary} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={Dumbbell}
            title={t('workoutSession.missingDataTitle')}
            description={t('workoutSession.missingDataDescription')}
            buttonLabel={t('workoutSession.viewOverview')}
            onButtonPress={() => setIsWorkoutOverviewModalVisible(true)}
          />
        </View>
      </View>
    );
  } else if (currentSetData) {
    const exerciseCategory = getExerciseCategory();
    const previousSet = currentSetData.previousSet;
    const setAdjustment = currentSetData.set.adjustment;
    // A number the app calculated carries the marker, on the field it actually changed. A
    // carry-over is the user's own previous load, so it is deliberately not marked.
    const { weight: isWeightRetargeted, reps: isRepsRetargeted } = adjustedFields(setAdjustment);

    const isCurrentSetWarmup = isWarmupSet(currentSetData.set);
    const warmupOffer = warmupOfferFor({
      exerciseSets: sets.filter((set) => set.exerciseId === currentSetData.exercise.id),
      currentSet: currentSetData.set,
      workingKg: displayToKg(weight, units),
      gym,
      equipmentType: currentSetData.exercise.equipmentType,
      units,
    });
    let partialsValue;

    if (!isStatsDataLoaded) {
      partialsValue = <ActivityIndicator size="small" color={theme.colors.text.primary} />;
    } else if (partials === 0) {
      partialsValue = '-';
    } else {
      partialsValue = formatInteger(partials, { useGrouping: false });
    }

    content = (
      <View className="flex-1">
        <ImageBackground
          source={currentExerciseImage}
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
              <InfoCard
                variant="success"
                icon={Moon}
                label={t('workoutSession.hormonalInsight')}
                message={getHormonalInsightText(currentPhase, intensityMultiplier, t)}
                onDismiss={async () => {
                  setIsHormonalInsightDismissed(true);
                  if (workoutLogId) {
                    await setInsightDismissed(workoutLogId, 'hormonal');
                  }
                }}
              />
            ) : null}

            {fuelingStatus !== 'loading' && !isFuelingInsightDismissed ? (
              <InfoCard
                variant={fuelingStatus === 'low' ? 'warning' : 'success'}
                icon={Flame}
                label={t('workoutSession.fuelingInsight')}
                message={
                  fuelingStatus === 'low'
                    ? t('workoutSession.lowFuelingMessage', {
                        carbs: Math.round(fuelingTotalCarbs),
                        hours: Math.round(fuelingWindowHours),
                      })
                    : t('workoutSession.fullyFueledMessage', {
                        carbs: Math.round(fuelingTotalCarbs),
                        hours: Math.round(fuelingWindowHours),
                      })
                }
                onDismiss={async () => {
                  setIsFuelingInsightDismissed(true);
                  if (workoutLogId) {
                    await setInsightDismissed(workoutLogId, 'fueling');
                  }
                }}
              />
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
                <Text className="text-sm font-bold text-text-on-accent">
                  {t('workoutSession.setOf', {
                    current: currentSetData.setNumber,
                    total: currentSetData.totalSetsInExercise,
                  })}
                </Text>
              </View>
              {isCurrentSetWarmup ? (
                <View
                  className="rounded-full border px-3 py-1"
                  style={{ borderColor: theme.colors.accent.primary }}
                >
                  <Text className="text-xs font-bold text-accent-primary">
                    {t('workoutSession.warmup.badge')}
                  </Text>
                </View>
              ) : null}
              {currentSetData.setNumber === currentSetData.totalSetsInExercise ? (
                <Text className="text-sm font-medium text-accent-primary">
                  {t('workoutSession.lastSetForExercise')}
                </Text>
              ) : null}
              <Text className="text-lg text-text-secondary">{exerciseCategory}</Text>
            </View>
            <SessionExerciseNotes
              exerciseNote={exerciseNote}
              sessionNote={currentSetData.notes}
              onEdit={() => setIsNotesSheetVisible(true)}
            />
          </View>

          {/* Stats Cards */}
          <View className="mt-8 flex-row gap-3 px-6">
            <WorkoutStatCard
              title={t('workoutSession.weight')}
              value={
                !isStatsDataLoaded ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  formatWeightStatDisplay(weight)
                )
              }
              unit={isStatsDataLoaded ? t(weightUnitKey) : undefined}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
              isAdjusted={isWeightRetargeted}
            />
            <WorkoutStatCard
              title={t('workoutSession.reps')}
              value={
                !isStatsDataLoaded ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  formatInteger(reps, { useGrouping: false })
                )
              }
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
              isAdjusted={isRepsRetargeted}
            />
            <WorkoutStatCard
              title={t('workoutSession.partials')}
              value={partialsValue}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
          </View>

          {/* Gym helpers: plate calculator for bar-loaded lifts, warm-up sets before the first working set */}
          {isStatsDataLoaded ? (
            <SessionGymHelpers
              plateCalculatorLoad={
                weight > 0 && isBarLoadedEquipment(currentSetData.exercise.equipmentType)
                  ? { weight: formatWeightStatDisplay(weight), unit: t(weightUnitKey) }
                  : null
              }
              onOpenPlateCalculator={() => setIsPlateCalculatorVisible(true)}
              pendingRestSeconds={pendingRest?.seconds ?? null}
              onStartRest={() => {
                if (!pendingRest) {
                  return;
                }
                setPendingRest(null);
                router.push(
                  `/app/workout/rest-timer?workoutLogId=${workoutLog?.id}&completedSetOrder=${pendingRest.setOrder}`
                );
              }}
              canAddWarmups={warmupOffer.toAdd.length > 0}
              onAddWarmups={() => exerciseActions.addWarmups(warmupOffer.toAdd)}
              canRemoveWarmups={warmupOffer.canRemove}
              onRemoveWarmups={exerciseActions.removeWarmups}
              isSaving={isSaving}
            />
          ) : null}

          {/* Why these numbers differ from the plan */}
          {setAdjustment && isStatsDataLoaded ? (
            <View className="mt-4 px-6">
              <SetAdjustmentNotice
                adjustment={setAdjustment}
                onRevert={exerciseActions.revertStartAdjustment}
              />
            </View>
          ) : null}

          {/* Previous & History */}
          <View className="mt-6 flex-row items-center justify-between px-6">
            {previousSet ? (
              <Text className="text-text-secondary">
                {t('workoutSession.previous')}:{' '}
                <Text className="text-text-primary">
                  {t('workoutSession.previousSetFormat', {
                    weight: formatDisplayWeightKg(
                      i18n.resolvedLanguage ?? i18n.language,
                      units,
                      previousSet.weight ?? 0
                    ),
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

            {/* Sensor tracking row — only visible when a BLE device is connected */}
            {ble.isSensorConnected ? (
              <View className="mb-4 gap-3">
                {ble.isTracking || ble.isStopTrackingSaving ? (
                  <Button
                    label={t('workoutSession.stopTracking')}
                    icon={
                      <Circle
                        size={theme.iconSize.sm}
                        color={theme.colors.rose.brand}
                        fill={theme.colors.rose.brand}
                        opacity={ble.isTrackingBlinkOn ? 1 : 0.25}
                      />
                    }
                    size="md"
                    width="full"
                    variant="secondary"
                    loading={ble.isStopTrackingSaving}
                    disabled={ble.isStopTrackingSaving}
                    onPress={ble.stopTrackingFromButton}
                  />
                ) : (
                  <Button
                    label={t('workoutSession.startTracking')}
                    icon={Bluetooth}
                    size="md"
                    width="full"
                    variant="secondary"
                    onPress={ble.startTracking}
                  />
                )}
              </View>
            ) : null}

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
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <AnimatedContent style={{ flex: 1 }}>
        {content}

        {/* Workout Options Modal -- Note: closing tag for AnimatedContent is after all modals */}
        {isOptionsModalVisible ? (
          <WorkoutOptionsModal
            visible={isOptionsModalVisible}
            onClose={() => setIsOptionsModalVisible(false)}
            onPreviewWorkout={() => setIsWorkoutOverviewModalVisible(true)}
            onWorkoutSettings={() => {
              setIsOptionsModalVisible(false);
              setIsWorkoutSettingsVisible(true);
            }}
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
              router.replace('/app/workout/workouts');
            }}
          />
        ) : null}

        {/* Session Feedback Modal */}
        {isSessionFeedbackModalVisible && workoutLog ? (
          <SessionFeedbackModal
            visible={isSessionFeedbackModalVisible}
            onClose={() => {
              setIsSessionFeedbackModalVisible(false);
              router.replace(`/app/workout/workout-summary?workoutLogId=${workoutLog.id}`);
            }}
            onSubmit={async (data) => {
              try {
                await submitFeedback(workoutLog.id, data);
              } catch (err) {
                console.error('Error saving workout feedback:', err);
              } finally {
                router.replace(`/app/workout/workout-summary?workoutLogId=${workoutLog.id}`);
              }
            }}
          />
        ) : null}

        {/* Log Set Performance Modal */}
        {isLogSetModalVisible && currentSetData ? (
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
              handleCompleteSet(data);
            }}
            isSaving={isSaving}
            weightStep={weightStep}
            units={units}
            onEditSetDetails={(data) => {
              setWeight(data.weight);
              setReps(data.reps);
              setPartials(data.partials);
              setRepsInReserve(data.repsInReserve);
            }}
          />
        ) : null}

        {/* Edit Set Details Modal */}
        {isEditSetModalVisible && currentSetData ? (
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
            weightStep={weightStep}
            units={units}
          />
        ) : null}

        {/* Notes: this workout, always, and (optionally) the template */}
        {isNotesSheetVisible && currentSetData ? (
          <ExerciseNotesSheet
            visible={isNotesSheetVisible}
            onClose={() => setIsNotesSheetVisible(false)}
            exerciseName={currentSetData.exercise.name ?? ''}
            initialSessionNote={currentSetData.notes ?? ''}
            initialExerciseNote={exerciseNote ?? ''}
            canSaveToTemplate={!!currentLogExercise?.templateExerciseId}
            onSave={exerciseActions.saveNotes}
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
            isLoading={isSaving}
          />
        ) : null}

        {/* Replace Exercise Modal */}
        {isReplaceExerciseModalVisible && currentSetData ? (
          <ReplaceExerciseModal
            visible={isReplaceExerciseModalVisible}
            onClose={() => setIsReplaceExerciseModalVisible(false)}
            onReplace={exerciseActions.replaceExercise}
            currentExerciseId={currentSetData.exercise.id}
          />
        ) : null}

        {/* Plate calculator */}
        {isPlateCalculatorVisible && currentSetData ? (
          <PlateCalculatorSheet
            visible={isPlateCalculatorVisible}
            onClose={() => setIsPlateCalculatorVisible(false)}
            targetKg={displayToKg(weight, units)}
            gym={gym}
            units={units}
          />
        ) : null}

        {/* Workout settings (gyms, avoided exercises) */}
        {isWorkoutSettingsVisible ? (
          <WorkoutSettingsModal
            visible={isWorkoutSettingsVisible}
            onClose={() => setIsWorkoutSettingsVisible(false)}
          />
        ) : null}

        {/* Workout History Modal */}
        {isHistoryModalVisible && workoutLog ? (
          <WorkoutSessionHistoryModal
            visible={isHistoryModalVisible}
            onClose={() => setIsHistoryModalVisible(false)}
            workoutLog={workoutLog}
            sets={sets}
            exercises={exercises}
            logExercises={activeLogExercises}
            currentSetOrder={progress.currentSetOrder}
          />
        ) : null}

        {/* Workout Session Overview Modal */}
        {isWorkoutOverviewModalVisible && workoutLog ? (
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

        {workoutLog ? (
          <AddExerciseToSessionModal
            visible={isAddExerciseToSessionModalVisible}
            onClose={() => {
              setIsAddExerciseToSessionModalVisible(false);
              setIsAddExerciseButtonLoading(false);
              // Re-show completion modal if we're still in that state and cancelled adding
              if (effectiveCompletedExerciseForModal) {
                setIsFreeSessionCompleteModalVisible(true);
              }
            }}
            onShow={() => setIsAddExerciseButtonLoading(false)}
            workoutLogId={workoutLog.id}
            onAdded={() => refresh()}
          />
        ) : null}

        {effectiveCompletedExerciseForModal ? (
          <FreeSessionExerciseCompleteModal
            visible={isFreeSessionCompleteModalVisible}
            onClose={() => {
              setIsFreeSessionCompleteModalVisible(false);
              setCompletedExerciseForModal(null);
            }}
            exerciseName={effectiveCompletedExerciseForModal.exerciseName}
            sets={sets}
            exerciseId={effectiveCompletedExerciseForModal.exerciseId}
            units={unitsFor(effectiveCompletedExerciseForModal.exerciseId)}
            exerciseImageUrl={effectiveCompletedExerciseForModal.exerciseImageUrl}
            equipmentType={effectiveCompletedExerciseForModal.equipmentType}
            onAddNextExercise={() => {
              setIsFreeSessionCompleteModalVisible(false);
              // Keep completedExerciseForModal so we can return to it if adding is cancelled
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
      </AnimatedContent>
    </MasterLayout>
  );
}
