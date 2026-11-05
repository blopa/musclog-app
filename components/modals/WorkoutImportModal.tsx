import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import {
  ImportFailedView,
  ImportSavingView,
  ImportSummaryView,
} from '@/components/workoutImport/ImportOutcomeViews';
import { ImportPickStep } from '@/components/workoutImport/ImportPickStep';
import { ImportReviewStep } from '@/components/workoutImport/ImportReviewStep';
import { ImportUnitStep } from '@/components/workoutImport/ImportUnitStep';
import { type ImportBatch, WorkoutImportService } from '@/database/services/WorkoutImportService';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useSettings } from '@/hooks/useSettings';
import { useWorkoutFileImport } from '@/hooks/useWorkoutFileImport';
import { handleError } from '@/utils/handleError';
import {
  canSaveImport,
  type ExerciseChoice,
  firstWeightedSetKg,
} from '@/utils/workoutImport/importFlow';

import ExercisesModal, { type ExerciseData } from './ExercisesModal';
import { ImportWorkoutsModal } from './ImportWorkoutsModal';

type WorkoutImportModalProps = {
  visible: boolean;
  onClose: () => void;
};

/** One child modal at a time: each is a single element in the one panel slot (see `local/no-sibling-modals`). */
type Panel =
  | { kind: 'none' }
  | { kind: 'paste' }
  | { kind: 'exercise'; name: string }
  | { kind: 'undo'; batchId: string };

export function WorkoutImportModal({ visible, onClose }: WorkoutImportModalProps) {
  const { t } = useTranslation();
  const { units, isAiConfigured } = useSettings();
  const flow = useWorkoutFileImport();
  const { state } = flow;
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  useKeepScreenAwake('workout-import', visible && state.step === 'saving');

  const loadBatches = useCallback(() => {
    return WorkoutImportService.listBatches().then(
      (list) => setBatches(list),
      (error: unknown) => handleError(error, 'WorkoutImportModal.loadBatches')
    );
  }, []);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    let cancelled = false;
    WorkoutImportService.listBatches().then(
      (list) => {
        if (!cancelled) {
          setBatches(list);
        }
      },
      (error: unknown) => handleError(error, 'WorkoutImportModal.loadBatches')
    );
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    if (state.step === 'saving') {
      return;
    }

    flow.cancel();
    setPanel({ kind: 'none' });
    onClose();
  }, [flow, onClose, state.step]);

  const handleSave = useCallback(async () => {
    await flow.save();
    void loadBatches();
  }, [flow, loadBatches]);

  const handleUndo = useCallback(
    async (batchId: string) => {
      try {
        await WorkoutImportService.undoBatch(batchId);
      } catch (error) {
        handleError(error, 'WorkoutImportModal.undo');
      }

      setPanel({ kind: 'none' });
      flow.cancel();
      void loadBatches();
    },
    [flow, loadBatches]
  );

  const handleExercisePicked = useCallback(
    (name: string, exercise: ExerciseData) => {
      const choice: ExerciseChoice = {
        kind: 'pick',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        rememberAlias: true,
      };
      flow.choose(name, choice);
      setPanel({ kind: 'none' });
    },
    [flow]
  );

  // A single child element: the panel slot never mounts two modals at once.
  const renderPanel = () => {
    if (panel.kind === 'paste') {
      return <ImportWorkoutsModal visible onClose={() => setPanel({ kind: 'none' })} />;
    }

    if (panel.kind === 'exercise') {
      const { name } = panel;
      return (
        <ExercisesModal
          visible
          onClose={() => setPanel({ kind: 'none' })}
          onSelectExercise={(exercise) => handleExercisePicked(name, exercise)}
        />
      );
    }

    if (panel.kind === 'undo') {
      const { batchId } = panel;
      return (
        <ConfirmationModal
          visible
          onClose={() => setPanel({ kind: 'none' })}
          onConfirm={() => handleUndo(batchId)}
          title={t('workoutImport.pick.undoTitle')}
          message={t('workoutImport.pick.undoMessage')}
          confirmLabel={t('workoutImport.pick.undoConfirm')}
          variant="destructive"
        />
      );
    }

    return null;
  };

  const renderBody = () => {
    switch (state.step) {
      case 'pick':
        return (
          <ImportPickStep
            onChooseFile={() => void flow.pickFile()}
            onPasteText={isAiConfigured ? () => setPanel({ kind: 'paste' }) : undefined}
            batches={batches}
            onUndo={(batch) => setPanel({ kind: 'undo', batchId: batch.batchId })}
          />
        );
      case 'failed':
        return state.failure ? <ImportFailedView failure={state.failure} /> : null;
      case 'unit':
        return (
          <ImportUnitStep
            unit={state.assumedWeightUnit}
            onUnitChange={(unit) => void flow.setAssumedUnit(unit)}
            firstWeightKg={firstWeightedSetKg(state.newSessions)}
            units={units}
          />
        );
      case 'review':
        return (
          <ImportReviewStep
            matches={state.matches}
            loading={state.matchesLoading}
            choices={state.choices}
            newCount={state.newSessions.length}
            alreadyHereCount={state.alreadyHereCount}
            skipped={state.skipped}
            onChoose={(name) => setPanel({ kind: 'exercise', name })}
            onCreate={(name) => flow.choose(name, { kind: 'create' })}
            onSkip={(name) => flow.choose(name, { kind: 'skip' })}
            onClear={(name) => flow.clearChoice(name)}
            onRememberChange={(name, value) => flow.setRememberAlias(name, value)}
          />
        );
      case 'saving':
        return state.progress ? (
          <ImportSavingView done={state.progress.done} total={state.progress.total} />
        ) : null;
      case 'summary':
        return state.summary ? (
          <ImportSummaryView summary={state.summary} skipped={state.skipped} />
        ) : null;
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (state.step === 'unit') {
      return (
        <Button label={t('workoutImport.unit.continue')} onPress={flow.confirmUnit} width="full" />
      );
    }

    if (state.step === 'review') {
      return (
        <View className="gap-2">
          {state.saveFailed ? <ImportSaveFailedNotice /> : null}
          <Button
            label={t('workoutImport.review.importSessions', { count: state.newSessions.length })}
            onPress={() => void handleSave()}
            disabled={!canSaveImport(state)}
            width="full"
          />
        </View>
      );
    }

    if (state.step === 'failed') {
      return (
        <Button
          label={t('workoutImport.failure.retry')}
          onPress={() => void flow.pickFile()}
          width="full"
        />
      );
    }

    if (state.step === 'summary' && state.summary) {
      const { batchId } = state.summary;
      return (
        <View className="gap-2">
          <Button label={t('workoutImport.summary.done')} onPress={handleClose} width="full" />
          <TextButton
            label={t('workoutImport.summary.undoThis')}
            tone="danger"
            onPress={() => setPanel({ kind: 'undo', batchId })}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('workoutImport.title')}
      footer={renderFooter()}
      scrollable={state.step === 'review' ? false : true}
    >
      {renderBody()}
      {renderPanel()}
    </FullScreenModal>
  );
}

/** Shown in place of the save button's hint when the last save failed and the choices were kept. */
function ImportSaveFailedNotice() {
  const { t } = useTranslation();
  return (
    <Text className="text-sm text-status-warning">{t('workoutImport.review.saveFailed')}</Text>
  );
}
