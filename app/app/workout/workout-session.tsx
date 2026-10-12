import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
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
import { SetAdjustmentNotice } from '@/components/workout/SetAdjustmentNotice';
import { WorkoutSessionInsights } from '@/components/workout/WorkoutSessionInsights';
import { WorkoutTrainingView } from '@/components/workout/WorkoutTrainingView';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { type CurrentSetData, useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useSessionBleTracking } from '@/hooks/useSessionBleTracking';
import { useSessionExerciseActions } from '@/hooks/useSessionExerciseActions';
import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { NotificationService } from '@/services/NotificationService';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { parseSetPrescription } from '@/utils/setPrescription';
import { buildWarmupSets } from '@/utils/warmupSets';
import { formatDuration } from '@/utils/workout';

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
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    exerciseId?: string;
    showFeedback?: string;
  }>();
  useKeepScreenAwake('workout-session');
  const session = useActiveWorkout(params.workoutLogId);
  const { workoutLog, sets, exercises, logExercises, refresh } = session;
  const { autoStartRestTimer, defaultRestSeconds, bleGenerateChartPayload } = useSettings();
  const { gym } = useActiveGym();
  const { unitsFor, get } = useExerciseUserSettings();
  const [selectedExercise, setSelectedExercise] = useState<string | undefined>(params.exerciseId);
  const [actionExercise, setActionExercise] = useState<string | undefined>();
  const [panel, setPanel] = useState<SessionPanel>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const controller = useWorkoutSessionController(workoutLog?.id, sets, {
    autoRest: autoStartRestTimer,
    defaultRest: defaultRestSeconds,
    refresh,
  });
  const time = useSessionTotalTime({ startTime: workoutLog?.startedAt });
  const duration = formatDuration(time.hours, time.minutes, time.seconds);
  const actionSet =
    sets.find((set) => set.exerciseId === actionExercise && set.completionStatus === 'planned') ??
    sets.find((set) => set.exerciseId === actionExercise);
  const actionExerciseModel = exercises.find((exercise) => exercise.id === actionSet?.exerciseId);
  const context: CurrentSetData | null =
    actionSet && actionExerciseModel
      ? {
          set: actionSet,
          exercise: actionExerciseModel,
          setNumber: 1,
          totalSetsInExercise: sets.filter((set) => set.logExerciseId === actionSet.logExerciseId)
            .length,
          exerciseNumber: 1,
          notes: actionSet.notes,
        }
      : session.currentSetData;
  const actions = useSessionExerciseActions({
    currentSetData: context,
    gym,
    exerciseNote: get(context?.exercise.id).note,
    refresh,
    setIsSaving: setActionSaving,
  });
  const ble = useSessionBleTracking({
    workoutLogId: workoutLog?.id,
    workoutLog,
    currentSetData: session.currentSetData,
    reps: session.currentSetData?.set.reps ?? 0,
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
      router.replace(`/app/workout/workout-summary?workoutLogId=${workoutLog.id}`);
    }
  }, [workoutLog?.completedAt, workoutLog?.id, router]);
  const close = () => setPanel(null);
  const finish = async () => {
    try {
      await ble.finishSetRecording();
      await controller.finish();
      setPanel(null);
      if (workoutLog) {
        router.replace(`/app/workout/workout-summary?workoutLogId=${workoutLog.id}`);
      }
    } catch {
      /* The controller keeps the error and session available for retry. */
    }
  };
  const onAction = (
    exerciseId: string,
    action: 'guidance' | 'warmup' | 'swap' | 'notes' | 'more'
  ) => {
    setActionExercise(exerciseId);
    setSelectedExercise(exerciseId);
    session.setCurrentExercise(exerciseId);
    if (action === 'warmup') {
      const set = sets.find(
        (row) =>
          row.exerciseId === exerciseId &&
          row.setType !== 'warmup' &&
          row.completionStatus === 'planned'
      );
      const exercise = exercises.find((row) => row.id === exerciseId);
      if (set && exercise) {
        // Select the block before dispatching the contextual action on the next render.
        setPanel('guidance');
      }
    } else {
      setPanel(action);
    }
  };
  const viewController = {
    ...controller,
    skip: async (id: string) => {
      await controller.skip(id);
      setSelectedExercise(undefined);
      session.setCurrentExercise(null);
    },
    complete: async (id: string, values: Parameters<typeof controller.complete>[1]) => {
      await ble.finishSetRecording();
      await controller.complete(id, values);
      ble.attachRecordingToSet(id, values.reps);
      setSelectedExercise(undefined);
      session.setCurrentExercise(null);
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
          currentExerciseId={context?.exercise.id}
          onReplace={async (exercise, outcome) => {
            await actions.replaceExercise(exercise, outcome);
            close();
          }}
        />
      );
    } else if (panel === 'notes' && context) {
      modal = (
        <ExerciseNotesSheet
          key={context.set.logExerciseId}
          visible
          onClose={close}
          exerciseName={context.exercise.name}
          initialSessionNote={context.notes ?? ''}
          initialExerciseNote={get(context.exercise.id).note ?? ''}
          canSaveToTemplate={
            !!logExercises.find((row) => row.id === context.set.logExerciseId)?.templateExerciseId
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
            setSelectedExercise(id);
            session.setCurrentExercise(id);
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
            await WorkoutService.deleteWorkoutLog(workoutLog.id);
            router.replace('/app/workout/workouts');
          }}
        />
      );
    } else if (panel === 'plates' && context) {
      modal = (
        <PlateCalculatorSheet
          visible
          onClose={close}
          targetKg={context.set.weight}
          gym={gym}
          units={unitsFor(context.exercise.id)}
        />
      );
    } else if (panel === 'guidance' && context) {
      const prescription = parseSetPrescription(context.set.prescriptionJson);
      modal = (
        <BottomPopUp
          visible
          onClose={close}
          title={t('trainingFlow.actions.guidance')}
          subtitle={context.exercise.name}
        >
          <View className="gap-4 pb-6">
            {context.set.adjustment ? (
              <SetAdjustmentNotice
                adjustment={context.set.adjustment}
                units={unitsFor(context.exercise.id)}
                onRevert={actions.revertStartAdjustment}
              />
            ) : (
              <Text className="text-text-secondary">{t('progression.learningHint')}</Text>
            )}
            {prescription ? (
              <Text className="text-text-primary">
                {t('progression.audit', {
                  planWeight: formatDisplayWeightKg(
                    i18n.language,
                    unitsFor(context.exercise.id),
                    prescription.plan.weightKg
                  ),
                  planReps: prescription.plan.reps,
                  targetWeight: formatDisplayWeightKg(
                    i18n.language,
                    unitsFor(context.exercise.id),
                    prescription.recommendation.weightKg
                  ),
                  targetReps: prescription.recommendation.reps,
                })}
              </Text>
            ) : null}
            <Button
              label={t('trainingFlow.actions.warmup')}
              variant="outline"
              disabled={actionSaving}
              onPress={() =>
                actions
                  .addWarmups(
                    buildWarmupSets(context.set.weight, {
                      gym,
                      equipmentType: context.exercise.equipmentType,
                      units: unitsFor(context.exercise.id),
                    })
                  )
                  .then(close)
              }
            />
            <Button
              label={t('workoutSettings.plateCalculator.title')}
              variant="outline"
              onPress={() => setPanel('plates')}
            />
            <Button label={t('progression.editTarget')} variant="outline" onPress={close} />
            <Button
              label={t('progression.editGym')}
              variant="outline"
              onPress={() => setPanel('settings')}
            />
            {workoutLog.templateId ? (
              <Button
                label={t('progression.editPlan')}
                variant="outline"
                onPress={() => setPanel('editor')}
              />
            ) : null}
          </View>
        </BottomPopUp>
      );
    }
  }
  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-row items-center justify-between gap-3 px-4 py-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/app/workout/workouts')}
          className="min-h-12 justify-center"
        >
          <Text className="text-accent-primary">{t('trainingFlow.pause')}</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary">
            {workoutLog?.workoutName || t('freeTraining.title')}
          </Text>
          <Text className="text-xs text-text-secondary">
            {duration} ·{' '}
            {t('trainingFlow.progress', {
              done: session.progress.completedSets,
              total: session.progress.totalSets,
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPanel('more')}
          className="min-h-12 justify-center"
        >
          <Text className="text-accent-primary">{t('trainingFlow.actions.more')}</Text>
        </Pressable>
      </View>
      {ble.isSensorConnected ? (
        <Button
          label={t(ble.isTracking ? 'trainingFlow.stopSensor' : 'trainingFlow.startSensor')}
          variant="outline"
          onPress={ble.isTracking ? ble.stopTrackingFromButton : ble.startTracking}
        />
      ) : null}
      {session.isLoading ? (
        <ActivityIndicator color={theme.colors.accent.primary} />
      ) : session.error || !workoutLog ? (
        <View className="gap-4 p-6">
          <Text className="text-text-primary">{t('workoutSession.notFoundDescription')}</Text>
          <Button label={t('common.tryAgain')} onPress={refresh} />
        </View>
      ) : !sets.length ? (
        <View className="gap-4 p-6">
          <Text className="text-text-secondary">{t('createWorkout.noExercisesPlaceholder')}</Text>
          <Button label={t('freeTraining.addExercise.title')} onPress={() => setPanel('add')} />
          <Button label={t('trainingFlow.finish')} onPress={() => setPanel('end')} />
        </View>
      ) : (
        <WorkoutTrainingView
          sets={sets}
          exercises={exercises}
          controller={{ ...viewController, busy: controller.busy || actionSaving }}
          selectedExercise={selectedExercise}
          onSelect={(id) => {
            setSelectedExercise(id);
            session.setCurrentExercise(id);
          }}
          onAction={onAction}
          onFinish={() => setPanel('end')}
        >
          <WorkoutSessionInsights logId={workoutLog.id} startedAt={workoutLog.startedAt} />
        </WorkoutTrainingView>
      )}
      {modal}
    </MasterLayout>
  );
}
