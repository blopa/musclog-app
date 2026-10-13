import { useTranslation } from 'react-i18next';

import type { ReplaceExerciseData } from '@/components/modals/ReplaceExerciseModal';
import type { ExerciseNotesSaveData } from '@/components/workout/ExerciseNotesSheet';
import { useSnackbar } from '@/context/SnackbarContext';
import type Exercise from '@/database/models/Exercise';
import {
  ExerciseRestrictionService,
  MAX_EXERCISE_RESTRICTIONS,
} from '@/database/services/ExerciseRestrictionService';
import { ExerciseUserSettingsService } from '@/database/services/ExerciseUserSettingsService';
import { GymService } from '@/database/services/GymService';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import type { SubstitutionOutcome } from '@/utils/exerciseSubstitution';
import type { GymSnapshot } from '@/utils/gym';
import { handleError } from '@/utils/handleError';
import { normalizeNote } from '@/utils/noteText';
import { WARMUP_REST_SECONDS, type WarmupSetPrescription } from '@/utils/warmupSets';

/** The exercise an action is about, through one of its sets (which names its log block). */
export type SessionExerciseTarget = { set: EnrichedWorkoutLogSet; exercise: Exercise };

type SessionExerciseActionsInput = {
  target: SessionExerciseTarget | null;
  gym: GymSnapshot | null;
  /** The exercise-wide note as stored, to tell whether the sheet changed it. */
  exerciseNote: string | undefined;
  refresh: () => Promise<void> | void;
  setIsSaving: (saving: boolean) => void;
};

/**
 * What the live session can do to the exercise in front of the user — swap it, note it, warm up for
 * it, undo the start-of-workout progression — each one a single service call followed by a refresh.
 * Kept out of the session screen so the screen stays about presenting the set.
 */
export function useSessionExerciseActions({
  target,
  gym,
  exerciseNote,
  refresh,
  setIsSaving,
}: SessionExerciseActionsInput) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const logExerciseId = target?.set.logExerciseId;

  /** Runs one write with the saving spinner up, refreshes, and reports a failure in a snackbar. */
  const runSaving = async (label: string, work: (logExerciseId: string) => Promise<unknown>) => {
    if (!logExerciseId) {
      return;
    }
    try {
      setIsSaving(true);
      await work(logExerciseId);
      await refresh();
    } catch (err) {
      handleError(err, `workout-session.${label}`, {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const replaceExercise = async (exercise: ReplaceExerciseData, outcome: SubstitutionOutcome) => {
    if (!target) {
      return;
    }
    const replaced = target.exercise;

    await runSaving('handleReplaceExercise', async (id) => {
      // The still-planned sets carry the OLD exercise's load: a planned 80 kg bench is not an
      // 80 kg dumbbell fly. The suggestion is read before the write, which only touches this log.
      const { weightKg } = await WorkoutTemplateService.getSuggestedWeightAndRepsForExercise(
        exercise.id
      );
      await WorkoutLogExerciseService.replaceLogExercise(id, exercise.id, {
        reason: outcome.reason,
        plannedWeightKg: weightKg,
      });

      // What the user chose to remember is saved only once the swap itself has succeeded.
      if (outcome.restriction) {
        const saved = await ExerciseRestrictionService.set(replaced.id, outcome.restriction.kind, {
          expiresAt: outcome.restriction.expiresAt,
        });
        if (!saved.ok) {
          showSnackbar(
            'error',
            t('workoutSettings.restrictions.limit', { count: MAX_EXERCISE_RESTRICTIONS })
          );
        }
      }
      if (outcome.removeEquipmentFromGym && gym && replaced.equipmentType) {
        await GymService.removeEquipment(gym.id, replaced.equipmentType);
      }

      showSnackbar(
        'success',
        t('replaceExercise.swapped', { from: replaced.name, to: exercise.name })
      );
    });
  };

  const addWarmups = (warmups: readonly WarmupSetPrescription[]) =>
    warmups.length === 0
      ? Promise.resolve()
      : runSaving('handleAddWarmups', (id) =>
          WorkoutLogExerciseService.addWarmupSets(id, warmups, {
            restTimeAfter: WARMUP_REST_SECONDS,
          })
        );

  const removeWarmups = () =>
    runSaving('handleRemoveWarmups', (id) => WorkoutLogExerciseService.removePlannedWarmupSets(id));

  const revertStartAdjustment = () =>
    runSaving('handleRevertStartAdjustment', (id) =>
      WorkoutProgressionService.revertStartAdjustment(id)
    );

  // Throws on failure: the notes sheet keeps itself open with the draft and says so.
  const saveNotes = async ({
    sessionNote,
    exerciseNote: nextExerciseNote,
    alsoSaveToTemplate,
  }: ExerciseNotesSaveData) => {
    const exerciseId = target?.exercise.id;
    if (!target || !logExerciseId || !exerciseId) {
      return;
    }

    // Asking for the template copy writes even an unchanged note: it is what keeps it.
    if (alsoSaveToTemplate || normalizeNote(sessionNote) !== normalizeNote(target.set.notes)) {
      await WorkoutLogExerciseService.saveLogExerciseNote(logExerciseId, sessionNote, {
        alsoSaveToTemplate,
      });
    }

    if (normalizeNote(nextExerciseNote) !== normalizeNote(exerciseNote)) {
      await ExerciseUserSettingsService.setNote(exerciseId, nextExerciseNote);
    }

    await refresh();
  };

  return { replaceExercise, addWarmups, removeWarmups, revertStartAdjustment, saveNotes };
}
