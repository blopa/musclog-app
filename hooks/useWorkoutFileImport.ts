import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { WorkoutImportService } from '@/database/services/WorkoutImportService';
import { useSettings } from '@/hooks/useSettings';
import { pickTextFile } from '@/utils/pickTextFile';
import { getWeightUnit } from '@/utils/units';
import { proposeExerciseMatches } from '@/utils/workoutImport/exerciseMatch';
import {
  canSaveImport,
  type ExerciseChoice,
  IMPORT_SOURCE_NAMES,
  importFlowReducer,
  INITIAL_IMPORT_FLOW,
  resolutionsFor,
} from '@/utils/workoutImport/importFlow';
import { sessionImportKeys } from '@/utils/workoutImport/importKey';
import { parseWorkoutImport } from '@/utils/workoutImport/sessions';
import type { ImportWeightUnit } from '@/utils/workoutImport/types';

/** Larger exports (years of history) are common, so the limit is generous but finite. */
export const MAX_IMPORT_FILE_BYTES = 30 * 1024 * 1024;

export function accountWeightUnit(units: 'metric' | 'imperial'): ImportWeightUnit {
  return getWeightUnit(units);
}

/**
 * Drives the import screen. The reducer holds every decision; this hook only performs the file,
 * database and save steps and reports their results back as actions.
 */
export function useWorkoutFileImport() {
  const { t } = useTranslation();
  const { units } = useSettings();
  const [state, dispatch] = useReducer(importFlowReducer, INITIAL_IMPORT_FLOW);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const runRef = useRef(0);

  const analyse = useCallback(async (text: string, assumedWeightUnit: ImportWeightUnit) => {
    const run = ++runRef.current;
    const parsed = parseWorkoutImport(text, { assumedWeightUnit, now: new Date() });
    if (run !== runRef.current) {
      return;
    }

    if (!parsed.ok) {
      dispatch({ type: 'failed', failure: parsed.failure });
      return;
    }

    try {
      const keys = parsed.sessions.flatMap(sessionImportKeys);
      const existingKeys = await WorkoutImportService.existingKeys(keys);
      if (run === runRef.current) {
        dispatch({ type: 'parsed', result: parsed, existingKeys });
      }
    } catch (error) {
      console.warn('Workout import could not read existing sessions:', error);
      dispatch({ type: 'failed', failure: 'readFailed' });
    }
  }, []);

  const pickFile = useCallback(async () => {
    let picked: Awaited<ReturnType<typeof pickTextFile>>;
    try {
      picked = await pickTextFile({ maxBytes: MAX_IMPORT_FILE_BYTES });
    } catch (error) {
      console.warn('Workout import could not read the file:', error);
      dispatch({ type: 'failed', failure: 'readFailed' });
      return;
    }

    if (picked.status === 'cancelled') {
      return;
    }

    if (picked.status === 'tooLarge') {
      dispatch({ type: 'failed', failure: 'tooLarge' });
      return;
    }

    // The unit shown on the unit step must be the one this parse uses.
    const assumedWeightUnit = accountWeightUnit(units);
    dispatch({ type: 'fileChosen', fileName: picked.name, text: picked.text, assumedWeightUnit });
    if (picked.text.trim() === '') {
      dispatch({ type: 'failed', failure: 'empty' });
      return;
    }

    await analyse(picked.text, assumedWeightUnit);
  }, [analyse, units]);

  const setAssumedUnit = useCallback(
    async (unit: ImportWeightUnit) => {
      dispatch({ type: 'assumedUnitChanged', unit });
      await analyse(stateRef.current.text, unit);
    },
    [analyse]
  );

  const confirmUnit = useCallback(() => dispatch({ type: 'unitConfirmed' }), []);

  // Matching runs once per review, against the new sessions only.
  const { step, matchesLoading, newSessions } = state;
  useEffect(() => {
    if (step !== 'review' || !matchesLoading) {
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        const inputs = await WorkoutImportService.loadMatchInputs();
        if (!cancelled) {
          dispatch({
            type: 'matchesLoaded',
            matches: proposeExerciseMatches(newSessions, inputs.candidates, inputs.aliases),
          });
        }
      } catch (error) {
        console.warn('Workout import could not load exercises:', error);
        if (!cancelled) {
          dispatch({ type: 'failed', failure: 'readFailed' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, matchesLoading, newSessions]);

  const choose = useCallback(
    (name: string, choice: ExerciseChoice) => dispatch({ type: 'choose', name, choice }),
    []
  );
  const clearChoice = useCallback((name: string) => dispatch({ type: 'clearChoice', name }), []);
  const setRememberAlias = useCallback(
    (name: string, value: boolean) => dispatch({ type: 'setRememberAlias', name, value }),
    []
  );

  const save = useCallback(async () => {
    const current = stateRef.current;
    if (!canSaveImport(current) || !current.source) {
      return;
    }

    dispatch({ type: 'saveStarted' });
    try {
      const summary = await WorkoutImportService.commit({
        source: current.source,
        sessions: current.newSessions,
        resolutions: resolutionsFor(current),
        fallbackWorkoutName: t('workoutImport.fallbackWorkoutName', {
          source: IMPORT_SOURCE_NAMES[current.source],
        }),
        onProgress: (done, total) => dispatch({ type: 'saveProgress', progress: { done, total } }),
      });
      dispatch({ type: 'saveSucceeded', summary });
    } catch (error) {
      console.warn('Workout import failed:', error);
      dispatch({ type: 'saveFailed' });
    }
  }, [t]);

  const cancel = useCallback(() => dispatch({ type: 'cancel' }), []);

  return {
    state,
    pickFile,
    setAssumedUnit,
    confirmUnit,
    choose,
    clearChoice,
    setRememberAlias,
    save,
    cancel,
  };
}
