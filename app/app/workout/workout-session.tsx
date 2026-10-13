import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bluetooth } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { MasterLayout } from '@/components/MasterLayout';
import { AddExerciseToSessionModal } from '@/components/modals/AddExerciseToSessionModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import { EndWorkoutModal } from '@/components/modals/EndWorkoutModal';
import { ReplaceExerciseModal } from '@/components/modals/ReplaceExerciseModal';
import { WorkoutOptionsModal } from '@/components/modals/WorkoutOptionsModal';
import WorkoutSessionOverviewModal from '@/components/modals/WorkoutSessionOverviewModal';
import { WorkoutSettingsModal } from '@/components/modals/WorkoutSettingsModal';
import { Button } from '@/components/theme/Button';
import { ExerciseNotesSheet } from '@/components/workout/ExerciseNotesSheet';
import { PlateCalculatorSheet } from '@/components/workout/PlateCalculatorSheet';
import { ProgressionWhySheet } from '@/components/workout/session/ProgressionWhySheet';
import { buildSessionBlocks, guidanceStateFor } from '@/components/workout/session/sessionModel';
import { SessionTopBar } from '@/components/workout/session/SessionTopBar';
import { liveWeightKg } from '@/components/workout/session/setDraft';
import { WorkoutSessionInsights } from '@/components/workout/WorkoutSessionInsights';
import {
  type TrainingViewAction,
  WorkoutTrainingView,
} from '@/components/workout/WorkoutTrainingView';
import { useSnackbar } from '@/context/SnackbarContext';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useSessionBleTracking } from '@/hooks/useSessionBleTracking';
import {
  type SessionExerciseTarget,
  useSessionExerciseActions,
} from '@/hooks/useSessionExerciseActions';
import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { NotificationService } from '@/services/NotificationService';
import { isBarLoadedEquipment } from '@/utils/gym';
import { handleError } from '@/utils/handleError';
import { WARMUP_REST_SECONDS, type WarmupSetPrescription } from '@/utils/warmupSets';
import { formatDuration } from '@/utils/workout';
import { isPerformedWorkoutSet, isResolvedWorkoutSet } from '@/utils/workoutSetCompletion';

type SessionPanel =
  | 'add'
  | 'swap'
  | 'notes'
  | 'more'
  | 'settings'
  | 'end'
  | 'overview'
  | 'guidance'
  | 'editor'
  | 'plates'
  | null;

export default function WorkoutSessionScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    exerciseId?: string;
    logExerciseId?: string;
    showFeedback?: string;
  }>();
  useKeepScreenAwake('workout-session');
  const session = useActiveWorkout(params.workoutLogId);
  const { workoutLog, sets, exercises, logExercises, refresh, setCurrentLogExercise } = session;
  const { autoStartRestTimer, defaultRestSeconds, bleGenerateChartPayload } = useSettings();
  const { gym } = useActiveGym();
  const { unitsFor, get } = useExerciseUserSettings();
  const { locale } = useFormatAppNumber();
  const [selectedLogExerciseId, setSelectedLogExerciseId] = useState<string | undefined>(
    params.logExerciseId
  );
  const [actionLogExerciseId, setActionLogExerciseId] = useState<string | undefined>();
  const initialSelectionApplied = useRef(false);
  useEffect(() => {
    if (initialSelectionApplied.current || !sets.length) {
      return;
    }
    initialSelectionApplied.current = true;
    const id =
      params.logExerciseId ??
      sets.find((set) => set.exerciseId === params.exerciseId)?.logExerciseId;
    setSelectedLogExerciseId(id);
    setCurrentLogExercise(id ?? null);
  }, [sets, params.exerciseId, params.logExerciseId, setCurrentLogExercise]);
  const [panel, setPanel] = useState<SessionPanel>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const controller = useWorkoutSessionController(workoutLog?.id, sets, {
    autoRest: autoStartRestTimer,
    defaultRest: defaultRestSeconds,
    refresh,
  });
  // A failed save is reported where the user is looking, whichever view or panel is up.
  const saveError = controller.error;
  useEffect(() => {
    if (saveError != null) {
      showSnackbar('error', t('trainingFlow.saveError'));
    }
  }, [saveError, showSnackbar, t]);
  const time = useSessionTotalTime({ startTime: workoutLog?.startedAt });
  const duration = formatDuration(time.hours, time.minutes, time.seconds);

  // The exercise an action (notes, swap, why, plates) is about: the one whose button was tapped.
  const actionSet =
    sets.find(
      (set) => set.logExerciseId === actionLogExerciseId && set.completionStatus === 'planned'
    ) ?? sets.find((set) => set.logExerciseId === actionLogExerciseId);
  const actionExerciseModel = exercises.find((exercise) => exercise.id === actionSet?.exerciseId);
  const current = session.currentSetData;
  let target: SessionExerciseTarget | null = null;
  if (actionSet && actionExerciseModel) {
    target = { set: actionSet, exercise: actionExerciseModel };
  } else if (current) {
    target = { set: current.set, exercise: current.exercise };
  }
  const actions = useSessionExerciseActions({
    target,
    gym,
    exerciseNote: get(target?.exercise.id).note,
    refresh,
    setIsSaving: setActionSaving,
  });
  const ble = useSessionBleTracking({
    workoutLogId: workoutLog?.id,
    workoutLog,
    currentSetData: session.currentSetData,
    reps:
      Number(
        controller.drafts[session.currentSetData?.set.id ?? '']?.reps ??
          session.currentSetData?.set.reps ??
          0
      ) || 0,
    bleGenerateChartPayload,
  });

  useEffect(() => {
    if (workoutLog && !workoutLog.completedAt) {
      NotificationService.updateActiveWorkoutNotification(
        workoutLog.workoutName || t('freeTraining.title'),
        duration,
        session.currentSetData?.exercise.name,
        workoutLog.id
      );
    }
  }, [workoutLog, duration, session.currentSetData?.exercise.name, t]);
  useEffect(() => {
    if (workoutLog?.id && !workoutLog.completedAt) {
      NotificationService.scheduleWorkoutDurationWarning(workoutLog.startedAt);
    }
    return () => {
      NotificationService.dismissActiveWorkoutNotification();
      NotificationService.cancelWorkoutDurationWarning();
    };
  }, [workoutLog?.id, workoutLog?.completedAt, workoutLog?.startedAt]);
  useEffect(() => {
    if (workoutLog?.completedAt) {
      router.replace(
        `/app/workout/workout-summary?workoutLogId=${workoutLog.id}${params.showFeedback === '1' ? '&showSessionFeedback=1' : ''}`
      );
    }
  }, [workoutLog?.completedAt, workoutLog?.id, params.showFeedback, router]);

  const close = () => setPanel(null);
  // Navigation to the summary is the `completedAt` effect's job alone: it fires when the refreshed
  // log comes back completed. Replacing here as well navigated twice, once without the feedback flag.
  const finish = async () => {
    // Sensor trouble must not keep the workout from ending: the recording is best effort.
    try {
      await ble.finishSetRecording();
    } catch (error) {
      void handleError(error, 'workout-session.finishSensor', { showSnackbar: false });
    }
    // A failure leaves the session open for a retry and surfaces through `controller.error`. The
    // end-of-workout modal would hide that snackbar, so it closes either way.
    await controller.finish();
    setPanel(null);
  };
  const selectExercise = (id: string | undefined) => {
    setSelectedLogExerciseId(id);
    setCurrentLogExercise(id ?? null);
  };
  const onAction = (logExerciseId: string, action: TrainingViewAction) => {
    setActionLogExerciseId(logExerciseId);
    if (controller.view === 'guided') {
      selectExercise(logExerciseId);
    }
    setPanel(action === 'warmup' ? null : action);
  };
  const onWarmups = async (
    logExerciseId: string,
    warmups: readonly WarmupSetPrescription[] | 'remove'
  ) => {
    const block = sets.find((set) => set.logExerciseId === logExerciseId);
    if (!block || actionSaving) {
      return;
    }
    setActionSaving(true);
    try {
      if (warmups === 'remove') {
        await WorkoutLogExerciseService.removePlannedWarmupSets(block.logExerciseId);
      } else {
        await WorkoutLogExerciseService.addWarmupSets(block.logExerciseId, warmups, {
          restTimeAfter: WARMUP_REST_SECONDS,
        });
      }
      await refresh();
    } catch (error) {
      handleError(error, 'workout-session.warmups', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setActionSaving(false);
    }
  };
  // The training view's controller: the session's own, with the sensor recording and the
  // selection reset around each set. Reopening a performed set is not a new recording.
  const viewController = {
    ...controller,
    busy: controller.busy || actionSaving,
    skip: async (id: string) => {
      const skipped = await controller.skip(id);
      if (skipped) {
        selectExercise(undefined);
      }
      return skipped;
    },
    complete: async (
      id: string,
      values: Parameters<typeof controller.complete>[1],
      completeOptions?: Parameters<typeof controller.complete>[2]
    ) => {
      const existing = sets.find((set) => set.id === id);
      const reopening = !!existing && isPerformedWorkoutSet(existing);
      if (!reopening) {
        await ble.finishSetRecording(id, values.reps);
      }
      const completed = await controller.complete(id, values, completeOptions);
      if (completed) {
        if (!reopening) {
          ble.attachRecordingToSet(id, values.reps);
        }
        selectExercise(undefined);
      }
      return completed;
    },
  };

  let modal = null;
  if (workoutLog) {
    if (panel === 'add') {
      modal = (
        <AddExerciseToSessionModal
          visible
          onClose={close}
          workoutLogId={workoutLog.id}
          onAdded={() => {
            refresh();
            close();
          }}
        />
      );
    } else if (panel === 'swap') {
      modal = (
        <ReplaceExerciseModal
          visible
          onClose={close}
          currentExerciseId={target?.exercise.id}
          onReplace={async (exercise, outcome) => {
            const swappedLogExerciseId = target?.set.logExerciseId;
            // A failed swap keeps everything: the sheet stays open and the typed numbers still
            // belong to the exercise that is still there. The error was already shown.
            if (!(await actions.replaceExercise(exercise, outcome))) {
              return;
            }
            // Typed numbers belong to the old movement; the replacement has its own suggestion.
            if (swappedLogExerciseId) {
              controller.clearValueDrafts(swappedLogExerciseId);
            }
            selectExercise(undefined);
            close();
          }}
        />
      );
    } else if (panel === 'notes' && target) {
      modal = (
        <ExerciseNotesSheet
          key={target.set.logExerciseId}
          visible
          onClose={close}
          exerciseName={target.exercise.name}
          initialSessionNote={target.set.notes ?? ''}
          initialExerciseNote={get(target.exercise.id).note ?? ''}
          canSaveToTemplate={
            !!logExercises.find((row) => row.id === target.set.logExerciseId)?.templateExerciseId
          }
          onSave={actions.saveNotes}
        />
      );
    } else if (panel === 'settings') {
      modal = <WorkoutSettingsModal visible onClose={close} />;
    } else if (panel === 'editor' && workoutLog.templateId) {
      modal = <CreateWorkoutModal visible onClose={close} templateId={workoutLog.templateId} />;
    } else if (panel === 'more') {
      modal = (
        <WorkoutOptionsModal
          visible
          onClose={close}
          onPreviewWorkout={() => setPanel('overview')}
          onWorkoutSettings={() => setPanel('settings')}
          onEndWorkout={() => setPanel('end')}
          onAddExercise={() => setPanel('add')}
        />
      );
    } else if (panel === 'overview') {
      modal = (
        <WorkoutSessionOverviewModal
          visible
          onClose={close}
          workoutLogId={workoutLog.id}
          onSelectExercise={(id) => {
            selectExercise(id);
            close();
          }}
        />
      );
    } else if (panel === 'end') {
      modal = (
        <EndWorkoutModal
          visible
          onClose={close}
          onFinishAndSave={finish}
          onFinishAndDiscard={async () => {
            if (await controller.discard()) {
              router.replace('/app/workout/workouts');
            }
          }}
        />
      );
    } else if (panel === 'plates' && target) {
      modal = (
        <PlateCalculatorSheet
          visible
          onClose={close}
          targetKg={liveWeightKg(
            target.set,
            controller.drafts[target.set.id],
            unitsFor(target.exercise.id),
            locale
          )}
          gym={gym}
          units={unitsFor(target.exercise.id)}
        />
      );
    } else if (panel === 'guidance' && target) {
      const block = buildSessionBlocks(sets).find(
        (candidate) => candidate.logExerciseId === target.set.logExerciseId
      );
      if (block) {
        const row = block.rows.find((candidate) => candidate.set.id === block.focus.id);
        modal = (
          <ProgressionWhySheet
            exerciseName={target.exercise.name ?? ''}
            state={guidanceStateFor(block, {
              equipmentType: target.exercise.equipmentType,
              gym,
            })}
            rule={block.rule}
            progressionJson={block.focus.progressionJson}
            adjustment={block.focus.adjustment}
            prescription={row?.prescription ?? null}
            units={unitsFor(target.exercise.id)}
            isBarLoaded={isBarLoadedEquipment(target.exercise.equipmentType)}
            canEditPlan={!!workoutLog.templateId}
            onClose={close}
            onRevert={() => {
              close();
              void controller.revert(block.logExerciseId);
            }}
            onPlates={() => setPanel('plates')}
            onEditGym={() => setPanel('settings')}
            onEditPlan={() => setPanel('editor')}
            onEditTarget={() => {
              selectExercise(target.set.logExerciseId);
              close();
            }}
          />
        );
      }
    }
  }

  const done = sets.filter(isResolvedWorkoutSet).length;
  let content;
  if (session.isLoading) {
    content = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={theme.colors.accent.primary} />
      </View>
    );
  } else if (session.error || !workoutLog) {
    content = (
      <View className="gap-4 p-6">
        <Text className="text-text-primary">{t('workoutSession.notFoundDescription')}</Text>
        <Button label={t('common.tryAgain')} onPress={refresh} />
      </View>
    );
  } else if (!sets.length) {
    content = (
      <View className="gap-4 p-6">
        <Text className="text-text-secondary">{t('createWorkout.noExercisesPlaceholder')}</Text>
        <Button label={t('freeTraining.addExercise.title')} onPress={() => setPanel('add')} />
        <Button
          label={t('trainingFlow.finish')}
          variant="outline"
          onPress={() => setPanel('end')}
        />
      </View>
    );
  } else {
    content = (
      <WorkoutTrainingView
        sets={sets}
        exercises={exercises}
        controller={viewController}
        selectedLogExerciseId={selectedLogExerciseId}
        onSelect={selectExercise}
        onAction={onAction}
        onWarmups={onWarmups}
        onAddExercise={() => setPanel('add')}
        onFinish={() => setPanel('end')}
      >
        {ble.isSensorConnected ? (
          <View className="pb-3">
            <Button
              label={t(ble.isTracking ? 'trainingFlow.stopSensor' : 'trainingFlow.startSensor')}
              icon={Bluetooth}
              variant="secondary"
              width="full"
              onPress={ble.isTracking ? ble.stopTrackingFromButton : ble.startTracking}
            />
          </View>
        ) : null}
        <WorkoutSessionInsights logId={workoutLog.id} startedAt={workoutLog.startedAt} />
      </WorkoutTrainingView>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <SessionTopBar
        title={workoutLog?.workoutName || t('freeTraining.title')}
        duration={duration}
        done={done}
        total={sets.length}
        view={controller.view}
        onViewChange={(value) => void controller.changeView(value)}
        onPause={() => router.push('/app/workout/workouts')}
        onMore={() => setPanel('more')}
      />
      {content}
      {modal}
    </MasterLayout>
  );
}
